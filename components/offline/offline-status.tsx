"use client";

import { useEffect, useState } from "react";
import { useConvex } from "convex/react";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import {
  bindConvex,
  bindOnlineEvent,
  kickReplay,
  subscribeReplay,
  type ReplayState,
} from "@/lib/offline/queue-replay";

/**
 * Sticky status pill above the dashboard chrome. Visible only when
 * (a) the device is offline, or (b) there are queued/failed mutations
 * waiting to flush. When everything is green and the queue is empty,
 * we render nothing — silence is the success signal.
 */
export function OfflineStatus() {
  const { isOnline } = useConnectionStatus();
  const convex = useConvex();
  const [replay, setReplay] = useState<ReplayState>({
    isReplaying: false,
    queueDepth: 0,
    failed: 0,
    deadLetter: 0,
    lastError: null,
  });

  // Bind the live Convex client to the replay engine on mount. Cheap and
  // idempotent; the engine ignores rebinds with the same client.
  useEffect(() => {
    bindConvex(convex);
    bindOnlineEvent();
    return subscribeReplay(setReplay);
  }, [convex]);

  // Kick a replay any time we (re)enter online state with stuff queued.
  useEffect(() => {
    if (isOnline && replay.queueDepth > 0 && !replay.isReplaying) {
      void kickReplay();
    }
  }, [isOnline, replay.queueDepth, replay.isReplaying]);

  if (isOnline && replay.queueDepth === 0) return null;

  const tone = !isOnline
    ? "offline"
    : replay.deadLetter > 0
      ? "error"
      : replay.isReplaying
        ? "syncing"
        : "queued";

  const palette: Record<
    typeof tone,
    { bg: string; fg: string; border: string }
  > = {
    offline: {
      bg: "rgba(239,68,68,0.12)",
      fg: "#b91c1c",
      border: "rgba(239,68,68,0.25)",
    },
    error: {
      bg: "rgba(239,68,68,0.12)",
      fg: "#b91c1c",
      border: "rgba(239,68,68,0.25)",
    },
    syncing: {
      bg: "rgba(59,130,246,0.12)",
      fg: "#1d4ed8",
      border: "rgba(59,130,246,0.25)",
    },
    queued: {
      bg: "rgba(245,158,11,0.12)",
      fg: "#b45309",
      border: "rgba(245,158,11,0.25)",
    },
  };

  const colors = palette[tone];

  return (
    <div
      className="px-4 py-2 text-xs flex items-center gap-3 flex-wrap justify-center"
      style={{
        backgroundColor: colors.bg,
        color: colors.fg,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <span className="font-semibold">
        {tone === "offline"
          ? "Offline mode"
          : tone === "error"
            ? "Sync errors"
            : tone === "syncing"
              ? "Syncing…"
              : "Pending sync"}
      </span>

      <span>
        {tone === "offline"
          ? "Orders ring up locally and will sync once the network returns."
          : tone === "error"
            ? `${replay.deadLetter} order${replay.deadLetter === 1 ? "" : "s"} failed after 8 retries.`
            : tone === "syncing"
              ? `Replaying ${replay.queueDepth} queued mutation${replay.queueDepth === 1 ? "" : "s"}.`
              : `${replay.queueDepth} mutation${replay.queueDepth === 1 ? "" : "s"} waiting to flush.`}
      </span>

      {replay.lastError && tone !== "offline" && (
        <span className="text-[10px] italic opacity-80 truncate max-w-md">
          {replay.lastError}
        </span>
      )}

      {(replay.queueDepth > 0 || replay.deadLetter > 0) && (
        <a
          href="/offline-queue"
          className="text-[11px] font-semibold underline whitespace-nowrap"
          style={{ color: colors.fg }}
        >
          View queue →
        </a>
      )}
    </div>
  );
}
