"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { cache } from "./db";

/**
 * Wraps `useQuery` with an IndexedDB fallback. While online + data is
 * streaming live, the cache is kept up to date. When offline (or before
 * the live result arrives), we surface the last-seen snapshot so the
 * register page paints something useful instead of a "Loading…" spinner
 * that never resolves.
 *
 * `cacheKey` should encode every arg that affects the result (e.g.
 * `menu:${tenantId}:${locationId}`) so two locations on the same device
 * don't trample each other.
 */
export function useCachedQuery<T>(
  ref: FunctionReference<"query"> | undefined,
  args: Record<string, unknown> | "skip",
  cacheKey: string
): T | undefined {
  const live = useQuery(ref as never, args as never) as T | undefined;
  const [fallback, setFallback] = useState<T | undefined>(undefined);
  const lastWrittenRef = useRef<string>("");

  // Hydrate from cache once on mount (or when key changes).
  useEffect(() => {
    let alive = true;
    void cache.get<T>(cacheKey).then((data) => {
      if (alive && data !== null) setFallback(data);
    });
    return () => {
      alive = false;
    };
  }, [cacheKey]);

  // Persist whenever we get a fresh live result. Skip null/undefined —
  // those represent "loading" or "no access," not data worth caching.
  useEffect(() => {
    if (live === undefined || live === null) return;
    // Cheap dedup so we don't hammer IDB when Convex sends identity-stable
    // updates back-to-back.
    let serialised: string;
    try {
      serialised = JSON.stringify(live);
    } catch {
      return;
    }
    if (serialised === lastWrittenRef.current) return;
    lastWrittenRef.current = serialised;
    void cache.set(cacheKey, live);
  }, [live, cacheKey]);

  return live ?? fallback;
}

/** Write-through helper for one-off cache pokes from non-React code. */
export const offlineCache = cache;
