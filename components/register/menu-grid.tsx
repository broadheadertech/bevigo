"use client";

import { useState } from "react";
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
  imageUrl?: string | null;
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
  const featured = items.filter((i) => i.isFeatured);

  // "featured" is a virtual category, then real categories
  const allTabs = [
    ...(featured.length > 0 ? [{ id: "__featured__", name: "Featured" }] : []),
    ...activeCategories.map((c) => ({ id: c._id as string, name: c.name })),
  ];

  const [activeTab, setActiveTab] = useState(allTabs[0]?.id ?? "");

  const displayItems =
    activeTab === "__featured__"
      ? featured
      : items.filter((i) => i.categoryId === activeTab);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Category tabs */}
      <div
        className="flex gap-1 px-3 py-2 overflow-x-auto shrink-0"
        style={{ borderBottom: "1px solid var(--border-color)" }}
      >
        {allTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-h-[40px] ${
              activeTab === tab.id
                ? "bg-amber-600 text-white"
                : ""
            }`}
            style={
              activeTab !== tab.id
                ? { backgroundColor: "var(--muted)", color: "var(--muted-fg)" }
                : undefined
            }
          >
            {tab.name}
            {tab.id === "__featured__" && " ★"}
          </button>
        ))}
      </div>

      {/* Items grid — fills remaining space, no scroll */}
      <div className="flex-1 p-3 overflow-y-auto">
        {displayItems.length > 0 ? (
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 auto-rows-min">
            {displayItems.map((item: LocationItem) => (
              <button
                key={item._id}
                onClick={() => onItemTap(item)}
                className="rounded-xl text-left transition-all duration-100 active:scale-95 overflow-hidden flex flex-col"
                style={{
                  backgroundColor: activeTab === "__featured__" ? "var(--accent-color)" : "var(--card)",
                  color: activeTab === "__featured__" ? "white" : "var(--card-fg)",
                  border: "1px solid var(--border-color)",
                }}
              >
                {item.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-20 object-cover"
                  />
                ) : (
                  <div className="w-full h-12 flex items-center justify-center" style={{ backgroundColor: activeTab === "__featured__" ? "rgba(0,0,0,0.15)" : "var(--muted)" }}>
                    <svg className="w-5 h-5 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M6.75 12a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </div>
                )}
                <div className="p-2">
                  <div className="text-sm font-medium truncate">
                    {item.isFeatured && activeTab !== "__featured__" && (
                      <span className="text-amber-500 mr-1">★</span>
                    )}
                    {item.name}
                  </div>
                  <div
                    className="text-xs font-semibold mt-0.5"
                    style={{
                      color: activeTab === "__featured__" ? "rgba(255,255,255,0.8)" : "var(--muted-fg)",
                    }}
                  >
                    {formatCurrency(item.effectivePrice)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p style={{ color: "var(--muted-fg)" }} className="text-sm">
              No items in this category
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
