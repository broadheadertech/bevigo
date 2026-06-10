"use client";

import { cache } from "./db";
import type { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Client-side pool of pre-allocated BIR serial numbers per location.
 *
 * Lifecycle:
 *   1. On register-page mount (and on shift start), `ensureReservation`
 *      asks the server for a block via reserveSerialBlock. The block is
 *      cached locally in IndexedDB so it survives a tab reload.
 *   2. When the cashier rings up an order, `claimNextSerial` pops the
 *      next unused number from the cached block and bumps the local
 *      cursor.
 *   3. The claimed `{ reservationId, serialNumber }` rides along with
 *      completeOrder as `clientBirSerial`. The server validates and
 *      consumes it.
 *   4. If the block is exhausted, `ensureReservation` requests a fresh
 *      one on the next online tick.
 *
 * Concurrency: a single shop usually has one register per device, so
 * cross-tab claim races are rare. We still serialise within the same
 * process with a per-location mutex so two parallel checkouts in the
 * same tab can't claim the same number.
 */

const DEVICE_KEY = "bevigo-device-id";
const RESERVATION_KEY = (locationId: string) => `bir-reservation:${locationId}`;
const LOW_WATER = 5; // request a new block when fewer than this remain
const DEFAULT_BLOCK_SIZE = 50;

type PoolState = {
  reservationId: Id<"orderSerialReservations">;
  prefix: string;
  fromSerial: number;
  toSerial: number;
  /** Next serial we'll hand out — claim returns this, then increments. */
  nextUnused: number;
  expiresAt: number;
};

let mutexes: Map<string, Promise<unknown>> = new Map();
async function withMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = mutexes.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  mutexes.set(
    key,
    run.catch(() => undefined)
  );
  return run;
}

/**
 * Stable per-browser device id. Persisted in localStorage so the same
 * physical machine keeps the same id across reloads. Gets created lazily.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (id && id.length >= 8) return id;
  id = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_KEY, id);
  return id;
}

async function readPool(locationId: string): Promise<PoolState | null> {
  return cache.get<PoolState>(RESERVATION_KEY(locationId));
}
async function writePool(
  locationId: string,
  state: PoolState | null
): Promise<void> {
  if (state === null) {
    await cache.delete(RESERVATION_KEY(locationId));
  } else {
    await cache.set(RESERVATION_KEY(locationId), state);
  }
}

function remaining(state: PoolState): number {
  return Math.max(0, state.toSerial - state.nextUnused + 1);
}

/**
 * Ensure the device has a usable block reserved for this location.
 * Idempotent — safe to call on every register render. Requests a new
 * block only when we're empty, exhausted, expired, or below the low-
 * water mark.
 *
 * Returns the current pool state, or null when the server declined
 * (BIR settings not configured yet — caller should not pre-allocate).
 */
export async function ensureReservation(
  convex: ConvexReactClient,
  token: string,
  locationId: Id<"locations">,
  size: number = DEFAULT_BLOCK_SIZE
): Promise<PoolState | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    // Don't try to talk to the server while offline; whatever's in the
    // pool from a previous session is what we have to work with.
    return readPool(locationId);
  }
  return withMutex(`ensure:${locationId}`, async () => {
    const existing = await readPool(locationId);
    const stillUsable =
      existing &&
      existing.expiresAt > Date.now() &&
      remaining(existing) > LOW_WATER;
    if (stillUsable) return existing;

    try {
      const result = await convex.mutation(api.settings.birReservations.reserveSerialBlock, {
        token,
        locationId,
        deviceId: getDeviceId(),
        size,
      });
      if (!result) {
        // BIR not configured — clear any stale pool and give up.
        await writePool(locationId, null);
        return null;
      }
      const nextUnused = Math.max(result.fromSerial, result.usedThrough + 1);
      const state: PoolState = {
        reservationId: result.reservationId,
        prefix: result.prefix,
        fromSerial: result.fromSerial,
        toSerial: result.toSerial,
        nextUnused,
        expiresAt: result.expiresAt,
      };
      await writePool(locationId, state);
      return state;
    } catch {
      // Network blip — return whatever we already have rather than
      // wiping the pool. If it's been wiped already (null), the caller
      // sees the pool is empty and the receipt prints with no BIR number.
      return existing ?? null;
    }
  });
}

/** Pop the next serial. Returns null when the pool is empty/expired. */
export async function claimNextSerial(
  locationId: Id<"locations">
): Promise<{
  reservationId: Id<"orderSerialReservations">;
  serialNumber: number;
  formatted: string;
  deviceId: string;
} | null> {
  return withMutex(`claim:${locationId}`, async () => {
    const state = await readPool(locationId);
    if (!state) return null;
    if (state.expiresAt < Date.now()) {
      await writePool(locationId, null);
      return null;
    }
    if (state.nextUnused > state.toSerial) return null;

    const serialNumber = state.nextUnused;
    const next: PoolState = { ...state, nextUnused: state.nextUnused + 1 };
    await writePool(locationId, next);
    return {
      reservationId: state.reservationId,
      serialNumber,
      formatted: `${state.prefix}${String(serialNumber).padStart(8, "0")}`,
      deviceId: getDeviceId(),
    };
  });
}

/**
 * Return a claimed serial to the pool — used when payment is cancelled
 * locally BEFORE we hand the args to the queue. Once the order is in the
 * queue we can't safely roll back because we don't know whether the
 * server accepted it; in that case the operator handles the gap via the
 * BIR settings page.
 */
export async function releaseClaim(
  locationId: Id<"locations">,
  serialNumber: number
): Promise<void> {
  await withMutex(`claim:${locationId}`, async () => {
    const state = await readPool(locationId);
    if (!state) return;
    // Only roll back if this was the most recent claim — otherwise the
    // sequence has already moved past and we leave the gap intact for
    // the operator to reconcile.
    if (state.nextUnused === serialNumber + 1) {
      await writePool(locationId, { ...state, nextUnused: serialNumber });
    }
  });
}

/** Snapshot — used by the offline status banner / BIR page. */
export async function getPoolSnapshot(
  locationId: Id<"locations">
): Promise<{
  available: number;
  expiresAt: number;
  prefix: string;
  nextFormatted: string | null;
} | null> {
  const state = await readPool(locationId);
  if (!state) return null;
  const avail = remaining(state);
  return {
    available: avail,
    expiresAt: state.expiresAt,
    prefix: state.prefix,
    nextFormatted:
      avail > 0
        ? `${state.prefix}${String(state.nextUnused).padStart(8, "0")}`
        : null,
  };
}
