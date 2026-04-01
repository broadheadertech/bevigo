"use client";

import { useState } from"react";
import { useMutation } from"convex/react";
import { api } from"../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { Id } from"../../convex/_generated/dataModel";
import { ImageUpload } from"./image-upload";

type Category = {
 _id: Id<"categories">;
 name: string;
};

type ItemFormProps = {
 categories: Category[];
 editingItem?: {
 _id: Id<"menuItems">;
 name: string;
 description?: string;
 basePrice: number;
 sku?: string;
 categoryId: Id<"categories">;
 isFeatured: boolean;
 sortOrder: number;
 } | null;
 defaultCategoryId?: Id<"categories">;
 onClose: () => void;
};

export function ItemForm({
 categories,
 editingItem,
 defaultCategoryId,
 onClose,
}: ItemFormProps) {
 const { token } = useAuth();
 const createItem = useMutation(api.menu.mutations.createItem);
 const updateItem = useMutation(api.menu.mutations.updateItem);

 const [name, setName] = useState(editingItem?.name ??"");
 const [description, setDescription] = useState(
 editingItem?.description ??""
 );
 const [priceDisplay, setPriceDisplay] = useState(
 editingItem ? (editingItem.basePrice / 100).toFixed(2) :""
 );
 const [categoryId, setCategoryId] = useState<Id<"categories"> |"">(
 editingItem?.categoryId ?? defaultCategoryId ??""
 );
 const [sku, setSku] = useState(editingItem?.sku ??"");
 const [isFeatured, setIsFeatured] = useState(
 editingItem?.isFeatured ?? false
 );
 const [sortOrder, setSortOrder] = useState(editingItem?.sortOrder ?? 0);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!token || !categoryId) return;

 setIsSubmitting(true);
 setError(null);

 // Convert decimal price to integer (cents)
 const basePrice = Math.round(parseFloat(priceDisplay) * 100);
 if (isNaN(basePrice) || basePrice <= 0) {
 setError("Please enter a valid price");
 setIsSubmitting(false);
 return;
 }

 try {
 if (editingItem) {
 await updateItem({
 token,
 itemId: editingItem._id,
 name,
 description: description || undefined,
 basePrice,
 sku: sku || undefined,
 categoryId: categoryId as Id<"categories">,
 isFeatured,
 sortOrder,
 });
 } else {
 await createItem({
 token,
 categoryId: categoryId as Id<"categories">,
 name,
 description: description || undefined,
 basePrice,
 sku: sku || undefined,
 isFeatured,
 sortOrder,
 });
 }
 onClose();
 } catch (err) {
 setError(err instanceof Error ? err.message :"An error occurred");
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
 <div className="rounded-2xl shadow-2xl w-full max-w-md p-6 border" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>
 {editingItem ?"Edit Menu Item" :"Add Menu Item"}
 </h2>

 {error && (
 <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
 {error}
 </div>
 )}

 <form onSubmit={handleSubmit} className="flex flex-col gap-4">
 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Name *
 </label>
 <input
 type="text"
 required
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 placeholder="e.g. Iced Americano"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Description
 </label>
 <textarea
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 rows={2}
 placeholder="Optional description"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Price *
 </label>
 <input
 type="number"
 required
 min="0.01"
 step="0.01"
 value={priceDisplay}
 onChange={(e) => setPriceDisplay(e.target.value)}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 placeholder="150.00"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 SKU / Barcode
 </label>
 <input
 type="text"
 value={sku}
 onChange={(e) => setSku(e.target.value)}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 placeholder="e.g. 4800000000001"
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Category *
 </label>
 <select
 required
 value={categoryId}
 onChange={(e) =>
 setCategoryId(e.target.value as Id<"categories">)
 }
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 <option value="">Select category...</option>
 {categories.map((cat) => (
 <option key={cat._id} value={cat._id}>
 {cat.name}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium mb-1" style={{ color: 'var(--muted-fg)' }}>
 Sort Order
 </label>
 <input
 type="number"
 value={sortOrder}
 onChange={(e) => setSortOrder(Number(e.target.value))}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />
 </div>

 <div className="flex items-center gap-2">
 <input
 type="checkbox"
 id="isFeatured"
 checked={isFeatured}
 onChange={(e) => setIsFeatured(e.target.checked)}
 className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500/20"
 />
 <label
 htmlFor="isFeatured"
 className="text-sm font-medium" style={{ color: 'var(--muted-fg)' }}
 >
 Featured Item
 </label>
 </div>

 {/* Image upload — only for editing existing items */}
 {editingItem && (
 <div>
 <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 Product Image
 </label>
 <ImageUpload itemId={editingItem._id} />
 </div>
 )}

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
 : editingItem
 ?"Update"
 :"Create"}
 </button>
 </div>
 </form>
 </div>
 </div>
 );
}
