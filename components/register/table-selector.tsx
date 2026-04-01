"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useCallback } from "react";
import { Id } from "../../convex/_generated/dataModel";

type TableStatus = {
  tableId: Id<"tables">;
  tableName: string;
  zone?: string;
  capacity: number;
  status: "available" | "occupied";
  orderId?: Id<"orders">;
  orderTotal?: number;
  orderItemCount?: number;
};

type TableSelectorProps = {
  token: string;
  locationId: Id<"locations">;
  selectedTableId: Id<"tables"> | null;
  onSelectTable: (tableId: Id<"tables"> | null, orderId?: Id<"orders">) => void;
};

export function TableSelector({
  token,
  locationId,
  selectedTableId,
  onSelectTable,
}: TableSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const tableStatus = useQuery(
    api.tables.queries.getTableStatus,
    token && locationId ? { token, locationId } : "skip"
  ) as TableStatus[] | undefined;

  const handleSelect = useCallback(
    (table: TableStatus) => {
      if (table.status === "occupied" && table.orderId) {
        // Switch to the occupied table's order
        onSelectTable(table.tableId, table.orderId);
      } else {
        // Assign this available table
        onSelectTable(table.tableId);
      }
      setIsOpen(false);
    },
    [onSelectTable]
  );

  const handleTakeout = useCallback(() => {
    onSelectTable(null);
    setIsOpen(false);
  }, [onSelectTable]);

  // Find selected table name
  const selectedTable = tableStatus?.find(
    (t: TableStatus) => t.tableId === selectedTableId
  );

  // Group by zone
  const grouped: Record<string, TableStatus[]> = {};
  if (tableStatus) {
    for (const t of tableStatus) {
      const zone = t.zone ?? "Other";
      if (!grouped[zone]) grouped[zone] = [];
      grouped[zone].push(t);
    }
  }
  const zones = Object.keys(grouped).sort();

  // Don't render if no tables configured
  if (tableStatus && tableStatus.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-2 text-sm hover:bg-stone-50 rounded-xl transition-colors flex items-center justify-center gap-2"
        style={{ color: selectedTableId ? "var(--fg)" : "var(--muted-fg)" }}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
          />
        </svg>
        {selectedTable ? selectedTable.tableName : "No Table / Takeout"}
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="absolute left-0 right-0 top-full z-50 mt-1 rounded-2xl shadow-xl overflow-hidden max-h-80 overflow-y-auto"
            style={{
              backgroundColor: "var(--card)",
              borderColor: "var(--border-color)",
              borderWidth: "1px",
            }}
          >
            {/* Takeout option */}
            <button
              onClick={handleTakeout}
              className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                !selectedTableId ? "bg-amber-50 text-amber-900" : ""
              }`}
              style={selectedTableId ? { color: "var(--fg)" } : undefined}
            >
              No Table / Takeout
            </button>

            <div
              className="h-px"
              style={{ backgroundColor: "var(--border-color)" }}
            />

            {!tableStatus ? (
              <div className="px-4 py-3 text-sm" style={{ color: "var(--muted-fg)" }}>
                Loading tables...
              </div>
            ) : (
              zones.map((zone: string) => (
                <div key={zone}>
                  <div
                    className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
                    style={{
                      color: "var(--muted-fg)",
                      backgroundColor: "var(--muted)",
                    }}
                  >
                    {zone}
                  </div>
                  {grouped[zone].map((table: TableStatus) => (
                    <button
                      key={table.tableId}
                      onClick={() => handleSelect(table)}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
                        selectedTableId === table.tableId
                          ? "bg-amber-50 text-amber-900"
                          : "hover:bg-stone-50"
                      }`}
                      style={
                        selectedTableId !== table.tableId
                          ? { color: "var(--fg)" }
                          : undefined
                      }
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            table.status === "available"
                              ? "bg-emerald-500"
                              : "bg-amber-500"
                          }`}
                        />
                        {table.tableName}
                        <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
                          ({table.capacity})
                        </span>
                      </span>
                      {table.status === "occupied" && (
                        <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
                          {table.orderItemCount} items
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
