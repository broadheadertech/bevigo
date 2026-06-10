"use client";

import { useEffect, useState } from "react";
import { queue, type QueueEntry } from "@/lib/offline/db";
import {
  discardEntry,
  kickReplay,
  retryEntry,
  subscribeReplay,
  type ReplayState,
} from "@/lib/offline/queue-replay";
import { useConnectionStatus } from "@/hooks/use-connection-status";

export default function OfflineQueuePage() {
  const { isOnline } = useConnectionStatus();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [replay, setReplay] = useState<ReplayState>({
    isReplaying: false,
    queueDepth: 0,
    failed: 0,
    deadLetter: 0,
    lastError: null,
  });

  // Subscribe to replay state. We refresh the entries list whenever the
  // replay state shifts — that catches successful flushes and attempt
  // bumps without polling.
  useEffect(() => {
    const unsub = subscribeReplay(setReplay);
    return unsub;
  }, []);

  useEffect(() => {
    let alive = true;
    void queue.list().then((all) => {
      if (alive) setEntries(all);
    });
    return () => {
      alive = false;
    };
  }, [replay.queueDepth, replay.isReplaying, replay.failed, replay.deadLetter]);

  const handleRetry = async (id: string) => {
    await retryEntry(id);
  };
  const handleDiscard = async (id: string) => {
    if (!confirm("Permanently discard this mutation? It cannot be replayed.")) {
      return;
    }
    await discardEntry(id);
  };
  const handleKick = async () => {
    await kickReplay();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: "var(--muted-fg)" }}
          >
            Offline mode
          </p>
          <h1 className="text-2xl font-bold mt-1">Sync queue</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-fg)" }}>
            Mutations that couldn't reach the server during an outage. They
            replay automatically when the device comes back online.
          </p>
        </div>
        <button
          onClick={handleKick}
          disabled={!isOnline || replay.isReplaying || entries.length === 0}
          className="px-4 py-2 rounded-2xl text-sm font-semibold disabled:opacity-40"
          style={{
            backgroundColor: "var(--accent-color)",
            color: "white",
          }}
        >
          {replay.isReplaying ? "Syncing…" : "Sync now"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Kpi label="In queue" value={String(entries.length)} />
        <Kpi
          label="Retrying"
          value={String(replay.failed)}
          tone={replay.failed > 0 ? "warning" : undefined}
        />
        <Kpi
          label="Failed"
          value={String(replay.deadLetter)}
          tone={replay.deadLetter > 0 ? "error" : undefined}
        />
      </div>

      <div
        className="rounded-3xl overflow-hidden"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        {entries.length === 0 ? (
          <p
            className="p-8 text-center text-sm"
            style={{ color: "var(--muted-fg)" }}
          >
            The queue is empty. Every offline mutation has been replayed.
          </p>
        ) : (
          <ul>
            {entries.map((e) => {
              const dead = e.attempts >= 8;
              const failed = e.attempts > 0 && !dead;
              return (
                <li
                  key={e.id}
                  className="px-4 py-3 flex items-start justify-between gap-3"
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: dead
                            ? "rgba(239,68,68,0.15)"
                            : failed
                              ? "rgba(245,158,11,0.15)"
                              : "var(--muted)",
                          color: dead
                            ? "#b91c1c"
                            : failed
                              ? "#b45309"
                              : "var(--muted-fg)",
                        }}
                      >
                        {dead ? "Failed" : failed ? "Retrying" : "Queued"}
                      </span>
                      <code
                        className="text-xs font-mono"
                        style={{ color: "var(--fg)" }}
                      >
                        {e.fn}
                      </code>
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        attempts: {e.attempts}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        queued {new Date(e.queuedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    {e.lastError && (
                      <p
                        className="text-[11px] mt-1 italic font-mono"
                        style={{ color: "#b91c1c" }}
                      >
                        {e.lastError}
                      </p>
                    )}
                    <details className="mt-1">
                      <summary
                        className="text-[10px] cursor-pointer"
                        style={{ color: "var(--muted-fg)" }}
                      >
                        Args
                      </summary>
                      <pre
                        className="text-[10px] mt-1 p-2 rounded-2xl overflow-x-auto whitespace-pre-wrap"
                        style={{
                          backgroundColor: "var(--muted)",
                          color: "var(--muted-fg)",
                        }}
                      >
                        {JSON.stringify(e.args, null, 2)}
                      </pre>
                    </details>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {dead && (
                      <button
                        onClick={() => handleRetry(e.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                        style={{
                          backgroundColor: "var(--accent-color)",
                          color: "white",
                        }}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() => handleDiscard(e.id)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{
                        backgroundColor: "var(--muted)",
                        color: "#ef4444",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      Discard
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "error";
}) {
  const accent =
    tone === "error"
      ? { bg: "rgba(239,68,68,0.1)", fg: "#b91c1c" }
      : tone === "warning"
        ? { bg: "rgba(245,158,11,0.1)", fg: "#b45309" }
        : null;
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: accent ? accent.bg : "var(--card)",
        color: accent ? accent.fg : "var(--fg)",
        border: "1px solid var(--border-color)",
      }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-1"
        style={{ color: accent ? accent.fg : "var(--muted-fg)" }}
      >
        {label}
      </p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
