"use client";

import { useState } from "react";
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
};

type Ingredient = {
  _id: Id<"ingredients">;
  name: string;
  unit: string;
  category?: string;
  status: "active" | "inactive";
};

type RecipeEditorProps = {
  menuItemId: Id<"menuItems">;
  menuItemName: string;
};

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

  const addRecipeItem = useMutation(api.inventory.recipeMutations.addRecipeItem);
  const updateRecipeItem = useMutation(api.inventory.recipeMutations.updateRecipeItem);
  const removeRecipeItem = useMutation(api.inventory.recipeMutations.removeRecipeItem);

  const [selectedIngredientId, setSelectedIngredientId] =
    useState<Id<"ingredients"> | "">("");
  const [quantityUsed, setQuantityUsed] = useState(1);
  const [editingId, setEditingId] = useState<Id<"recipes"> | null>(null);
  const [editingQuantity, setEditingQuantity] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typedRecipeItems = recipeItems ?? [];
  const typedIngredients = ingredients ?? [];

  // Filter out ingredients already in the recipe
  const usedIngredientIds = new Set(
    typedRecipeItems.map((r: RecipeItem) => r.ingredientId as string)
  );
  const availableIngredients = typedIngredients.filter(
    (ing: Ingredient & { stockQuantity: number | null }) =>
      !usedIngredientIds.has(ing._id as string) && ing.status === "active"
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
      await updateRecipeItem({ token, recipeId, quantityUsed: editingQuantity });
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
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-6">
      <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-1">
        Recipe for {menuItemName}
      </h3>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-5">
        Ingredients consumed per unit sold
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {recipeItems === undefined ? (
        <p className="text-sm text-stone-400">Loading recipe...</p>
      ) : typedRecipeItems.length === 0 ? (
        <p className="text-sm text-stone-400 mb-4">
          No recipe defined yet. Add ingredients below.
        </p>
      ) : (
        <div className="mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 dark:border-stone-800">
                <th className="text-left py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Ingredient
                </th>
                <th className="text-left py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Quantity
                </th>
                <th className="text-left py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Unit
                </th>
                <th className="text-right py-2.5 text-xs font-medium text-stone-400 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {typedRecipeItems.map((item: RecipeItem) => (
                <tr key={item._id}>
                  <td className="py-2.5 text-stone-800 dark:text-stone-200">
                    {item.ingredientName}
                  </td>
                  <td className="py-2.5">
                    {editingId === item._id ? (
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={editingQuantity}
                        onChange={(e) =>
                          setEditingQuantity(Number(e.target.value))
                        }
                        className="w-20 border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    ) : (
                      <span className="text-stone-700">
                        {item.quantityUsed}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-stone-500">
                    {item.ingredientUnit}
                  </td>
                  <td className="py-2.5 text-right">
                    {editingId === item._id ? (
                      <span className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleUpdate(item._id)}
                          className="text-xs text-amber-700 hover:text-amber-800 font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-stone-400 hover:text-stone-600"
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
                          className="text-xs text-amber-700 hover:text-amber-800 font-medium"
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
      <div className="flex items-end gap-3 pt-3 border-t border-stone-100 dark:border-stone-800">
        <div className="flex-1">
          <label className="block text-xs font-medium text-stone-500 mb-1">
            Add Ingredient
          </label>
          <select
            value={selectedIngredientId as string}
            onChange={(e) =>
              setSelectedIngredientId(
                e.target.value as Id<"ingredients"> | ""
              )
            }
            className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
          >
            <option value="">Select ingredient...</option>
            {availableIngredients.map(
              (ing: Ingredient & { stockQuantity: number | null }) => (
                <option key={ing._id} value={ing._id}>
                  {ing.name} ({ing.unit})
                </option>
              )
            )}
          </select>
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium text-stone-500 mb-1">
            Qty
          </label>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={quantityUsed}
            onChange={(e) => setQuantityUsed(Number(e.target.value))}
            className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!selectedIngredientId || isAdding}
          className="px-4 py-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {isAdding ? "Adding..." : "Add"}
        </button>
      </div>
    </div>
  );
}
