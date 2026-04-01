"use client";

import { useQuery } from"convex/react";
import { api } from"../../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useState, useMemo, useCallback } from"react";
import { Id } from"../../../../convex/_generated/dataModel";
import { exportToCSV } from"@/lib/export";
import { formatCurrency } from"@/lib/currency";

type LocationOption = {
 _id: Id<"locations">;
 name: string;
 slug: string;
 status: string;
};

type StaffRow = {
 userName: string;
 role: string;
 orderCount: number;
 totalRevenue: number;
 avgOrderValue: number;
};

type SortKey ="userName" |"role" |"orderCount" |"totalRevenue" |"avgOrderValue";

function todayStart(): number {
 const now = new Date();
 return new Date(
 Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
 ).getTime();
}

function dateToTimestamp(dateStr: string): number {
 const parts = dateStr.split("-");
 return Date.UTC(
 parseInt(parts[0], 10),
 parseInt(parts[1], 10) - 1,
 parseInt(parts[2], 10)
 );
}

function timestampToDateStr(ts: number): string {
 const d = new Date(ts);
 const year = d.getUTCFullYear();
 const month = String(d.getUTCMonth() + 1).padStart(2,"0");
 const day = String(d.getUTCDate()).padStart(2,"0");
 return `${year}-${month}-${day}`;
}

export default function StaffPerformancePage() {
 const { session, token } = useAuth();

 const defaultStart = useMemo(() => todayStart(), []);

 const [startDateStr, setStartDateStr] = useState(
 timestampToDateStr(defaultStart)
 );
 const [endDateStr, setEndDateStr] = useState(
 timestampToDateStr(defaultStart)
 );
 const [selectedLocationId, setSelectedLocationId] = useState<string>("");
 const [sortKey, setSortKey] = useState<SortKey>("totalRevenue");
 const [sortDir, setSortDir] = useState<"asc" |"desc">("desc");

 const startDate = useMemo(
 () => dateToTimestamp(startDateStr),
 [startDateStr]
 );
 const endDate = useMemo(
 () => dateToTimestamp(endDateStr) + 24 * 60 * 60 * 1000 - 1,
 [endDateStr]
 );

 const locationId = selectedLocationId
 ? (selectedLocationId as Id<"locations">)
 : undefined;

 const locations = useQuery(
 api.settings.queries.listLocations,
 token ? { token } :"skip"
 ) as LocationOption[] | undefined;

 const availableLocations = useMemo(() => {
 if (!locations || !session) return [];
 if (session.role ==="owner") return locations;
 return locations.filter((loc: LocationOption) =>
 session.locationIds.includes(loc._id)
 );
 }, [locations, session]);

 const staffData = useQuery(
 api.reports.queries.staffPerformance,
 token ? { token, startDate, endDate, locationId } :"skip"
 ) as StaffRow[] | undefined;

 const handleSort = useCallback(
 (key: SortKey) => {
 if (sortKey === key) {
 setSortDir(sortDir ==="asc" ?"desc" :"asc");
 } else {
 setSortKey(key);
 setSortDir("desc");
 }
 },
 [sortKey, sortDir]
 );

 const sortedData = useMemo(() => {
 if (!staffData) return undefined;
 const copy = [...staffData];
 copy.sort((a: StaffRow, b: StaffRow) => {
 const aVal = a[sortKey];
 const bVal = b[sortKey];
 if (typeof aVal ==="string" && typeof bVal ==="string") {
 return sortDir ==="asc"
 ? aVal.localeCompare(bVal)
 : bVal.localeCompare(aVal);
 }
 const numA = aVal as number;
 const numB = bVal as number;
 return sortDir ==="asc" ? numA - numB : numB - numA;
 });
 return copy;
 }, [staffData, sortKey, sortDir]);

 if (!token || !session) {
 return (
 <div className="flex items-center justify-center h-64">
 <p style={{ color: 'var(--muted-fg)' }}>Loading...</p>
 </div>
 );
 }

 const sortIndicator = (key: SortKey) => {
 if (sortKey !== key) return"";
 return sortDir ==="asc" ?" \u2191" :" \u2193";
 };

 return (
 <div>
 <div className="mb-8">
 <h1 className="text-lg md:text-xl font-bold" style={{ color: 'var(--fg)' }}>
 Staff Performance
 </h1>
 <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>
 Track order volume and revenue by team member
 </p>
 </div>

 {/* Filter Bar */}
 <div className="rounded-2xl border shadow-lg p-4 mb-6">
 <div className="flex flex-wrap gap-4 items-end">
 <div>
 <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 Start Date
 </label>
 <input
 type="date"
 value={startDateStr}
 onChange={(e) => setStartDateStr(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />
 </div>
 <div>
 <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 End Date
 </label>
 <input
 type="date"
 value={endDateStr}
 onChange={(e) => setEndDateStr(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />
 </div>
 <div>
 <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 Location
 </label>
 <select
 value={selectedLocationId}
 onChange={(e) => setSelectedLocationId(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 <option value="">All Locations</option>
 {availableLocations.map((loc: LocationOption) => (
 <option key={loc._id} value={loc._id}>
 {loc.name}
 </option>
 ))}
 </select>
 </div>
 <button
 onClick={() => {
 if (!sortedData) return;
 exportToCSV(
 sortedData.map((r: StaffRow) => ({
 Name: r.userName,
 Role: r.role,
 Orders: r.orderCount,
"Total Revenue": r.totalRevenue,
"Avg Order Value": r.avgOrderValue,
 })),
"staff-performance.csv"
 );
 }}
 className="px-3 py-2 text-sm rounded-xl"
 >
 Export CSV
 </button>
 </div>
 </div>

 {/* Table */}
 {!sortedData ? (
 <div className="text-center py-12">
 Loading staff data...
 </div>
 ) : sortedData.length === 0 ? (
 <div className="text-center py-12">
 No completed orders for this period.
 </div>
 ) : (
 <div className="rounded-2xl border shadow-lg overflow-hidden overflow-x-auto" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <table className="w-full min-w-[550px]">
 <thead className="border-b" style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
 <tr>
 {(
 [
 { key:"userName" as SortKey, label:"Name" },
 { key:"role" as SortKey, label:"Role" },
 { key:"orderCount" as SortKey, label:"Orders" },
 { key:"totalRevenue" as SortKey, label:"Total Revenue" },
 { key:"avgOrderValue" as SortKey, label:"Avg Order Value" },
 ] as Array<{ key: SortKey; label: string }>
 ).map((col: { key: SortKey; label: string }) => (
 <th
 key={col.key}
 onClick={() => handleSort(col.key)}
 className={`${col.key ==="userName" || col.key ==="role" ?"text-left" :"text-right"} px-5 py-3 text-xs font-medium uppercase tracking-wide cursor-pointer select-none`}
 >
 {col.label}
 {sortIndicator(col.key)}
 </th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-stone-100">
 {sortedData.map((row: StaffRow, idx: number) => (
 <tr
 key={`${row.userName}-${idx}`}
 className="hover: transition-colors"
 >
 <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--fg)' }}>
 {row.userName}
 </td>
 <td className="px-5 py-3.5 capitalize">
 {row.role}
 </td>
 <td className="px-5 py-3.5 text-right">
 {row.orderCount}
 </td>
 <td className="px-5 py-3.5 text-right">
 {formatCurrency(row.totalRevenue)}
 </td>
 <td className="px-5 py-3.5 text-right">
 {formatCurrency(row.avgOrderValue)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 );
}
