"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

type IngredientFormProps = {
  editingIngredient?: {
    _id: Id<"ingredients">;
    name: string;
    unit: string;
    category?: string;
    reorderThreshold: number;
    status: "active" | "inactive";
  } | null;
  onClose: () => void;
};

const UNIT_OPTIONS = ["g", "ml", "pcs", "kg", "L"];

export function IngredientForm({
  editingIngredient,
  onClose,
}: IngredientFormProps) {
  const { token } = useAuth();
  const createIngredient = useMutation(api.inventory.mutations.createIngredient);
  const updateIngredient = useMutation(api.inventory.mutations.updateIngredient);

  const [name, setName] = useState(editingIngredient?.name ?? "");
  const [unit, setUnit] = useState(editingIngredient?.unit ?? "g");
  const [category, setCategory] = useState(editingIngredient?.category ?? "");
  const [reorderThreshold, setReorderThreshold] = useState(
    editingIngredient?.reorderThreshold ?? 10
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingIngredient) {
        await updateIngredient({
          token,
          ingredientId: editingIngredient._id,
          name,
          unit,
          category: category || undefined,
          reorderThreshold,
        });
      } else {
        await createIngredient({
          token,
          name,
          unit,
          category: category || undefined,
          reorderThreshold,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-stone-200/60">
        <h2 className="text-lg font-bold text-stone-900 mb-4">
          {editingIngredient ? "Edit Ingredient" : "Add Ingredient"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              placeholder="e.g. Espresso Beans"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Unit *
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors bg-white"
            >
              {UNIT_OPTIONS.map((u: string) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              placeholder="e.g. Coffee, Dairy, Supplies"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Reorder Threshold *
            </label>
            <input
              type="number"
              required
              min={0}
              value={reorderThreshold}
              onChange={(e) => setReorderThreshold(Number(e.target.value))}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
            <p className="text-xs text-stone-400 mt-1">
              Alert when stock falls below this level
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-stone-700 border border-stone-200 rounded-xl hover:bg-stone-50 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-stone-900 text-white rounded-xl hover:bg-stone-800 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {isSubmitting
                ? "Saving..."
                : editingIngredient
                  ? "Update"
                  : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
