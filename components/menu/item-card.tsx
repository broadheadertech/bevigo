"use client";

import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type MenuItem = {
  _id: Id<"menuItems">;
  name: string;
  description?: string;
  basePrice: number;
  categoryId: Id<"categories">;
  isFeatured: boolean;
  sortOrder: number;
  status: "active" | "inactive" | "archived";
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
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-5 flex flex-col gap-2.5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">{item.name}</h3>
          {item.isFeatured && (
            <span className="text-amber-500" title="Featured">
              &#9733;
            </span>
          )}
        </div>
        <span
          className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
            item.status === "active"
              ? "bg-emerald-50 text-emerald-700"
              : item.status === "inactive"
                ? "bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400"
                : "bg-red-50 text-red-600"
          }`}
        >
          {item.status}
        </span>
      </div>

      {item.description && (
        <p className="text-sm text-stone-500 line-clamp-2">{item.description}</p>
      )}

      <div className="flex items-center justify-between mt-1">
        <span className="text-lg font-bold text-stone-900 dark:text-stone-100">
          {formatCurrency(item.basePrice)}
        </span>
        {categoryName && (
          <span className="text-xs text-stone-400">{categoryName}</span>
        )}
      </div>

      <div className="flex gap-3 mt-2 pt-3 border-t border-stone-100 dark:border-stone-800">
        <button
          onClick={() => onEdit(item)}
          className="text-sm font-medium text-amber-700 hover:text-amber-800 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onToggleFeatured(item._id)}
          className={`text-sm font-medium transition-colors ${
            item.isFeatured
              ? "text-amber-600 hover:text-amber-800"
              : "text-stone-400 hover:text-amber-600"
          }`}
          title={item.isFeatured ? "Remove from featured" : "Mark as featured"}
        >
          {item.isFeatured ? "Unfeature" : "Feature"}
        </button>
        {item.status === "active" ? (
          <button
            onClick={() => onDeactivate(item._id)}
            className="text-sm font-medium text-orange-600 hover:text-orange-800 transition-colors"
          >
            Deactivate
          </button>
        ) : item.status === "inactive" ? (
          <button
            onClick={() => onReactivate(item._id)}
            className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
          >
            Reactivate
          </button>
        ) : null}
      </div>
    </div>
  );
}
