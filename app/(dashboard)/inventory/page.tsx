"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { IngredientForm } from "@/components/inventory/ingredient-form";
import { exportToCSV } from "@/lib/export";

type Location = {
  _id: Id<"locations">;
  name: string;
  slug: string;
  status: "active" | "inactive";
};

type IngredientRow = {
  _id: Id<"ingredients">;
  tenantId: Id<"tenants">;
  name: string;
  unit: string;
  category?: string;
  reorderThreshold: number;
  status: "active" | "inactive";
  updatedAt: number;
  stockQuantity: number | null;
};

type LowStockRow = IngredientRow & {
  deficit: number;
};

type Tab = "ingredients" | "lowstock";

export default function InventoryPage() {
  const { session, token } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("ingredients");
  const [selectedLocationId, setSelectedLocationId] =
    useState<Id<"locations"> | "">("");
  const [showForm, setShowForm] = useState(false);
  const [editingIngredient, setEditingIngredient] =
    useState<IngredientRow | null>(null);
  const [editingStockId, setEditingStockId] =
    useState<Id<"ingredients"> | null>(null);
  const [editingStockValue, setEditingStockValue] = useState(0);

  const locations = useQuery(
    api.settings.queries.listLocations,
    token ? { token } : "skip"
  ) as Location[] | undefined;

  const locationId =
    selectedLocationId ||
    ((locations && locations.length > 0 ? locations[0]._id : "") as
      | Id<"locations">
      | "");

  const ingredients = useQuery(
    api.inventory.queries.listIngredients,
    token && locationId
      ? { token, locationId: locationId as Id<"locations"> }
      : token
        ? { token }
        : "skip"
  ) as IngredientRow[] | undefined;

  const lowStock = useQuery(
    api.inventory.queries.getLowStock,
    token && locationId
      ? { token, locationId: locationId as Id<"locations"> }
      : "skip"
  ) as LowStockRow[] | undefined;

  const setStock = useMutation(api.inventory.mutations.setStock);
  const updateIngredient = useMutation(
    api.inventory.mutations.updateIngredient
  );

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  const typedLocations = locations ?? [];
  const typedIngredients = ingredients ?? [];

  const handleSaveStock = async (ingredientId: Id<"ingredients">) => {
    if (!token || !locationId) return;
    try {
      await setStock({
        token,
        ingredientId,
        locationId: locationId as Id<"locations">,
        quantity: editingStockValue,
      });
      setEditingStockId(null);
    } catch {
      // Error handled silently — stock update failed
    }
  };

  const handleToggleStatus = async (ingredient: IngredientRow) => {
    if (!token) return;
    const newStatus =
      ingredient.status === "active" ? "inactive" : "active";
    await updateIngredient({
      token,
      ingredientId: ingredient._id,
      status: newStatus as "active" | "inactive",
    });
  };

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-stone-900">Inventory</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Track ingredients and stock levels
          </p>
        </div>
        <div className="flex gap-2 self-start md:self-auto">
          <button
            onClick={() => {
              if (typedIngredients.length > 0) {
                exportToCSV(typedIngredients.map((ing: IngredientRow) => ({
                  name: ing.name,
                  category: ing.category ?? "",
                  unit: ing.unit,
                  stockQuantity: ing.stockQuantity ?? 0,
                  reorderThreshold: ing.reorderThreshold,
                  status: ing.status,
                })), "inventory.csv");
              }
            }}
            className="px-3 py-2 border border-stone-200 text-stone-600 text-sm rounded-xl hover:bg-stone-50"
          >
            Export CSV
          </button>
          {session.role === "owner" && (
            <button
              onClick={() => {
                setEditingIngredient(null);
                setShowForm(true);
              }}
              className="px-4 py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-800 transition-colors shadow-sm"
            >
              + Add Ingredient
            </button>
          )}
        </div>
      </div>

      {/* Location selector + Tabs */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("ingredients")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "ingredients"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Ingredients
          </button>
          <button
            onClick={() => setActiveTab("lowstock")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "lowstock"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Low Stock
          </button>
        </div>

        <div>
          <select
            value={locationId as string}
            onChange={(e) =>
              setSelectedLocationId(e.target.value as Id<"locations"> | "")
            }
            className="border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
          >
            {typedLocations.length === 0 && (
              <option value="">No locations</option>
            )}
            {typedLocations.map((loc: Location) => (
              <option key={loc._id} value={loc._id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ingredients Tab */}
      {activeTab === "ingredients" && (
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm overflow-hidden overflow-x-auto">
          {ingredients === undefined ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-stone-400">Loading ingredients...</p>
            </div>
          ) : typedIngredients.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-stone-400">
                No ingredients yet. Add one to get started.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Category
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Unit
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Stock
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Threshold
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {typedIngredients.map((ingredient: IngredientRow) => {
                  const isLow =
                    ingredient.stockQuantity !== null &&
                    ingredient.stockQuantity < ingredient.reorderThreshold;
                  return (
                    <tr
                      key={ingredient._id}
                      className={
                        isLow ? "bg-red-50/50" : "hover:bg-stone-50/50"
                      }
                    >
                      <td className="px-5 py-3 font-medium text-stone-800">
                        {ingredient.name}
                      </td>
                      <td className="px-5 py-3 text-stone-600">
                        {ingredient.category ?? (
                          <span className="text-stone-300">--</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-stone-600">
                        {ingredient.unit}
                      </td>
                      <td className="px-5 py-3">
                        {editingStockId === ingredient._id ? (
                          <span className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={editingStockValue}
                              onChange={(e) =>
                                setEditingStockValue(Number(e.target.value))
                              }
                              className="w-20 border border-stone-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                            <button
                              onClick={() =>
                                handleSaveStock(ingredient._id)
                              }
                              className="text-xs text-amber-700 hover:text-amber-800 font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingStockId(null)}
                              className="text-xs text-stone-400 hover:text-stone-600"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingStockId(ingredient._id);
                              setEditingStockValue(
                                ingredient.stockQuantity ?? 0
                              );
                            }}
                            className={`font-mono text-sm ${
                              isLow
                                ? "text-red-600 font-semibold"
                                : "text-stone-700"
                            } hover:text-amber-700 transition-colors`}
                            title="Click to edit stock"
                          >
                            {ingredient.stockQuantity ?? 0}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3 text-stone-600 font-mono">
                        {ingredient.reorderThreshold}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            ingredient.status === "active"
                              ? "bg-green-50 text-green-700"
                              : "bg-stone-100 text-stone-500"
                          }`}
                        >
                          {ingredient.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="flex items-center justify-end gap-2">
                          {session.role === "owner" && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingIngredient(ingredient);
                                  setShowForm(true);
                                }}
                                className="text-xs text-amber-700 hover:text-amber-800 font-medium"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  handleToggleStatus(ingredient)
                                }
                                className="text-xs text-stone-400 hover:text-stone-600"
                              >
                                {ingredient.status === "active"
                                  ? "Deactivate"
                                  : "Activate"}
                              </button>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Low Stock Tab */}
      {activeTab === "lowstock" && (
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm overflow-hidden overflow-x-auto">
          {!locationId ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-stone-400">
                Select a location to view low stock
              </p>
            </div>
          ) : lowStock === undefined ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-stone-400">Loading...</p>
            </div>
          ) : lowStock.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-stone-400">
                All stock levels are above thresholds
              </p>
            </div>
          ) : (
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Category
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Current Stock
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Threshold
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Deficit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lowStock.map((item: LowStockRow) => (
                  <tr key={item._id} className="bg-red-50/50">
                    <td className="px-5 py-3 font-medium text-stone-800">
                      {item.name}
                    </td>
                    <td className="px-5 py-3 text-stone-600">
                      {item.category ?? (
                        <span className="text-stone-300">--</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-red-600 font-semibold font-mono">
                      {item.stockQuantity ?? 0} {item.unit}
                    </td>
                    <td className="px-5 py-3 text-stone-600 font-mono">
                      {item.reorderThreshold} {item.unit}
                    </td>
                    <td className="px-5 py-3 text-amber-700 font-semibold font-mono">
                      -{item.deficit} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Ingredient Form Modal */}
      {showForm && (
        <IngredientForm
          editingIngredient={editingIngredient}
          onClose={() => {
            setShowForm(false);
            setEditingIngredient(null);
          }}
        />
      )}
    </div>
  );
}
