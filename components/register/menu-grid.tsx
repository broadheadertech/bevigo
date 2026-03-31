"use client";

import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

type LocationItem = {
  _id: Id<"menuItems">;
  name: string;
  description?: string;
  categoryId: Id<"categories">;
  basePrice: number;
  effectivePrice: number;
  hasOverride: boolean;
  isFeatured: boolean;
};

type Category = {
  _id: Id<"categories">;
  name: string;
  sortOrder: number;
  status: string;
};

type MenuGridProps = {
  categories: Category[];
  items: LocationItem[];
  onItemTap: (item: LocationItem) => void;
};

export function MenuGrid({ categories, items, onItemTap }: MenuGridProps) {
  const activeCategories = categories.filter((c) => c.status === "active");

  // Group items by category
  const featured = items.filter((i) => i.isFeatured);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3">
        {/* Featured section */}
        {featured.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2 px-1">
              Featured
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {featured.map((item: LocationItem) => (
                <button
                  key={`featured-${item._id}`}
                  onClick={() => onItemTap(item)}
                  className="min-h-[48px] p-3 bg-amber-50 border-2 border-amber-200 rounded-lg text-left hover:bg-amber-100 active:bg-amber-200 transition-colors"
                >
                  <div className="text-sm font-medium text-stone-900 truncate">
                    {item.name}
                  </div>
                  <div className="text-xs font-semibold text-amber-700 mt-1">
                    {formatCurrency(item.effectivePrice)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category sections */}
        {activeCategories.map((cat: Category) => {
          const catItems = items.filter((i) => i.categoryId === cat._id);
          if (catItems.length === 0) return null;

          return (
            <div key={cat._id} className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2 px-1">
                {cat.name}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {catItems.map((item: LocationItem) => (
                  <button
                    key={item._id}
                    onClick={() => onItemTap(item)}
                    className="min-h-[48px] p-3 bg-white border border-stone-200 rounded-lg text-left hover:bg-stone-50 active:bg-stone-100 transition-colors shadow-sm"
                  >
                    <div className="text-sm font-medium text-stone-900 truncate">
                      {item.isFeatured && (
                        <span className="text-amber-500 mr-1">&#9733;</span>
                      )}
                      {item.name}
                    </div>
                    <div className="text-xs font-semibold text-stone-600 mt-1">
                      {formatCurrency(item.effectivePrice)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="flex items-center justify-center h-48">
            <p className="text-stone-400 text-sm">No menu items available</p>
          </div>
        )}
      </div>
    </div>
  );
}
