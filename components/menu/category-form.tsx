"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

type CategoryFormProps = {
  editingCategory?: {
    _id: Id<"categories">;
    name: string;
    sortOrder: number;
    status: "active" | "inactive";
  } | null;
  onClose: () => void;
};

export function CategoryForm({ editingCategory, onClose }: CategoryFormProps) {
  const { token } = useAuth();
  const createCategory = useMutation(api.menu.mutations.createCategory);
  const updateCategory = useMutation(api.menu.mutations.updateCategory);

  const [name, setName] = useState(editingCategory?.name ?? "");
  const [sortOrder, setSortOrder] = useState(
    editingCategory?.sortOrder ?? 0
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingCategory) {
        await updateCategory({
          token,
          categoryId: editingCategory._id,
          name,
          sortOrder,
        });
      } else {
        await createCategory({
          token,
          name,
          sortOrder,
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
          {editingCategory ? "Edit Category" : "Add Category"}
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
              placeholder="e.g. Hot Drinks"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
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
                : editingCategory
                  ? "Update"
                  : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
