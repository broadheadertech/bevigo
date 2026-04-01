"use client";

import { useState } from"react";
import { Id } from"../../convex/_generated/dataModel";

export type TableFormData = {
 name: string;
 zone: string;
 capacity: number;
 sortOrder: number;
};

export type TableData = TableFormData & {
 _id: Id<"tables">;
 status: string;
};

type TableFormProps = {
 initialData?: TableData | null;
 onSubmit: (data: TableFormData) => Promise<void>;
 onClose: () => void;
 isSubmitting: boolean;
};

const ZONES = ["Indoor","Outdoor","Bar","VIP"];

export function TableForm({
 initialData,
 onSubmit,
 onClose,
 isSubmitting,
}: TableFormProps) {
 const [name, setName] = useState(initialData?.name ??"");
 const [zone, setZone] = useState(initialData?.zone ??"Indoor");
 const [capacity, setCapacity] = useState(initialData?.capacity ?? 4);
 const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 await onSubmit({ name, zone, capacity, sortOrder });
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center">
 <div
 className="absolute inset-0"
 style={{ backgroundColor:"rgba(0,0,0,0.5)" }}
 onClick={onClose}
 />
 <div
 className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
 style={{ backgroundColor:"var(--card)", color:"var(--card-fg)" }}
 >
 <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>
 {initialData ?"Edit Table" :"Add Table"}
 </h2>
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color:"var(--fg)" }}>
 Name
 </label>
 <input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 required
 className="w-full px-3 py-2 rounded-xl text-sm"
 style={{
 backgroundColor:"var(--muted)",
 color:"var(--fg)",
 borderColor:"var(--border-color)",
 borderWidth:"1px",
 }}
 placeholder="Table 1"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color:"var(--fg)" }}>
 Zone
 </label>
 <select
 value={zone}
 onChange={(e) => setZone(e.target.value)}
 className="w-full px-3 py-2 rounded-xl text-sm"
 style={{
 backgroundColor:"var(--muted)",
 color:"var(--fg)",
 borderColor:"var(--border-color)",
 borderWidth:"1px",
 }}
 >
 {ZONES.map((z: string) => (
 <option key={z} value={z}>
 {z}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color:"var(--fg)" }}>
 Capacity (seats)
 </label>
 <input
 type="number"
 value={capacity}
 onChange={(e) => setCapacity(Number(e.target.value))}
 min={1}
 max={20}
 required
 className="w-full px-3 py-2 rounded-xl text-sm"
 style={{
 backgroundColor:"var(--muted)",
 color:"var(--fg)",
 borderColor:"var(--border-color)",
 borderWidth:"1px",
 }}
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color:"var(--fg)" }}>
 Sort Order
 </label>
 <input
 type="number"
 value={sortOrder}
 onChange={(e) => setSortOrder(Number(e.target.value))}
 min={0}
 className="w-full px-3 py-2 rounded-xl text-sm"
 style={{
 backgroundColor:"var(--muted)",
 color:"var(--fg)",
 borderColor:"var(--border-color)",
 borderWidth:"1px",
 }}
 />
 </div>

 <div className="flex justify-end gap-3 pt-2">
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2 rounded-xl text-sm font-medium"
 style={{ color:"var(--muted-fg)" }}
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={isSubmitting || !name.trim()}
 className="px-4 py-2 text-white rounded-xl text-sm font-medium disabled:opacity-50"
 >
 {isSubmitting ?"Saving..." : initialData ?"Save" :"Add Table"}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
