"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { StartShiftDialog } from "./start-shift-dialog";
import { EndShiftDialog } from "./end-shift-dialog";
import { ShiftReportDialog } from "./shift-report-dialog";
import { PrinterSettings } from "@/components/register/printer-settings";

type ShiftIndicatorProps = {
  locationId: Id<"locations">;
  onLock?: () => void;
};

type ActiveShift = {
  _id: Id<"shifts">;
  startedAt: number;
  openingCash: number;
};

export function ShiftIndicator({ locationId, onLock }: ShiftIndicatorProps) {
  const { token } = useAuth();
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [showXReport, setShowXReport] = useState(false);
  const [showZReport, setShowZReport] = useState(false);

  const activeShift = useQuery(
    api.shifts.queries.getActiveShift,
    token ? { token, locationId } : "skip"
  ) as ActiveShift | null | undefined;

  if (!token) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs" style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border-color)', color: 'var(--card-fg)' }}>
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
              className="ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95"
              style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
            >
              Start Shift
            </button>
          </div>
        ) : (
          <span style={{ color: 'var(--muted-fg)' }}>Loading...</span>
        )}

        {/* Right: shift actions + printer + lock */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeShift && (
            <button
              onClick={() => setShowXReport(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
              title="Mid-shift sales snapshot (does not close the shift)"
            >
              X Report
            </button>
          )}
          <button
            onClick={() => setShowZReport(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
            title="Today's totals at this location"
          >
            Z Report
          </button>
          {activeShift && (
            <button
              onClick={() => setShowEnd(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors active:scale-95"
              style={{ backgroundColor: '#ef4444', color: 'white' }}
              title="Close this shift and reconcile cash"
            >
              End Shift
            </button>
          )}
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

      {showEnd && activeShift && (
        <EndShiftDialog
          shiftId={activeShift._id}
          startedAt={activeShift.startedAt}
          openingCash={activeShift.openingCash}
          onClose={() => setShowEnd(false)}
          onEnded={() => setShowEnd(false)}
        />
      )}

      {showXReport && activeShift && (
        <ShiftReportDialog
          mode="X"
          shiftId={activeShift._id}
          locationId={locationId}
          onClose={() => setShowXReport(false)}
        />
      )}

      {showZReport && (
        <ShiftReportDialog
          mode="Z"
          locationId={locationId}
          onClose={() => setShowZReport(false)}
        />
      )}
    </>
  );
}
