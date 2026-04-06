"use client";

import { useQuery } from"convex/react";
import { api } from"../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useState, useCallback } from"react";
import { Pagination, usePagination } from"@/components/ui/pagination";

type AuditEntry = {
 _id: string;
 action: string;
 entityType: string;
 entityId: string;
 changes: unknown;
 userName: string;
 timestamp: number;
};

const ENTITY_TYPES = [
 { value:"", label:"All Entity Types" },
 { value:"categories", label:"Categories" },
 { value:"menuItems", label:"Menu Items" },
 { value:"users", label:"Users" },
 { value:"orders", label:"Orders" },
 { value:"locations", label:"Locations" },
 { value:"modifierGroups", label:"Modifier Groups" },
 { value:"modifiers", label:"Modifiers" },
 { value:"tenantSettings", label:"Settings" },
];

function formatTimestamp(ts: number): string {
 return new Date(ts).toLocaleString();
}

function formatChanges(changes: unknown): string {
 try {
 return JSON.stringify(changes, null, 2);
 } catch {
 return String(changes);
 }
}

export default function AuditLogPage() {
 const { session, token } = useAuth();

 const [entityType, setEntityType] = useState("");
 const [actionSearch, setActionSearch] = useState("");
 const [startDate, setStartDate] = useState("");
 const [endDate, setEndDate] = useState("");
 const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

 const startTimestamp = startDate
 ? new Date(startDate).getTime()
 : undefined;
 const endTimestamp = endDate
 ? new Date(endDate +"T23:59:59.999").getTime()
 : undefined;

 const queryArgs = token
 ? {
 token,
 limit: 100,
 entityType: entityType || undefined,
 action: actionSearch || undefined,
 startDate: startTimestamp,
 endDate: endTimestamp,
 }
 :"skip";

 const auditEntries = useQuery(api.audit.queries.listAuditLog, queryArgs);

 const toggleRow = useCallback((id: string) => {
 setExpandedRows((prev) => {
 const next = new Set(prev);
 if (next.has(id)) {
 next.delete(id);
 } else {
 next.add(id);
 }
 return next;
 });
 }, []);

 if (!token || !session) {
 return (
 <div className="flex items-center justify-center h-64">
 <p style={{ color: 'var(--muted-fg)' }}>Loading...</p>
 </div>
 );
 }

 const typedEntries = auditEntries as AuditEntry[] | undefined;

 const { paginatedItems: paginatedEntries, currentPage: auditPage, totalPages: auditTotalPages, setCurrentPage: setAuditPage } = usePagination(typedEntries ?? []);

 return (
 <div>
 <div className="mb-8">
 <h1 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>Audit Log</h1>
 <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>
 View a history of all actions performed in your organization.
 </p>
 </div>

 {/* Filter Bar */}
 <div className="rounded-2xl border shadow-lg p-4 mb-6">
 <div className="flex flex-wrap gap-3 items-center">
 <select
 value={entityType}
 onChange={(e) => setEntityType(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 {ENTITY_TYPES.map((et: { value: string; label: string }) => (
 <option key={et.value} value={et.value}>
 {et.label}
 </option>
 ))}
 </select>

 <input
 type="text"
 placeholder="Search action..."
 value={actionSearch}
 onChange={(e) => setActionSearch(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />

 <div className="flex items-center gap-2 text-sm">
 <label style={{ color: 'var(--muted-fg)' }}>From:</label>
 <input
 type="date"
 value={startDate}
 onChange={(e) => setStartDate(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />
 </div>

 <div className="flex items-center gap-2 text-sm">
 <label style={{ color: 'var(--muted-fg)' }}>To:</label>
 <input
 type="date"
 value={endDate}
 onChange={(e) => setEndDate(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />
 </div>

 {(entityType || actionSearch || startDate || endDate) && (
 <button
 onClick={() => {
 setEntityType("");
 setActionSearch("");
 setStartDate("");
 setEndDate("");
 }}
 className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
 >
 Clear filters
 </button>
 )}
 </div>
 </div>

 {/* Table */}
 <div className="rounded-3xl shadow-lg overflow-hidden overflow-x-auto" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <table className="w-full">
 <thead>
 <tr style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
 <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest w-8" style={{ color: 'var(--muted-fg)' }} />
 <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Timestamp
 </th>
 <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 User
 </th>
 <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Action
 </th>
 <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Entity Type
 </th>
 <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Entity ID
 </th>
 </tr>
 </thead>
 <tbody>
 {typedEntries === undefined ? (
 <tr>
 <td
 colSpan={6}
 className="px-5 py-12 text-center"
 style={{ color: 'var(--muted-fg)' }}
 >
 Loading audit log...
 </td>
 </tr>
 ) : paginatedEntries.length > 0 ? (
 paginatedEntries.map((entry: AuditEntry) => {
 const isExpanded = expandedRows.has(entry._id);
 return (
 <tr
 key={entry._id}
 className="transition-colors group"
 style={{ borderBottom: '1px solid var(--border-color)' }}
 >
 <td colSpan={6} className="p-0">
 <div
 className="flex items-center cursor-pointer"
 onClick={() => toggleRow(entry._id)}
 role="button"
 tabIndex={0}
 onKeyDown={(e) => {
 if (e.key ==="Enter" || e.key ==="") {
 toggleRow(entry._id);
 }
 }}
 >
 <div className="px-5 py-3.5 w-8 text-xs shrink-0">
 {isExpanded ?"\u25BC" :"\u25B6"}
 </div>
 <div className="px-4 py-3.5 text-sm whitespace-nowrap shrink-0 w-48">
 {formatTimestamp(entry.timestamp)}
 </div>
 <div className="px-4 py-3.5 text-sm font-medium shrink-0 w-36" style={{ color: 'var(--fg)' }}>
 {entry.userName}
 </div>
 <div className="px-4 py-3.5 shrink-0 w-40">
 <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-400">
 {entry.action}
 </span>
 </div>
 <div className="px-4 py-3.5 text-sm capitalize shrink-0 w-36">
 {entry.entityType}
 </div>
 <div className="px-4 py-3.5 text-sm font-mono truncate">
 {entry.entityId}
 </div>
 </div>
 {isExpanded && (
 <div className="px-5 pb-4 pl-12">
 <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--muted)' }}>
 <div className="text-xs font-medium uppercase tracking-wide mb-2">
 Changes
 </div>
 <pre className="text-xs whitespace-pre-wrap wrap-break-word max-h-64 overflow-y-auto">
 {formatChanges(entry.changes)}
 </pre>
 </div>
 </div>
 )}
 </td>
 </tr>
 );
 })
 ) : (
 <tr>
 <td
 colSpan={6}
 className="px-5 py-12 text-center"
 style={{ color: 'var(--muted-fg)' }}
 >
 No audit log entries found.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 <Pagination currentPage={auditPage} totalPages={auditTotalPages} onPageChange={setAuditPage} />
 </div>
 </div>
 );
}
