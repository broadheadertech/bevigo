"use client";

import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

type BulkItem = {
  _id: Id<"menuItems">;
  name: string;
  basePrice: number;
  categoryId: Id<"categories">;
};

type BulkLocation = {
  _id: Id<"locations">;
  name: string;
};

type BulkOverride = {
  menuItemId: Id<"menuItems">;
  locationId: Id<"locations">;
  price: number;
};

type BulkCategory = {
  _id: Id<"categories">;
  name: string;
};

type BulkPriceDialogProps = {
  items: BulkItem[];
  locations: BulkLocation[];
  overrides: BulkOverride[];
  categories: BulkCategory[];
  onClose: () => void;
};

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function BulkPriceDialog({
  items,
  locations,
  overrides,
  categories,
  onClose,
}: BulkPriceDialogProps) {
  const { token } = useAuth();
  const bulkUpdate = useMutation(api.menu.bulkMutations.bulkUpdatePricing);

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(
    new Set()
  );
  const [adjustmentType, setAdjustmentType] = useState<
    "absolute" | "percentage"
  >("percentage");
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [skipOverrides, setSkipOverrides] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("");

  const filteredItems = useMemo(() => {
    if (!filterCategory) return items;
    return items.filter((item) => item.categoryId === filterCategory);
  }, [items, filterCategory]);

  const overrideMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of overrides) {
      map.set(`${o.menuItemId}:${o.locationId}`, o.price);
    }
    return map;
  }, [overrides]);

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLocation = (id: string) => {
    setSelectedLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllItems = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map((i) => i._id)));
    }
  };

  const selectAllLocations = () => {
    if (selectedLocationIds.size === locations.length) {
      setSelectedLocationIds(new Set());
    } else {
      setSelectedLocationIds(new Set(locations.map((l) => l._id)));
    }
  };

  // Compute preview of changes
  const preview = useMemo(() => {
    const val = parseFloat(adjustmentValue);
    if (isNaN(val) || selectedItemIds.size === 0) return [];

    const selectedItems = items.filter((i) => selectedItemIds.has(i._id));
    const selectedLocs =
      selectedLocationIds.size > 0
        ? locations.filter((l) => selectedLocationIds.has(l._id))
        : [];

    const results: Array<{
      itemName: string;
      locationName: string | null;
      oldPrice: number;
      newPrice: number;
      skipped: boolean;
    }> = [];

    for (const item of selectedItems) {
      if (selectedLocs.length > 0) {
        for (const loc of selectedLocs) {
          const overrideKey = `${item._id}:${loc._id}`;
          const existingOverride = overrideMap.get(overrideKey);
          const currentPrice = existingOverride ?? item.basePrice;

          if (skipOverrides && existingOverride !== undefined) {
            results.push({
              itemName: item.name,
              locationName: loc.name,
              oldPrice: currentPrice,
              newPrice: currentPrice,
              skipped: true,
            });
            continue;
          }

          let newPrice: number;
          if (adjustmentType === "percentage") {
            newPrice = Math.round(currentPrice * (1 + val / 100));
          } else {
            newPrice = Math.round(val * 100);
          }

          results.push({
            itemName: item.name,
            locationName: loc.name,
            oldPrice: currentPrice,
            newPrice,
            skipped: false,
          });
        }
      } else {
        // Base price update
        if (skipOverrides && overrides.some((o) => String(o.menuItemId) === String(item._id))) {
          results.push({
            itemName: item.name,
            locationName: null,
            oldPrice: item.basePrice,
            newPrice: item.basePrice,
            skipped: true,
          });
          continue;
        }

        let newPrice: number;
        if (adjustmentType === "percentage") {
          newPrice = Math.round(item.basePrice * (1 + val / 100));
        } else {
          newPrice = Math.round(val * 100);
        }

        results.push({
          itemName: item.name,
          locationName: null,
          oldPrice: item.basePrice,
          newPrice,
          skipped: false,
        });
      }
    }

    return results;
  }, [
    selectedItemIds,
    selectedLocationIds,
    adjustmentType,
    adjustmentValue,
    skipOverrides,
    items,
    locations,
    overrideMap,
    overrides,
  ]);

  const activeChanges = preview.filter((p) => !p.skipped);

  const handleSubmit = async () => {
    if (!token) return;
    if (selectedItemIds.size === 0) {
      setError("Please select at least one menu item");
      return;
    }

    const val = parseFloat(adjustmentValue);
    if (isNaN(val)) {
      setError("Please enter a valid adjustment value");
      return;
    }

    if (adjustmentType === "absolute" && val <= 0) {
      setError("Absolute price must be greater than zero");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const selectedItems = items.filter((i) => selectedItemIds.has(i._id));
      const selectedLocs =
        selectedLocationIds.size > 0
          ? locations.filter((l) => selectedLocationIds.has(l._id))
          : [];

      const updates: Array<{
        menuItemId: Id<"menuItems">;
        locationId?: Id<"locations">;
        newPrice: number;
      }> = [];

      for (const item of selectedItems) {
        if (selectedLocs.length > 0) {
          for (const loc of selectedLocs) {
            const overrideKey = `${item._id}:${loc._id}`;
            const existingOverride = overrideMap.get(overrideKey);
            const currentPrice = existingOverride ?? item.basePrice;

            let newPrice: number;
            if (adjustmentType === "percentage") {
              newPrice = Math.round(currentPrice * (1 + val / 100));
            } else {
              newPrice = Math.round(val * 100);
            }

            updates.push({
              menuItemId: item._id,
              locationId: loc._id,
              newPrice,
            });
          }
        } else {
          let newPrice: number;
          if (adjustmentType === "percentage") {
            newPrice = Math.round(item.basePrice * (1 + val / 100));
          } else {
            newPrice = Math.round(val * 100);
          }

          updates.push({
            menuItemId: item._id,
            newPrice,
          });
        }
      }

      const result = await bulkUpdate({
        token,
        updates,
        adjustmentType,
        adjustmentValue: val,
        skipOverrides,
      });

      setSuccess(
        `Successfully updated ${result.updated} price${result.updated !== 1 ? "s" : ""}`
      );
      setSelectedItemIds(new Set());
      setSelectedLocationIds(new Set());
      setAdjustmentValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Bulk Price Update</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
              {success}
            </div>
          )}

          {/* Menu Items Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Menu Items *
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={selectAllItems}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {selectedItemIds.size === filteredItems.length &&
                  filteredItems.length > 0
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
            </div>
            <div className="border border-gray-200 dark:border-stone-700 rounded max-h-48 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <p className="text-sm text-gray-400 p-3">No items found</p>
              ) : (
                filteredItems.map((item) => {
                  const catName =
                    categories.find((c) => c._id === item.categoryId)?.name ??
                    "";
                  return (
                    <label
                      key={item._id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-stone-800 cursor-pointer border-b border-gray-100 dark:border-stone-800 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(item._id)}
                        onChange={() => toggleItem(item._id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm flex-1">{item.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{catName}</span>
                      <span className="text-sm font-mono text-gray-600">
                        {formatPrice(item.basePrice)}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {selectedItemIds.size} item{selectedItemIds.size !== 1 ? "s" : ""}{" "}
              selected
            </p>
          </div>

          {/* Locations Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Locations{" "}
                <span className="font-normal text-gray-400 dark:text-gray-500">
                  (optional - leave empty to update base prices)
                </span>
              </label>
              {locations.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllLocations}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {selectedLocationIds.size === locations.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              )}
            </div>
            <div className="border border-gray-200 dark:border-stone-700 rounded max-h-36 overflow-y-auto">
              {locations.length === 0 ? (
                <p className="text-sm text-gray-400 p-3">
                  No locations configured
                </p>
              ) : (
                locations.map((loc) => (
                  <label
                    key={loc._id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-stone-800 cursor-pointer border-b border-gray-100 dark:border-stone-800 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLocationIds.has(loc._id)}
                      onChange={() => toggleLocation(loc._id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm">{loc.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Adjustment Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-stone-300 mb-1">
                Adjustment Type
              </label>
              <select
                value={adjustmentType}
                onChange={(e) =>
                  setAdjustmentType(
                    e.target.value as "absolute" | "percentage"
                  )
                }
                className="w-full border border-gray-300 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded px-3 py-2"
              >
                <option value="percentage">Percentage Adjustment</option>
                <option value="absolute">Set Absolute Price</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-stone-300 mb-1">
                {adjustmentType === "percentage"
                  ? "Percentage (%)"
                  : "New Price"}
              </label>
              <input
                type="number"
                step={adjustmentType === "percentage" ? "0.1" : "0.01"}
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(e.target.value)}
                className="w-full border border-gray-300 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded px-3 py-2"
                placeholder={
                  adjustmentType === "percentage"
                    ? "e.g. 10 for +10%, -5 for -5%"
                    : "e.g. 150.00"
                }
              />
            </div>
          </div>

          {/* Skip Overrides */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="skipOverrides"
              checked={skipOverrides}
              onChange={(e) => setSkipOverrides(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <label
              htmlFor="skipOverrides"
              className="text-sm font-medium text-gray-700"
            >
              Skip items with existing location overrides
            </label>
          </div>

          {/* Preview Section */}
          {preview.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Preview ({activeChanges.length} change
                {activeChanges.length !== 1 ? "s" : ""})
              </h3>
              <div className="border border-gray-200 dark:border-stone-700 rounded max-h-56 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-stone-800 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-stone-400">
                        Item
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-stone-400">
                        Location
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 dark:text-stone-400">
                        Current
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 dark:text-stone-400">
                        New
                      </th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 dark:text-stone-400">
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => {
                      const diff = row.newPrice - row.oldPrice;
                      return (
                        <tr
                          key={i}
                          className={`border-t border-gray-100 dark:border-stone-800 ${row.skipped ? "opacity-40" : ""}`}
                        >
                          <td className="px-3 py-2">{row.itemName}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 dark:text-gray-500">
                            {row.locationName ?? "Base Price"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {formatPrice(row.oldPrice)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {row.skipped
                              ? "skipped"
                              : formatPrice(row.newPrice)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono ${
                              row.skipped
                                ? "text-gray-400"
                                : diff > 0
                                  ? "text-green-600"
                                  : diff < 0
                                    ? "text-red-600"
                                    : "text-gray-400"
                            }`}
                          >
                            {row.skipped
                              ? "--"
                              : diff > 0
                                ? `+${formatPrice(diff)}`
                                : diff < 0
                                  ? formatPrice(diff)
                                  : "0.00"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-stone-400 border border-gray-300 dark:border-stone-700 rounded-lg hover:bg-gray-50 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting || selectedItemIds.size === 0 || !adjustmentValue
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting
              ? "Updating..."
              : `Apply to ${activeChanges.length} Price${activeChanges.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
