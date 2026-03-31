"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useCallback } from "react";

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
  { value: "", label: "All Entity Types" },
  { value: "categories", label: "Categories" },
  { value: "menuItems", label: "Menu Items" },
  { value: "users", label: "Users" },
  { value: "orders", label: "Orders" },
  { value: "locations", label: "Locations" },
  { value: "modifierGroups", label: "Modifier Groups" },
  { value: "modifiers", label: "Modifiers" },
  { value: "tenantSettings", label: "Settings" },
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
    ? new Date(endDate + "T23:59:59.999").getTime()
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
    : "skip";

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
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  const typedEntries = auditEntries as AuditEntry[] | undefined;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-stone-900">Audit Log</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          View a history of all actions performed in your organization.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
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
            className="border border-stone-200 rounded-xl px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
          />

          <div className="flex items-center gap-2 text-sm">
            <label className="text-stone-500">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <label className="text-stone-500">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
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
              className="text-sm font-medium text-amber-700 hover:text-amber-800 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50/50 border-b border-stone-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide w-8" />
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                Timestamp
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                User
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                Action
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                Entity Type
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                Entity ID
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {typedEntries === undefined ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-stone-400"
                >
                  Loading audit log...
                </td>
              </tr>
            ) : typedEntries.length > 0 ? (
              typedEntries.map((entry: AuditEntry) => {
                const isExpanded = expandedRows.has(entry._id);
                return (
                  <tr
                    key={entry._id}
                    className="hover:bg-stone-50/50 transition-colors group"
                  >
                    <td colSpan={6} className="p-0">
                      <div
                        className="flex items-center cursor-pointer"
                        onClick={() => toggleRow(entry._id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            toggleRow(entry._id);
                          }
                        }}
                      >
                        <div className="px-5 py-3.5 w-8 text-stone-400 text-xs shrink-0">
                          {isExpanded ? "\u25BC" : "\u25B6"}
                        </div>
                        <div className="px-4 py-3.5 text-sm text-stone-600 whitespace-nowrap shrink-0 w-48">
                          {formatTimestamp(entry.timestamp)}
                        </div>
                        <div className="px-4 py-3.5 text-sm font-medium text-stone-900 shrink-0 w-36">
                          {entry.userName}
                        </div>
                        <div className="px-4 py-3.5 shrink-0 w-40">
                          <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-800">
                            {entry.action}
                          </span>
                        </div>
                        <div className="px-4 py-3.5 text-sm text-stone-600 capitalize shrink-0 w-36">
                          {entry.entityType}
                        </div>
                        <div className="px-4 py-3.5 text-sm text-stone-400 font-mono truncate">
                          {entry.entityId}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-5 pb-4 pl-12">
                          <div className="bg-stone-50 rounded-xl p-4 text-sm">
                            <div className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">
                              Changes
                            </div>
                            <pre className="text-xs text-stone-700 whitespace-pre-wrap wrap-break-word max-h-64 overflow-y-auto">
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
                  className="px-5 py-12 text-center text-stone-400"
                >
                  No audit log entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
