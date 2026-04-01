"use client";

import { useState } from"react";
import { Id } from"../../convex/_generated/dataModel";

type OperatingHoursDay = { open: string; close: string } | undefined;

type OperatingHours = {
 monday?: OperatingHoursDay;
 tuesday?: OperatingHoursDay;
 wednesday?: OperatingHoursDay;
 thursday?: OperatingHoursDay;
 friday?: OperatingHoursDay;
 saturday?: OperatingHoursDay;
 sunday?: OperatingHoursDay;
};

export type LocationFormData = {
 name: string;
 slug: string;
 address: string;
 timezone: string;
 currency: string;
 taxRate: string; // displayed as percentage, stored as basis points
 taxLabel: string;
 operatingHours: OperatingHours;
 status:"active" |"inactive";
};

export type LocationData = {
 _id: Id<"locations">;
 name: string;
 slug: string;
 address?: string;
 timezone: string;
 currency: string;
 taxRate: number;
 taxLabel: string;
 operatingHours: OperatingHours;
 status:"active" |"inactive";
 updatedAt: number;
 staffCount?: number;
};

const TIMEZONES = [
 { value:"Asia/Manila", label:"Philippines (GMT+8)" },
 { value:"Asia/Jakarta", label:"Indonesia - WIB (GMT+7)" },
 { value:"Asia/Makassar", label:"Indonesia - WITA (GMT+8)" },
 { value:"Asia/Jayapura", label:"Indonesia - WIT (GMT+9)" },
 { value:"Asia/Kuala_Lumpur", label:"Malaysia (GMT+8)" },
 { value:"Asia/Singapore", label:"Singapore (GMT+8)" },
 { value:"Asia/Bangkok", label:"Thailand (GMT+7)" },
 { value:"Asia/Ho_Chi_Minh", label:"Vietnam (GMT+7)" },
];

const CURRENCIES = [
 { value:"PHP", label:"PHP - Philippine Peso" },
 { value:"IDR", label:"IDR - Indonesian Rupiah" },
 { value:"MYR", label:"MYR - Malaysian Ringgit" },
 { value:"SGD", label:"SGD - Singapore Dollar" },
 { value:"THB", label:"THB - Thai Baht" },
];

const DAYS = [
"monday",
"tuesday",
"wednesday",
"thursday",
"friday",
"saturday",
"sunday",
] as const;

const DAY_LABELS: Record<string, string> = {
 monday:"Mon",
 tuesday:"Tue",
 wednesday:"Wed",
 thursday:"Thu",
 friday:"Fri",
 saturday:"Sat",
 sunday:"Sun",
};

const emptyForm: LocationFormData = {
 name:"",
 slug:"",
 address:"",
 timezone:"Asia/Manila",
 currency:"PHP",
 taxRate:"12.00",
 taxLabel:"VAT",
 operatingHours: {},
 status:"active",
};

function slugify(text: string): string {
 return text
 .toLowerCase()
 .replace(/[^a-z0-9]+/g,"-")
 .replace(/^-+|-+$/g,"");
}

const inputClass ="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors";
const smallInputClass ="border rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors";

