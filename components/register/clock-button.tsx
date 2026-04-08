"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { formatCurrency } from "@/lib/currency";

type Props = {
  locationId: Id<"locations">;
};

type ActiveTimesheet = {
  _id: Id<"timesheets">;
  clockInAt: number;
  locationId: Id<"locations">;
  locationName: string;
  status: "active" | "on_break" | "completed" | "auto_closed";
  activeBreakStartedAt?: number;
} | null;

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ClockButton({ locationId }: Props) {
  const { token } = useAuth();
  const active = useQuery(
    api.timesheets.queries.getActiveTimesheet,
    token ? { token } : "skip"
  ) as ActiveTimesheet | undefined;

  const clockIn = useMutation(api.timesheets.mutations.clockIn);
  const clockOut = useMutation(api.timesheets.mutations.clockOut);
  const startBreak = useMutation(api.timesheets.mutations.startBreak);
  const endBreak = useMutation(api.timesheets.mutations.endBreak);

  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleClockIn = async () => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await clockIn({ token, locationId });
      setToast(`Clocked in at ${formatTime(Date.now())}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to clock in");
    } finally {
      setBusy(false);
    }
  };

  const handleClockOut = async () => {
    if (!token || !active || busy) return;
    setBusy(true);
    try {
      const result = await clockOut({ token, timesheetId: active._id });
      const earned = result?.earnedAmount ?? 0;
      const minutes = result?.workMinutes ?? 0;
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      setToast(
        `Clocked out: ${h}h ${m}m worked, earned ${formatCurrency(earned)}`
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to clock out");
    } finally {
      setBusy(false);
      setShowConfirm(false);
    }
  };

  const handleStartBreak = async () => {
    if (!token || !active || busy) return;
    setBusy(true);
    try {
      await startBreak({ token, timesheetId: active._id });
      setToast("Break started");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to start break");
    } finally {
      setBusy(false);
    }
  };

  const handleEndBreak = async () => {
    if (!token || !active || busy) return;
    setBusy(true);
    try {
      const r = await endBreak({ token, timesheetId: active._id });
      setToast(`Break ended (${r.durationMinutes} min)`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to end break");
    } finally {
      setBusy(false);
    }
  };

  const isClockedIn = !!active;
  const isOnBreak = active?.status === "on_break";

  let confirmMessage = "Clock out now?";
  if (active) {
    const diffMs = Date.now() - active.clockInAt;
    const minutes = Math.floor(diffMs / 60000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    confirmMessage = `Clock out now? You worked ${h} hours ${m} minutes.`;
  }

  let breakIndicator: string | null = null;
  if (isOnBreak && active?.activeBreakStartedAt) {
    const breakMin = Math.floor((now - active.activeBreakStartedAt) / 60000);
    breakIndicator = `On break: ${breakMin} min`;
  }

  return (
    <>
      {!isClockedIn && (
        <button
          onClick={handleClockIn}
          disabled={busy || active === undefined}
          className="px-3 py-1 mr-3 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
          style={{
            backgroundColor: "var(--muted)",
            color: "var(--muted-fg)",
            border: "1px solid var(--border-color)",
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Clock In
        </button>
      )}

      {isClockedIn && !isOnBreak && (
        <>
          <button
            onClick={handleStartBreak}
            disabled={busy}
            className="px-3 py-1 mr-2 text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "rgba(245,158,11,0.1)",
              color: "rgb(245,158,11)",
              border: "1px solid rgba(245,158,11,0.3)",
            }}
          >
            Break
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={busy}
            className="px-3 py-1 mr-3 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
            style={{
              backgroundColor: "rgba(34,197,94,0.1)",
              color: "rgb(34,197,94)",
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Clock Out
          </button>
        </>
      )}

      {isOnBreak && (
        <>
          {breakIndicator && (
            <span
              className="px-2 py-1 mr-2 text-xs font-medium rounded-xl"
              style={{
                backgroundColor: "rgba(245,158,11,0.1)",
                color: "rgb(245,158,11)",
                border: "1px solid rgba(245,158,11,0.3)",
              }}
            >
              {breakIndicator}
            </span>
          )}
          <button
            onClick={handleEndBreak}
            disabled={busy}
            className="px-3 py-1 mr-3 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "var(--accent-color)",
              color: "white",
            }}
          >
            End Break
          </button>
        </>
      )}

      <ConfirmModal
        open={showConfirm}
        title="Clock Out"
        message={confirmMessage}
        confirmLabel="Clock Out"
        onConfirm={handleClockOut}
        onCancel={() => setShowConfirm(false)}
      />

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-2xl shadow-lg text-sm font-medium"
          style={{
            backgroundColor: "var(--card)",
            color: "var(--fg)",
            border: "1px solid var(--border-color)",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
