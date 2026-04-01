"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";

type ItemModifierAssignmentProps = {
  menuItemId: Id<"menuItems">;
  onClose: () => void;
};

type ModifierGroup = {
  _id: Id<"modifierGroups">;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
};

type AssignedGroup = {
  _id: Id<"modifierGroups">;
  name: string;
  required: boolean;
};

export function ItemModifierAssignment({
  menuItemId,
  onClose,
}: ItemModifierAssignmentProps) {
  const { token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allGroups = useQuery(
    api.menu.modifierQueries.listModifierGroups,
    token ? { token } : "skip"
  ) as (ModifierGroup & { modifiers: unknown[] })[] | undefined;

  const itemData = useQuery(
    api.menu.queries.getItem,
    token ? { token, itemId: menuItemId } : "skip"
  ) as { modifierGroups: AssignedGroup[] } | undefined;

  const assignToItem = useMutation(
    api.menu.modifierMutations.assignToItem
  );
  const removeFromItem = useMutation(
    api.menu.modifierMutations.removeFromItem
  );

  const assignedIds = new Set(
    itemData?.modifierGroups?.map((g) => g._id) ?? []
  );

  const handleToggle = async (groupId: Id<"modifierGroups">) => {
    if (!token) return;
    setIsSubmitting(true);

    try {
      if (assignedIds.has(groupId)) {
        await removeFromItem({
          token,
          menuItemId,
          modifierGroupId: groupId,
        });
      } else {
        await assignToItem({
          token,
          menuItemId,
          modifierGroupId: groupId,
        });
      }
    } catch {
      // Error handled by Convex reactivity
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-4">Assign Modifier Groups</h2>

        {allGroups === undefined ? (
          <p className="text-sm text-gray-400 py-4">
            Loading modifier groups...
          </p>
        ) : allGroups.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">
            No modifier groups available. Create one first.
          </p>
        ) : (
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {allGroups.map((group) => (
              <label
                key={group._id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={assignedIds.has(group._id)}
                  onChange={() => handleToggle(group._id)}
                  disabled={isSubmitting}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {group.name}
                    </span>
                    {group.required && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">
                        Required
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    Select {group.minSelect}-{group.maxSelect}
                  </span>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
