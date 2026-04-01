"use client";

import { useState } from"react";
import { useQuery } from"convex/react";
import { api } from"../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { Id } from"../../../convex/_generated/dataModel";
import { StartShiftDialog } from"@/components/shifts/start-shift-dialog";
import { EndShiftDialog } from"@/components/shifts/end-shift-dialog";

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
 status:"active" |"closed";
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
 month:"short",
 day:"numeric",
 hour:"numeric",
 minute:"2-digit",
 });
}

function VarianceBadge({ variance }: { variance?: number }) {
 if (variance === undefined) {
 return <span style={{ color: 'var(--muted-fg)' }}>-</span>;
 }
 const abs = Math.abs(variance);
 let colorClass ="text-green-400 bg-green-500/10";
 if (abs > 500) {
 colorClass ="text-red-600 bg-red-500/10";
 } else if (abs > 0) {
 colorClass ="text-amber-600 bg-amber-500/10";
 }

 return (
 <span className={`inline-flex px-2 py-0.5 rounded-2xl text-xs font-medium ${colorClass}`}>
 {variance >= 0 ?"+" :""}
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
 token ? { token } :"skip"
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
 :"skip"
 ) as ShiftRow[] | undefined;

 const activeShift = useQuery(
 api.shifts.queries.getActiveShift,
 token && defaultLocationId
 ? { token, locationId: defaultLocationId }
 :"skip"
 ) as ShiftRow | null | undefined;

 if (!token || !session) {
 return (
 <div className="flex items-center justify-center py-20">
 <p style={{ color: 'var(--muted-fg)' }}>Loading...</p>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold">Shifts</h1>
 <p className="text-sm mt-1">
 Track shift hours and cash drawer management
 </p>
 </div>
 <div className="flex items-center gap-3">
 {activeShift && (
 <button
 onClick={() => setEndingShift(activeShift)}
 className="px-4 py-2.5 rounded-xl text-sm font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
 >
 End Shift
 </button>
 )}
 <button
 onClick={() => setShowStartDialog(true)}
 className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
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
 className="rounded-xl px-3 py-2 text-sm focus:ring-amber-500/20 focus:border-amber-500 outline-none"
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
 <div className="rounded-2xl p-4 flex items-center justify-between" style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
 <div className="flex items-center gap-3">
 <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
 <span className="text-sm font-medium text-green-400">
 Active shift since{""}
 {new Date(activeShift.startedAt).toLocaleTimeString()} (
 {formatDuration(activeShift.startedAt)})
 </span>
 </div>
 </div>
 )}

 {/* Table */}
 <div className="rounded-2xl border shadow-lg overflow-hidden" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b" style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
 <th className="text-left px-4 py-3 font-medium">
 Date
 </th>
 <th className="text-left px-4 py-3 font-medium">
 Staff
 </th>
 <th className="text-left px-4 py-3 font-medium">
 Duration
 </th>
 <th className="text-right px-4 py-3 font-medium">
 Opening
 </th>
 <th className="text-right px-4 py-3 font-medium">
 Closing
 </th>
 <th className="text-right px-4 py-3 font-medium">
 Expected
 </th>
 <th className="text-center px-4 py-3 font-medium">
 Variance
 </th>
 <th className="text-right px-4 py-3 font-medium">
 Orders
 </th>
 <th className="text-right px-4 py-3 font-medium">
 Revenue
 </th>
 <th className="text-center px-4 py-3 font-medium">
 Status
 </th>
 </tr>
 </thead>
 <tbody>
 {!shifts ? (
 <tr>
 <td colSpan={10} className="text-center py-8">
 Loading shifts...
 </td>
 </tr>
 ) : shifts.length === 0 ? (
 <tr>
 <td colSpan={10} className="text-center py-8">
 No shifts found
 </td>
 </tr>
 ) : (
 shifts.map((shift: ShiftRow) => (
 <tr
 key={shift._id}
 className="border-b border-stone-50 hover: transition-colors"
 >
 <td className="px-4 py-3">
 {formatDate(shift.startedAt)}
 </td>
 <td className="px-4 py-3">
 {shift.userName}
 </td>
 <td className="px-4 py-3">
 {formatDuration(shift.startedAt, shift.endedAt)}
 </td>
 <td className="px-4 py-3 text-right">
 {formatCurrency(shift.openingCash)}
 </td>
 <td className="px-4 py-3 text-right">
 {shift.closingCash !== undefined
 ? formatCurrency(shift.closingCash)
 :"-"}
 </td>
 <td className="px-4 py-3 text-right">
 {shift.expectedCash !== undefined
 ? formatCurrency(shift.expectedCash)
 :"-"}
 </td>
 <td className="px-4 py-3 text-center">
 <VarianceBadge variance={shift.variance} />
 </td>
 <td className="px-4 py-3 text-right">
 {shift.orderCount}
 </td>
 <td className="px-4 py-3 text-right">
 {formatCurrency(shift.totalRevenue)}
 </td>
 <td className="px-4 py-3 text-center">
 {shift.status ==="active" ? (
 <span className="inline-flex px-2 py-0.5 rounded-2xl text-xs font-medium text-green-400 bg-green-500/10">
 Active
 </span>
 ) : (
 <span className="inline-flex px-2 py-0.5 rounded-2xl text-xs font-medium">
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
