"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { StartShiftDialog } from "./start-shift-dialog";

type ShiftIndicatorProps = {
  locationId: Id<"locations">;
};

export function ShiftIndicator({ locationId }: ShiftIndicatorProps) {
  const { token } = useAuth();
  const [showStart, setShowStart] = useState(false);

  const activeShift = useQuery(
    api.shifts.queries.getActiveShift,
    token ? { token, locationId } : "skip"
  ) as { startedAt: number } | null | undefined;

  if (!token) return null;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-1.5 bg-stone-900 text-white text-xs">
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
            <span className="text-stone-400">No active shift</span>
            <button
              onClick={() => setShowStart(true)}
              className="ml-2 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
            >
              Start
            </button>
          </div>
        ) : (
          <span className="text-stone-500">Loading...</span>
        )}
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