export function LocationForm({
 editingLocation,
 onSubmit,
 onClose,
 error,
 isSubmitting,
}: {
 editingLocation: LocationData | null;
 onSubmit: (data: LocationFormData) => Promise<void>;
 onClose: () => void;
 error: string | null;
 isSubmitting: boolean;
}) {
 const initialForm = editingLocation
 ? {
 name: editingLocation.name,
 slug: editingLocation.slug,
 address: editingLocation.address ??"",
 timezone: editingLocation.timezone,
 currency: editingLocation.currency,
 taxRate: (editingLocation.taxRate / 100).toFixed(2),
 taxLabel: editingLocation.taxLabel,
 operatingHours: editingLocation.operatingHours,
 status: editingLocation.status,
 }
 : emptyForm;
 const [form, setForm] = useState<LocationFormData>(initialForm);
 const [autoSlug, setAutoSlug] = useState(!editingLocation);

 const handleNameChange = (name: string) => {
 const newForm = { ...form, name };
 if (autoSlug && !editingLocation) {
 newForm.slug = slugify(name);
 }
 setForm(newForm);
 };

 const handleSlugChange = (slug: string) => {
 setAutoSlug(false);
 setForm({ ...form, slug: slugify(slug) });
 };

 const toggleDay = (day: (typeof DAYS)[number], enabled: boolean) => {
 const hours = { ...form.operatingHours };
 if (enabled) {
 hours[day] = { open:"08:00", close:"22:00" };
 } else {
 hours[day] = undefined;
 }
 setForm({ ...form, operatingHours: hours });
 };

 const updateDayHours = (
 day: (typeof DAYS)[number],
 field:"open" |"close",
 value: string
 ) => {
 const hours = { ...form.operatingHours };
 const current = hours[day] ?? { open:"08:00", close:"22:00" };
 hours[day] = { ...current, [field]: value };
 setForm({ ...form, operatingHours: hours });
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 await onSubmit(form);
 };

 const basisPoints = Math.round(parseFloat(form.taxRate ||"0") * 100);

 return (
 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto py-8">
 <div className="rounded-2xl shadow-2xl w-full max-w-lg p-6 my-auto border" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>
 {editingLocation ?"Edit Location" :"Add Location"}
 </h2>

 {error && (
 <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
 {error}
 </div>
 )}

 <form onSubmit={handleSubmit} className="flex flex-col gap-4">
 {/* Name */}
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Name *
 </label>
 <input
 type="text"
 required
 value={form.name}
 onChange={(e) => handleNameChange(e.target.value)}
 className={inputClass}
 placeholder="e.g. Main Street Branch"
 />
 </div>

 {/* Slug */}
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Slug *
 </label>
 <input
 type="text"
 required
 value={form.slug}
 onChange={(e) => handleSlugChange(e.target.value)}
 className={`${inputClass} font-mono`}
 placeholder="main-street-branch"
 />
 <p className="text-xs mt-1">
 URL-friendly identifier, auto-generated from name
 </p>
 </div>

 {/* Address */}
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Address
 </label>
 <textarea
 value={form.address}
 onChange={(e) => setForm({ ...form, address: e.target.value })}
 className={inputClass}
 rows={2}
 placeholder="Street address, city, etc."
 />
 </div>

 {/* Timezone + Currency row */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Timezone
 </label>
 <select
 value={form.timezone}
 onChange={(e) => setForm({ ...form, timezone: e.target.value })}
 className={inputClass}
 >
 {TIMEZONES.map((tz) => (
 <option key={tz.value} value={tz.value}>
 {tz.label}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Currency
 </label>
 <select
 value={form.currency}
 onChange={(e) => setForm({ ...form, currency: e.target.value })}
 className={inputClass}
 >
 {CURRENCIES.map((c) => (
 <option key={c.value} value={c.value}>
 {c.label}
 </option>
 ))}
 </select>
 </div>
 </div>

 {/* Tax row */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Tax Rate (%)
 </label>
 <input
 type="number"
 step="0.01"
 min="0"
 max="100"
 value={form.taxRate}
 onChange={(e) => setForm({ ...form, taxRate: e.target.value })}
 className={inputClass}
 />
 <p className="text-xs mt-1">
 {basisPoints} basis points
 </p>
 </div>
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Tax Label
 </label>
 <input
 type="text"
 value={form.taxLabel}
 onChange={(e) => setForm({ ...form, taxLabel: e.target.value })}
 className={inputClass}
 placeholder="e.g. VAT, PPN, GST"
 />
 </div>
 </div>

 {/* Status toggle */}
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Status
 </label>
 <div className="flex gap-4">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="radio"
 name="status"
 checked={form.status ==="active"}
 onChange={() => setForm({ ...form, status:"active" })}
 className="text-amber-600 focus:ring-amber-500/20"
 />
 <span className="text-sm">Active</span>
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="radio"
 name="status"
 checked={form.status ==="inactive"}
 onChange={() => setForm({ ...form, status:"inactive" })}
 className="text-amber-600 focus:ring-amber-500/20"
 />
 <span className="text-sm">Inactive</span>
 </label>
 </div>
 </div>

 {/* Operating Hours */}
 <div>
 <label className="block text-sm font-medium mb-2" style={{ color: 'var(--muted-fg)' }}>
 Operating Hours
 </label>
 <div className="space-y-2">
 {DAYS.map((day) => {
 const isOpen = !!form.operatingHours[day];
 return (
 <div key={day} className="flex items-center gap-3">
 <label className="flex items-center gap-2 w-16 cursor-pointer">
 <input
 type="checkbox"
 checked={isOpen}
 onChange={(e) => toggleDay(day, e.target.checked)}
 className="rounded border-stone-300 text-amber-600 focus:ring-amber-500/20"
 />
 <span className="text-sm font-medium" style={{ color: 'var(--muted-fg)' }}>
 {DAY_LABELS[day]}
 </span>
 </label>
 {isOpen ? (
 <div className="flex items-center gap-2">
 <input
 type="time"
 value={form.operatingHours[day]?.open ??"08:00"}
 onChange={(e) =>
 updateDayHours(day,"open", e.target.value)
 }
 className={smallInputClass}
 />
 <span className="text-stone-400 text-sm">to</span>
 <input
 type="time"
 value={form.operatingHours[day]?.close ??"22:00"}
 onChange={(e) =>
 updateDayHours(day,"close", e.target.value)
 }
 className={smallInputClass}
 />
 </div>
 ) : (
 <span className="text-sm">Closed</span>
 )}
 </div>
 );
 })}
 </div>
 </div>

 {/* Actions */}
 <div className="flex justify-end gap-3 mt-2">
 <button
 type="button"
 onClick={onClose}
 className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={isSubmitting}
 className="px-4 py-2.5 text-white rounded-xl disabled:opacity-50 text-sm font-medium transition-colors"
 >
 {isSubmitting
 ?"Saving..."
 : editingLocation
 ?"Update"
 :"Create"}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
