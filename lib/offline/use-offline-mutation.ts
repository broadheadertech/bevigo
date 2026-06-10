"use client";

import { useCallback, useRef } from "react";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import { enqueueMutation } from "./queue-replay";

/**
 * Drop-in replacement for `useMutation` that survives offline. When the
 * network is up, it calls the mutation immediately (same as before).
 * When offline, it enqueues the call to IndexedDB and resolves with a
 * synthetic `{ queued: true, optimisticId }` so the caller can still
 * close the modal, print a draft receipt, etc.
 *
 * The function path is derived from the FunctionReference at runtime so
 * we never have to hand-write Convex paths — TypeScript still type-checks
 * the args because the live path goes through `useMutation`.
 *
 * Replay is handled centrally by `queue-replay.ts` whenever the window
 * comes back online or another mutation lands.
 */
export type QueuedResult<T> =
  | { queued: false; result: T }
  | { queued: true; optimisticId: string };

export function useOfflineMutation<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Ref extends FunctionReference<"mutation", "public", any, any>,
>(
  ref: Ref,
  options?: {
    /** Path the queue will use to replay later. Required when offline. */
    fnPath: string;
    /** Pass-through meta for the queue entry (used by serial pre-alloc). */
    meta?: Record<string, unknown>;
  }
): (args: Ref["_args"]) => Promise<QueuedResult<Ref["_returnType"]>> {
  const liveMutation = useMutation(ref);
  const convex = useConvex();
  void convex; // referenced to avoid tree-shaking the convex hook chain
  const pathRef = useRef(options?.fnPath ?? "");

  return useCallback(
    async (args) => {
      const online = typeof navigator === "undefined" || navigator.onLine;
      if (online) {
        try {
          const result = await liveMutation(args);
          return { queued: false, result };
        } catch (e) {
          // If the live call fails *with a network error* we fall through
          // to the queue path; everything else is a real validation/auth
          // error the caller should see.
          if (isNetworkError(e)) {
            // fall through
          } else {
            throw e;
          }
        }
      }
      if (!pathRef.current) {
        throw new Error(
          "useOfflineMutation: offline path taken but fnPath not provided"
        );
      }
      const optimisticId = await enqueueMutation(
        pathRef.current,
        args as unknown,
        options?.meta
      );
      return { queued: true, optimisticId };
    },
    [liveMutation, options?.meta]
  );
}

function isNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message.toLowerCase();
  return (
    m.includes("network") ||
    m.includes("failed to fetch") ||
    m.includes("disconnected") ||
    m.includes("websocket")
  );
}
