"use client";

import type { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { queue, type QueueEntry } from "./db";

/**
 * Sequential replay loop. Pulls entries oldest-first and runs them one at
 * a time against the Convex client. We keep things serial because order
 * matters — a `completeOrder` followed by a `refundOrder` must replay in
 * that order, and parallel attempts can blow through the BIR serial
 * counter out of sequence.
 *
 * Failure handling:
 *   - increment `attempts`, store the error message
 *   - back off and stop the loop (caller can kick it again later)
 *   - after MAX_ATTEMPTS we *keep* the entry but the UI can flag it as
 *     a "dead-letter" the operator has to deal with by hand
 *
 * We deliberately do NOT auto-delete failed entries: a payment-critical
 * mutation that mysteriously vanishes is worse than one stuck in a queue
 * with an obvious error badge.
 */
const MAX_ATTEMPTS = 8;

type ReplayListener = (state: ReplayState) => void;
export type ReplayState = {
  isReplaying: boolean;
  /** Total entries currently in the queue. */
  queueDepth: number;
  /** Entries that have failed at least once. */
  failed: number;
  /** Entries that have hit MAX_ATTEMPTS — operator intervention needed. */
  deadLetter: number;
  /** Last replay error message (any entry). */
  lastError: string | null;
};

let convex: ConvexReactClient | null = null;
let listeners: Set<ReplayListener> = new Set();
let state: ReplayState = {
  isReplaying: false,
  queueDepth: 0,
  failed: 0,
  deadLetter: 0,
  lastError: null,
};
let running = false;

function notify() {
  for (const l of listeners) l(state);
}

async function refreshState(): Promise<void> {
  const entries = await queue.list();
  state = {
    ...state,
    queueDepth: entries.length,
    failed: entries.filter((e) => e.attempts > 0 && e.attempts < MAX_ATTEMPTS).length,
    deadLetter: entries.filter((e) => e.attempts >= MAX_ATTEMPTS).length,
  };
  notify();
}

/** Register the live Convex client. Call once from a top-level provider. */
export function bindConvex(client: ConvexReactClient): void {
  convex = client;
  void refreshState();
}

export function subscribeReplay(fn: ReplayListener): () => void {
  listeners.add(fn);
  fn(state);
  return () => {
    listeners.delete(fn);
  };
}

/** Snapshot — for non-React consumers. */
export function getReplayState(): ReplayState {
  return state;
}

/**
 * Enqueue a mutation. If we're online and the queue is empty we still
 * write through the queue (and kick replay) so the call sequence is
 * deterministic — that way every order goes through the same pipeline
 * regardless of network state, and there's no "fast path" that bypasses
 * the queue and then races a buffered mutation behind it.
 */
export async function enqueueMutation(
  fn: string,
  args: unknown,
  meta?: Record<string, unknown>
): Promise<string> {
  const id = await queue.enqueue({ fn, args, meta });
  await refreshState();
  void kickReplay();
  return id;
}

/**
 * Run the replay loop. Safe to call any time — it self-debounces. Wired
 * to the window 'online' event and the queue enqueue path.
 */
export async function kickReplay(): Promise<void> {
  if (running) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (!convex) return;
  running = true;
  state = { ...state, isReplaying: true };
  notify();

  try {
    while (true) {
      const entries = await queue.list();
      const next = entries.find((e) => e.attempts < MAX_ATTEMPTS);
      if (!next) break;
      if (typeof navigator !== "undefined" && navigator.onLine === false) break;

      const ok = await runOne(next);
      if (!ok) break; // back off; window 'online' / next kick will resume
    }
  } finally {
    running = false;
    state = { ...state, isReplaying: false };
    await refreshState();
  }
}

async function runOne(entry: QueueEntry): Promise<boolean> {
  if (!convex) return false;
  try {
    const ref = makeFunctionReference<"mutation">(entry.fn);
    await convex.mutation(
      ref,
      entry.args as Record<string, unknown>
    );
    await queue.delete(entry.id);
    state = { ...state, lastError: null };
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await queue.update({
      ...entry,
      attempts: entry.attempts + 1,
      lastError: msg,
    });
    state = { ...state, lastError: msg };
    return false;
  }
}

/**
 * Retry an entry that's hit dead-letter — resets the attempts counter so
 * the loop will pick it back up.
 */
export async function retryEntry(id: string): Promise<void> {
  const entries = await queue.list();
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  await queue.update({ ...e, attempts: 0, lastError: undefined });
  await refreshState();
  void kickReplay();
}

/**
 * Permanently drop an entry — only the operator should be able to do
 * this (e.g. they re-keyed the order manually after a payment dispute).
 */
export async function discardEntry(id: string): Promise<void> {
  await queue.delete(id);
  await refreshState();
}

/** Wire window 'online' to a replay attempt. Idempotent. */
let onlineBound = false;
export function bindOnlineEvent(): void {
  if (onlineBound || typeof window === "undefined") return;
  onlineBound = true;
  window.addEventListener("online", () => {
    void kickReplay();
  });
}
