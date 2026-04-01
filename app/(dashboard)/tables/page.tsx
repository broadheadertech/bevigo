"use client";

import { useQuery, useMutation } from"convex/react";
import { api } from"../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useState, useCallback } from"react";
import { Id } from"../../../convex/_generated/dataModel";
import {
 TableForm,
 TableFormData,
 TableData,
} from"@/components/tables/table-form";

type TableRow = {
 _id: Id<"tables">;
 name: string;
 zone?: string;
 capacity: number;
 sortOrder: number;
 status: string;
 occupied: boolean;
 orderId: Id<"orders"> | null;
};

export default function TablesPage() {
 const { token, session } = useAuth();

 const locationIds = session?.locationIds as Id<"locations">[] | undefined;
 const locationId = locationIds?.[0];

 const tables = useQuery(
 api.tables.queries.listTables,
 token && locationId ? { token, locationId } :"skip"
 ) as TableRow[] | undefined;

 const createTable = useMutation(api.tables.mutations.createTable);
 const updateTable = useMutation(api.tables.mutations.updateTable);
 const deleteTable = useMutation(api.tables.mutations.deleteTable);
 const seedTables = useMutation(api.tables.seed.seedTables);

 const [showForm, setShowForm] = useState(false);
 const [editingTable, setEditingTable] = useState<TableData | null>(null);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const openAdd = useCallback(() => {
 setEditingTable(null);
 setShowForm(true);
 setError(null);
 }, []);

 const openEdit = useCallback((table: TableRow) => {
 setEditingTable({
 _id: table._id,
 name: table.name,
 zone: table.zone ??"Indoor",
 capacity: table.capacity,
 sortOrder: table.sortOrder,
 status: table.status,
 });
 setShowForm(true);
 setError(null);
 }, []);

 const closeForm = useCallback(() => {
 setShowForm(false);
 setEditingTable(null);
 setError(null);
 }, []);

 const handleSubmit = useCallback(
 async (data: TableFormData) => {
 if (!token || !locationId) return;
 setIsSubmitting(true);
 setError(null);
 try {
 if (editingTable) {
 await updateTable({
 token,
 tableId: editingTable._id,
 name: data.name,
 zone: data.zone,
 capacity: data.capacity,
 sortOrder: data.sortOrder,
 });
 } else {
 await createTable({
 token,
 locationId,
 name: data.name,
 zone: data.zone,
 capacity: data.capacity,
 sortOrder: data.sortOrder,
 });
 }
 closeForm();
 } catch (err: unknown) {
 setError(err instanceof Error ? err.message :"Failed to save table");
 } finally {
 setIsSubmitting(false);
 }
 },
 [token, locationId, editingTable, createTable, updateTable, closeForm]
 );

 const handleDelete = useCallback(
 async (tableId: Id<"tables">) => {
 if (!token) return;
 if (!confirm("Delete this table?")) return;
 try {
 await deleteTable({ token, tableId });
 } catch (err: unknown) {
 setError(err instanceof Error ? err.message :"Failed to delete");
 }
 },
 [token, deleteTable]
 );

 const handleSeed = useCallback(async () => {
 if (!token || !locationId) return;
 setIsSubmitting(true);
 try {
 await seedTables({ token, locationId });
 } catch (err: unknown) {
 setError(err instanceof Error ? err.message :"Failed to seed tables");
 } finally {
 setIsSubmitting(false);
 }
 }, [token, locationId, seedTables]);

 const handleBulkAdd = useCallback(async () => {
 if (!token || !locationId) return;
 setIsSubmitting(true);
 setError(null);
 try {
 const existingCount = tables?.length ?? 0;
 for (let i = 1; i <= 10; i++) {
 await createTable({
 token,
 locationId,
 name: `Table ${existingCount + i}`,
 zone:"Indoor",
 capacity: 4,
 sortOrder: existingCount + i,
 });
 }
 } catch (err: unknown) {
 setError(err instanceof Error ? err.message :"Failed to bulk add");
 } finally {
 setIsSubmitting(false);
 }
 }, [token, locationId, tables, createTable]);

 if (!token) {
 return (
 <div className="flex items-center justify-center h-64">
 <p style={{ color:"var(--muted-fg)" }}>Loading...</p>
 </div>
 );
 }

 // Group tables by zone
 const grouped: Record<string, TableRow[]> = {};
 if (tables) {
 for (const table of tables) {
 const zone = table.zone ??"Unassigned";
 if (!grouped[zone]) grouped[zone] = [];
 grouped[zone].push(table);
 }
 // Sort within each zone by sortOrder
 for (const zone of Object.keys(grouped)) {
 grouped[zone].sort((a: TableRow, b: TableRow) => a.sortOrder - b.sortOrder);
 }
 }

 const zones = Object.keys(grouped).sort();

 return (
 <div className="max-w-5xl mx-auto px-4 py-8">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold" style={{ color:"var(--fg)" }}>
 Tables
 </h1>
 <p className="text-sm mt-1" style={{ color:"var(--muted-fg)" }}>
 Manage dine-in tables for your location
 </p>
 </div>
 <div className="flex gap-2">
 {(!tables || tables.length === 0) && (
 <button
 onClick={handleSeed}
 disabled={isSubmitting}
 className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
 style={{
 backgroundColor:"var(--muted)",
 color:"var(--fg)",
 borderColor:"var(--border-color)",
 borderWidth:"1px",
 }}
 >
 Seed Sample Tables
 </button>
 )}
 <button
 onClick={handleBulkAdd}
 disabled={isSubmitting}
 className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
 style={{
 backgroundColor:"var(--muted)",
 color:"var(--fg)",
 borderColor:"var(--border-color)",
 borderWidth:"1px",
 }}
 >
 + Add 10 Tables
 </button>
 <button
 onClick={openAdd}
 className="px-4 py-2 text-white rounded-xl text-sm font-medium"
 >
 + Add Table
 </button>
 </div>
 </div>

 {error && (
 <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm">
 {error}
 </div>
 )}

 {!tables ? (
 <div className="flex items-center justify-center h-32">
 <p style={{ color:"var(--muted-fg)" }}>Loading tables...</p>
 </div>
 ) : tables.length === 0 ? (
 <div className="text-center py-16">
 <div
 className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
 style={{ backgroundColor:"var(--muted)" }}
 >
 <svg
 className="w-8 h-8"
 style={{ color:"var(--muted-fg)" }}
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
 </div>
 <h3 className="font-semibold mb-1" style={{ color:"var(--fg)" }}>
 No tables yet
 </h3>
 <p className="text-sm mb-4" style={{ color:"var(--muted-fg)" }}>
 Add tables to enable dine-in orders at the register.
 </p>
 </div>
 ) : (
 <div className="space-y-6">
 {zones.map((zone: string) => (
 <div key={zone}>
 <h2
 className="text-sm font-semibold uppercase tracking-wider mb-3"
 style={{ color:"var(--muted-fg)" }}
 >
 {zone}
 </h2>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
 {grouped[zone].map((table: TableRow) => (
 <div
 key={table._id}
 className="rounded-2xl p-4 relative group"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 borderWidth:"1px",
 }}
 >
 <div className="flex items-start justify-between mb-2">
 <span
 className="text-sm font-semibold"
 style={{ color:"var(--fg)" }}
 >
 {table.name}
 </span>
 <span
 className={`text-xs px-2 py-0.5 rounded-full font-medium ${
 table.occupied
 ?"bg-amber-500/15 text-amber-400"
 :"bg-emerald-500/15 text-emerald-400"
 }`}
 >
 {table.occupied ?"Occupied" :"Available"}
 </span>
 </div>
 <div className="flex items-center gap-1 text-xs" style={{ color:"var(--muted-fg)" }}>
 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
 </svg>
 {table.capacity} seats
 </div>
 {/* Actions */}
 <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
 <button
 onClick={() => openEdit(table)}
 className="p-1 rounded-2xl"
 title="Edit"
 >
 <svg className="w-3.5 h-3.5" style={{ color:"var(--muted-fg)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
 </svg>
 </button>
 <button
 onClick={() => handleDelete(table._id)}
 className="p-1 rounded-2xl hover:bg-red-500/10"
 title="Delete"
 >
 <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
 </svg>
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}

 {showForm && (
 <TableForm
 initialData={editingTable}
 onSubmit={handleSubmit}
 onClose={closeForm}
 isSubmitting={isSubmitting}
 />
 )}
 </div>
 );
}
