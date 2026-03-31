"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../../convex/_generated/dataModel";
import { StartShiftDialog } from "@/components/shifts/start-shift-dialog";
import { EndShiftDialog } from "@/components/shifts/end-shift-dialog";

type ShiftRow = {
  _id: Id<"shifts">;
  locationId: Id<"locations">;
  userId: Id<"users">;
  userName: string;
  startedAt: number;
  endedAt?: number;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  variance?: number;
  orderCount: number;
  totalRevenue: number;
  status: "active" | "closed";
  notes?: string;
};

type LocationOption = {
  _id: Id<"locations">;
  name: string;
};

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDuration(startMs: number, endMs?: number): string {
  const diff = (endMs ?? Date.now()) - startMs;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function VarianceBadge({ variance }: { variance?: number }) {
  if (variance === undefined) {
    return <span className="text-stone-400">-</span>;
  }
  const abs = Math.abs(variance);
  let colorClass = "text-green-600 bg-green-50";
  if (abs > 500) {
    colorClass = "text-red-600 bg-red-50";
  } else if (abs > 0) {
    colorClass = "text-amber-600 bg-amber-50";
  }

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium ${colorClass}`}>
      {variance >= 0 ? "+" : ""}
      {formatCurrency(variance)}
    </span>
  );
}

export default function ShiftsPage() {
  const { token, session } = useAuth();
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [endingShift, setEndingShift] = useState<ShiftRow | null>(null);
  const [filterLocationId, setFilterLocationId] = useState<string>("");

  const locationIds = session?.locationIds as Id<"locations">[] | undefined;
  const defaultLocationId = locationIds?.[0];

  const locations = useQuery(
    api.settings.queries.listLocations,
    token ? { token } : "skip"
  ) as LocationOption[] | undefined;

  const shifts = useQuery(
    api.shifts.queries.listShifts,
    token
      ? {
          token,
          locationId: filterLocationId
            ? (filterLocationId as Id<"locations">)
            : undefined,
        }
      : "skip"
  ) as ShiftRow[] | undefined;

  const activeShift = useQuery(
    api.shifts.queries.getActiveShift,
    token && defaultLocationId
      ? { token, locationId: defaultLocationId }
      : "skip"
  ) as ShiftRow | null | undefined;

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-stone-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Shifts</h1>
          <p className="text-sm text-stone-500 mt-1">
            Track shift hours and cash drawer management
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeShift && (
            <button
              onClick={() => setEndingShift(activeShift)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
            >
              End Shift
            </button>
          )}
          <button
            onClick={() => setShowStartDialog(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-stone-900 text-white hover:bg-stone-800 transition-colors"
          >
            Start Shift
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterLocationId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setFilterLocationId(e.target.value)
          }
          className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
        >
          <option value="">All Locations</option>
          {(locations ?? []).map((loc: LocationOption) => (
            <option key={loc._id} value={loc._id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      {/* Active shift indicator */}
      {activeShift && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-800">
              Active shift since{" "}
              {new Date(activeShift.startedAt).toLocaleTimeString()} (
              {formatDuration(activeShift.startedAt)})
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-4 py-3 font-medium text-stone-500">
                  Date
                </th>
                <th className="text-left px-4 py-3 font-medium text-stone-500">
                  Staff
                </th>
                <th className="text-left px-4 py-3 font-medium text-stone-500">
                  Duration
                </th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">
                  Opening
                </th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">
                  Closing
                </th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">
                  Expected
                </th>
                <th className="text-center px-4 py-3 font-medium text-stone-500">
                  Variance
                </th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">
                  Orders
                </th>
                <th className="text-right px-4 py-3 font-medium text-stone-500">
                  Revenue
                </th>
                <th className="text-center px-4 py-3 font-medium text-stone-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {!shifts ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-stone-400">
                    Loading shifts...
                  </td>
                </tr>
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-stone-400">
                    No shifts found
                  </td>
                </tr>
              ) : (
                shifts.map((shift: ShiftRow) => (
                  <tr
                    key={shift._id}
                    className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-stone-900">
                      {formatDate(shift.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {shift.userName}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {formatDuration(shift.startedAt, shift.endedAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      {formatCurrency(shift.openingCash)}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      {shift.closingCash !== undefined
                        ? formatCurrency(shift.closingCash)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      {shift.expectedCash !== undefined
                        ? formatCurrency(shift.expectedCash)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <VarianceBadge variance={shift.variance} />
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      {shift.orderCount}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      {formatCurrency(shift.totalRevenue)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {shift.status === "active" ? (
                        <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium text-green-700 bg-green-50">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium text-stone-500 bg-stone-100">
                          Closed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Start Shift Dialog */}
      {showStartDialog && defaultLocationId && (
        <StartShiftDialog
          locationId={defaultLocationId}
          onClose={() => setShowStartDialog(false)}
          onStarted={() => setShowStartDialog(false)}
        />
      )}

      {/* End Shift Dialog */}
      {endingShift && (
        <EndShiftDialog
          shiftId={endingShift._id}
          startedAt={endingShift.startedAt}
          openingCash={endingShift.openingCash}
          onClose={() => setEndingShift(null)}
          onEnded={() => setEndingShift(null)}
        />
      )}
    </div>
  );
}
