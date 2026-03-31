"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

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

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function ManagerMenuView() {
  const { session, token } = useAuth();

  const locationIds = session?.locationIds as Id<"locations">[] | undefined;
  const primaryLocationId = locationIds?.[0];

  const items = useQuery(
    api.menu.queries.listItemsForLocation,
    token && primaryLocationId
      ? { token, locationId: primaryLocationId }
      : "skip"
  ) as LocationItem[] | undefined;

  const categories = useQuery(
    api.menu.queries.listCategories,
    token ? { token } : "skip"
  );

  const updatePrice = useMutation(api.menu.priceMutations.updateItemAsManager);

  const [editingItemId, setEditingItemId] = useState<Id<"menuItems"> | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token || !session || !primaryLocationId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  const categoryMap = new Map<string, string>(
    (categories ?? []).map((c: { _id: Id<"categories">; name: string }) => [c._id as string, c.name])
  );

  const handleEditPrice = (item: LocationItem) => {
    setEditingItemId(item._id);
    setPriceInput(formatPrice(item.effectivePrice));
    setError(null);
  };

  const handleSavePrice = async (itemId: Id<"menuItems">) => {
    const price = Math.round(parseFloat(priceInput) * 100);
    if (isNaN(price) || price <= 0) {
      setError("Please enter a valid price greater than 0");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updatePrice({
        token,
        menuItemId: itemId,
        locationId: primaryLocationId,
        price,
      });
      setEditingItemId(null);
      setPriceInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update price");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setEditingItemId(null);
    setPriceInput("");
    setError(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-stone-900">Menu (Location View)</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          You can set location-specific price overrides for your location.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {items === undefined ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-stone-400">Loading menu items...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-stone-400">No menu items available.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50/50 border-b border-stone-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Item
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Category
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Base Price
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Location Price
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((item) => (
                <tr
                  key={item._id}
                  className="hover:bg-stone-50/50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-stone-900">
                      {item.isFeatured && (
                        <span className="text-amber-500 mr-1">&#9733;</span>
                      )}
                      {item.name}
                    </div>
                    {item.description && (
                      <div className="text-sm text-stone-500 truncate max-w-xs">
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-stone-600">
                    {categoryMap.get(item.categoryId as string) ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm text-stone-400">
                    {formatPrice(item.basePrice)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {editingItemId === item._id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          className="w-24 border border-stone-200 rounded-xl px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSavePrice(item._id);
                            if (e.key === "Escape") handleCancel();
                          }}
                        />
                        <button
                          onClick={() => handleSavePrice(item._id)}
                          disabled={isSubmitting}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors"
                        >
                          {isSubmitting ? "..." : "Save"}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span
                        className={
                          item.hasOverride
                            ? "font-medium text-amber-700"
                            : "text-stone-700"
                        }
                      >
                        {formatPrice(item.effectivePrice)}
                        {item.hasOverride && (
                          <span className="ml-1 text-xs text-amber-500">
                            (override)
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {editingItemId !== item._id && (
                      <button
                        onClick={() => handleEditPrice(item)}
                        className="text-sm font-medium text-amber-700 hover:text-amber-800 transition-colors"
                      >
                        Edit Price
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
