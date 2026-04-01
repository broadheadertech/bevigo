"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { StartShiftDialog } from "./start-shift-dialog";
import { PrinterSettings } from "@/components/register/printer-settings";

type ShiftIndicatorProps = {
  locationId: Id<"locations">;
  onLock?: () => void;
};

export function ShiftIndicator({ locationId, onLock }: ShiftIndicatorProps) {
  const { token } = useAuth();
  const [showStart, setShowStart] = useState(false);

  const activeShift = useQuery(
    api.shifts.queries.getActiveShift,
    token ? { token, locationId } : "skip"
  ) as { startedAt: number } | null | undefined;

  if (!token) return null;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-1.5 text-xs" style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border-color)', color: 'var(--card-fg)' }}>
        {/* Left: shift status */}
        {activeShift ? (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span>
              Shift started at{" "}
              {new Date(activeShift.startedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
        ) : activeShift === null ? (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-stone-500" />
            <span style={{ color: 'var(--muted-fg)' }}>No active shift</span>
            <button
              onClick={() => setShowStart(true)}
              className="ml-2 px-2 py-0.5 rounded-md text-xs transition-colors"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)' }}
            >
              Start
            </button>
          </div>
        ) : (
          <span style={{ color: 'var(--muted-fg)' }}>Loading...</span>
        )}

        {/* Right: printer + lock */}
        <div className="flex items-center gap-2">
          <PrinterSettings />
          {onLock && (
            <button
              onClick={onLock}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-fg)' }}
              aria-label="Lock register"
              title="Lock register"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showStart && (
        <StartShiftDialog
          locationId={locationId}
          onClose={() => setShowStart(false)}
          onStarted={() => setShowStart(false)}
        />
      )}
    </>
  );
}
