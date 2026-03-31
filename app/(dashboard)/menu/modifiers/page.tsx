"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { ModifierGroupForm } from "@/components/menu/modifier-group-form";
import { ModifierOptionList } from "@/components/menu/modifier-option-list";

type Modifier = {
  _id: Id<"modifiers">;
  name: string;
  priceAdjustment: number;
  sortOrder: number;
  status: "active" | "inactive";
};

type ModifierGroup = {
  _id: Id<"modifierGroups">;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  tenantId: Id<"tenants">;
  updatedAt: number;
  modifiers: Modifier[];
};

export default function ModifiersPage() {
  const { session, token } = useAuth();

  const groups = useQuery(
    api.menu.modifierQueries.listModifierGroups,
    token ? { token } : "skip"
  ) as ModifierGroup[] | undefined;

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const toggleExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleEditGroup = (group: ModifierGroup) => {
    setEditingGroup(group);
    setShowGroupForm(true);
  };

  const typedGroups = groups ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Modifier Groups</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage modifier options like sizes, milk types, and add-ons.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingGroup(null);
            setShowGroupForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Group
        </button>
      </div>

      {groups === undefined ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-400">Loading modifier groups...</p>
        </div>
      ) : typedGroups.length > 0 ? (
        <div className="flex flex-col gap-4">
          {typedGroups.map((group) => {
            const isExpanded = expandedGroups.has(group._id);
            const activeModifiers = group.modifiers.filter(
              (m) => m.status === "active"
            );

            return (
              <div
                key={group._id}
                className="bg-white rounded-lg shadow"
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => toggleExpanded(group._id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm">
                      {isExpanded ? "\u25BC" : "\u25B6"}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {group.name}
                        </h3>
                        {group.required && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Select {group.minSelect}-{group.maxSelect}
                        {" \u00B7 "}
                        {activeModifiers.length} active option
                        {activeModifiers.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditGroup(group);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <ModifierOptionList
                      groupId={group._id}
                      modifiers={group.modifiers}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-400">
            No modifier groups yet. Create one to get started.
          </p>
        </div>
      )}

      {showGroupForm && (
        <ModifierGroupForm
          editingGroup={editingGroup}
          onClose={() => {
            setShowGroupForm(false);
            setEditingGroup(null);
          }}
        />
      )}
    </div>
  );
}
