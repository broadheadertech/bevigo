"use client";

import { Id } from"../../convex/_generated/dataModel";
import { formatCurrency } from"@/lib/currency";

type MenuItem = {
 _id: Id<"menuItems">;
 name: string;
 description?: string;
 basePrice: number;
 categoryId: Id<"categories">;
 isFeatured: boolean;
 sortOrder: number;
 status:"active" |"inactive" |"archived";
 tenantId: Id<"tenants">;
 updatedAt: number;
};

type ItemCardProps = {
 item: MenuItem;
 categoryName?: string;
 onEdit: (item: MenuItem) => void;
 onDeactivate: (itemId: Id<"menuItems">) => void;
 onReactivate: (itemId: Id<"menuItems">) => void;
 onToggleFeatured: (itemId: Id<"menuItems">) => void;
};

export function ItemCard({
 item,
 categoryName,
 onEdit,
 onDeactivate,
 onReactivate,
 onToggleFeatured,
}: ItemCardProps) {
 return (
 <div className="rounded-2xl border shadow-lg p-5 flex flex-col gap-2.5" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-2">
 <h3 className="font-semibold" style={{ color: 'var(--fg)' }}>{item.name}</h3>
 {item.isFeatured && (
 <span className="text-amber-500" title="Featured">
 &#9733;
 </span>
 )}
 </div>
 <span
 className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
 item.status ==="active"
 ?"bg-emerald-500/10 text-emerald-400"
 : item.status ==="inactive"
 ?"bg-stone-500/10"
 :"bg-red-500/10 text-red-400"
 }`}
 >
 {item.status}
 </span>
 </div>

 {item.description && (
 <p className="text-sm line-clamp-2">{item.description}</p>
 )}

 <div className="flex items-center justify-between mt-1">
 <span className="text-lg font-bold">
 {formatCurrency(item.basePrice)}
 </span>
 {categoryName && (
 <span className="text-xs">{categoryName}</span>
 )}
 </div>

 <div className="flex gap-3 mt-2 pt-3 border-t">
 <button
 onClick={() => onEdit(item)}
 className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
 >
 Edit
 </button>
 <button
 onClick={() => onToggleFeatured(item._id)}
 className={`text-sm font-medium transition-colors ${
 item.isFeatured
 ?"text-amber-400 hover:text-amber-300"
 :"text-stone-400 hover:text-amber-600"
 }`}
 title={item.isFeatured ?"Remove from featured" :"Mark as featured"}
 >
 {item.isFeatured ?"Unfeature" :"Feature"}
 </button>
 {item.status ==="active" ? (
 <button
 onClick={() => onDeactivate(item._id)}
 className="text-sm font-medium text-orange-600 hover:text-orange-800 transition-colors"
 >
 Deactivate
 </button>
 ) : item.status ==="inactive" ? (
 <button
 onClick={() => onReactivate(item._id)}
 className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
 >
 Reactivate
 </button>
 ) : null}
 </div>
 </div>
 );
}
