"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

type ModifierGroupFormProps = {
  editingGroup?: {
    _id: Id<"modifierGroups">;
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    sortOrder: number;
  } | null;
  onClose: () => void;
};

export function ModifierGroupForm({
  editingGroup,
  onClose,
}: ModifierGroupFormProps) {
  const { token } = useAuth();
  const createGroup = useMutation(
    api.menu.modifierMutations.createModifierGroup
  );
  const updateGroup = useMutation(
    api.menu.modifierMutations.updateModifierGroup
  );

  const [name, setName] = useState(editingGroup?.name ?? "");
  const [required, setRequired] = useState(editingGroup?.required ?? false);
  const [minSelect, setMinSelect] = useState(editingGroup?.minSelect ?? 0);
  const [maxSelect, setMaxSelect] = useState(editingGroup?.maxSelect ?? 1);
  const [sortOrder, setSortOrder] = useState(editingGroup?.sortOrder ?? 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    setError(null);

    if (maxSelect < minSelect) {
      setError("Max selections must be greater than or equal to min selections");
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingGroup) {
        await updateGroup({
          token,
          groupId: editingGroup._id,
          name,
          required,
          minSelect,
          maxSelect,
          sortOrder,
        });
      } else {
        await createGroup({
          token,
          name,
          required,
          minSelect,
          maxSelect,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">
          {editingGroup ? "Edit Modifier Group" : "Add Modifier Group"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g. Size, Milk Type, Add-ons"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <label
              htmlFor="required"
              className="text-sm font-medium text-gray-700"
            >
              Required selection
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Selections
              </label>
              <input
                type="number"
                min="0"
                value={minSelect}
                onChange={(e) => setMinSelect(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Selections
              </label>
              <input
                type="number"
                min="1"
                value={maxSelect}
                onChange={(e) => setMaxSelect(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving..."
                : editingGroup
                  ? "Update"
                  : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
