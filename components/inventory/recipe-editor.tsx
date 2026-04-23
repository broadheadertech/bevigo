"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

type RecipeItem = {
  _id: Id<"recipes">;
  ingredientId: Id<"ingredients">;
  ingredientName: string;
  ingredientUnit: string;
  quantityUsed: number;
  variantKey: string | null;
};

type Ingredient = {
  _id: Id<"ingredients">;
  name: string;
  unit: string;
  category?: string;
  status: "active" | "inactive";
};

type ModifierGroup = {
  _id: Id<"modifierGroups">;
  name: string;
  required: boolean;
  options: { _id: Id<"modifiers">; name: string }[];
};

type ItemDoc = { modifierGroups: ModifierGroup[] };

type RecipeEditorProps = {
  menuItemId: Id<"menuItems">;
  menuItemName: string;
};

type VariantTab = { key: string | null; label: string };

export function RecipeEditor({ menuItemId, menuItemName }: RecipeEditorProps) {
  const { token } = useAuth();

  const recipeItems = useQuery(
    api.inventory.recipeQueries.getRecipeForItem,
    token ? { token, menuItemId } : "skip"
  ) as RecipeItem[] | undefined;

  const ingredients = useQuery(
    api.inventory.queries.listIngredients,
    token ? { token } : "skip"
  ) as (Ingredient & { stockQuantity: number | null })[] | undefined;

  const itemData = useQuery(
    api.menu.queries.getItem,
    token ? { token, itemId: menuItemId } : "skip"
  ) as ItemDoc | undefined;

  const addRecipeItem = useMutation(api.inventory.recipeMutations.addRecipeItem);
  const updateRecipeItem = useMutation(
    api.inventory.recipeMutations.updateRecipeItem
  );
  const removeRecipeItem = useMutation(
    api.inventory.recipeMutations.removeRecipeItem
  );

  // Build the tab list: Base first, then one tab per option of every attached
  // modifier group. Operators usually only define variants for the "Size"
  // group, but we don't hard-code that — anything they attach can drive
  // recipe variants.
  const tabs = useMemo<VariantTab[]>(() => {
    const base: VariantTab = { key: null, label: "Base" };
    const variantTabs: VariantTab[] = [];
    for (const g of itemData?.modifierGroups ?? []) {
      for (const opt of g.options) {
        variantTabs.push({ key: opt.name, label: `${g.name}: ${opt.name}` });
      }
    }
    return [base, ...variantTabs];
  }, [itemData]);

  const [currentVariant, setCurrentVariant] = useState<string | null>(null);

  const [selectedIngredientId, setSelectedIngredientId] = useState<
    Id<"ingredients"> | ""
  >("");
  const [quantityUsed, setQuantityUsed] = useState(1);
  const [editingId, setEditingId] = useState<Id<"recipes"> | null>(null);
  const [editingQuantity, setEditingQuantity] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typedRecipeItems = recipeItems ?? [];
  const typedIngredients = ingredients ?? [];

  // Recipe rows for the currently selected variant only.
  const visibleRows = useMemo(
    () => typedRecipeItems.filter((r) => r.variantKey === currentVariant),
    [typedRecipeItems, currentVariant]
  );

  // Don't offer ingredients already used in THIS variant — operator can still
  // add the same ingredient to other variants.
  const usedInCurrentVariant = new Set(
    visibleRows.map((r) => r.ingredientId as string)
  );
  const availableIngredients = typedIngredients.filter(
    (ing) =>
      !usedInCurrentVariant.has(ing._id as string) && ing.status === "active"
  );

  const handleAdd = async () => {
    if (!token || !selectedIngredientId) return;
    setIsAdding(true);
    setError(null);
    try {
      await addRecipeItem({
        token,
        menuItemId,
        ingredientId: selectedIngredientId as Id<"ingredients">,
        quantityUsed,
        variantKey: currentVariant ?? undefined,
      });
      setSelectedIngredientId("");
      setQuantityUsed(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add ingredient");
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdate = async (recipeId: Id<"recipes">) => {
    if (!token) return;
    setError(null);
    try {
      await updateRecipeItem({
        token,
        recipeId,
        quantityUsed: editingQuantity,
      });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleRemove = async (recipeId: Id<"recipes">) => {
    if (!token) return;
    setError(null);
    try {
      await removeRecipeItem({ token, recipeId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  return (
    <div
      className="rounded-2xl border shadow-lg p-6"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border-color)",
      }}
    >
      <h3
        className="text-base font-semibold mb-1"
        style={{ color: "var(--fg)" }}
      >
        Recipe for {menuItemName}
      </h3>
      <p className="text-sm mb-4" style={{ color: "var(--muted-fg)" }}>
        Ingredients consumed per unit sold. Define a Base recipe and optionally
        a full recipe per modifier option (e.g. Size: 500ml). When a variant
        recipe exists, it fully replaces the Base for that option.
      </p>

      {/* Variant tabs */}
      {tabs.length > 1 && (
        <div
          className="flex flex-wrap gap-1 mb-5 pb-3"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          {tabs.map((tab) => {
            const isActive = currentVariant === tab.key;
            const rowCount = typedRecipeItems.filter(
              (r) => r.variantKey === tab.key
            ).length;
            return (
              <button
                key={tab.key ?? "_base"}
                onClick={() => setCurrentVariant(tab.key)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
                style={
                  isActive
                    ? {
                        backgroundColor: "var(--accent-color)",
                        color: "white",
                      }
                    : {
                        backgroundColor: "var(--muted)",
                        color: "var(--muted-fg)",
                      }
                }
              >
                {tab.label}
                <span className="ml-1.5 opacity-70">({rowCount})</span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      {recipeItems === undefined ? (
        <p className="text-sm">Loading recipe...</p>
      ) : visibleRows.length === 0 ? (
        <p
          className="text-sm mb-4"
          style={{ color: "var(--muted-fg)" }}
        >
          {currentVariant
            ? `No "${currentVariant}" variant defined. Add ingredients below — they'll be used instead of the Base recipe when this option is chosen.`
            : "No Base recipe defined yet. Add ingredients below."}
        </p>
      ) : (
        <div className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--muted)",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Ingredient
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Quantity
                </th>
                <th
                  className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Unit
                </th>
                <th
                  className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--muted-fg)" }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((item) => (
                <tr
                  key={item._id}
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <td className="px-5 py-3.5" style={{ color: "var(--fg)" }}>
                    {item.ingredientName}
                  </td>
                  <td className="px-5 py-3.5">
                    {editingId === item._id ? (
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={editingQuantity}
                        onChange={(e) =>
                          setEditingQuantity(Number(e.target.value))
                        }
                        className="w-20 rounded-2xl px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        style={{
                          backgroundColor: "var(--muted)",
                          color: "var(--fg)",
                          border: "1px solid var(--border-color)",
                        }}
                      />
                    ) : (
                      <span style={{ color: "var(--fg)" }}>
                        {item.quantityUsed}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">{item.ingredientUnit}</td>
                  <td className="py-2.5 text-right">
                    {editingId === item._id ? (
                      <span className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleUpdate(item._id)}
                          className="text-xs text-amber-400 hover:text-amber-300 font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingId(item._id);
                            setEditingQuantity(item.quantityUsed);
                          }}
                          className="text-xs text-amber-400 hover:text-amber-300 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemove(item._id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add ingredient row */}
      <div
        className="flex items-end gap-3 pt-3"
        style={{ borderTop: "1px solid var(--border-color)" }}
      >
        <div className="flex-1">
          <label
            className="block text-xs font-medium mb-1"
            style={{ color: "var(--muted-fg)" }}
          >
            Add ingredient to{" "}
            <strong>{currentVariant ?? "Base"}</strong>
          </label>
          <select
            value={selectedIngredientId as string}
            onChange={(e) =>
              setSelectedIngredientId(
                e.target.value as Id<"ingredients"> | ""
              )
            }
            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
          >
            <option value="">Select ingredient...</option>
            {availableIngredients.map((ing) => (
              <option key={ing._id} value={ing._id}>
                {ing.name} ({ing.unit})
              </option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label
            className="block text-xs font-medium mb-1"
            style={{ color: "var(--muted-fg)" }}
          >
            Qty
          </label>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={quantityUsed}
            onChange={(e) => setQuantityUsed(Number(e.target.value))}
            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!selectedIngredientId || isAdding}
          className="px-4 py-2 text-white rounded-xl disabled:opacity-50 text-sm font-medium transition-colors"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          {isAdding ? "Adding..." : "Add"}
        </button>
      </div>
    </div>
  );
}
