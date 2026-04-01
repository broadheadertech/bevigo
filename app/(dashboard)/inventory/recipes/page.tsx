"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { RecipeEditor } from "@/components/inventory/recipe-editor";

type MenuItem = {
  _id: Id<"menuItems">;
  name: string;
  description?: string;
  basePrice: number;
  categoryId: Id<"categories">;
  status: "active" | "inactive" | "archived";
};

type Category = {
  _id: Id<"categories">;
  name: string;
};

export default function RecipesPage() {
  const { session, token } = useAuth();

  const [selectedItemId, setSelectedItemId] =
    useState<Id<"menuItems"> | "">("");

  const menuItems = useQuery(
    api.menu.queries.listItems,
    token ? { token } : "skip"
  ) as MenuItem[] | undefined;

  const categories = useQuery(
    api.menu.queries.listCategories,
    token ? { token } : "skip"
  ) as Category[] | undefined;

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  const typedMenuItems = menuItems ?? [];
  const typedCategories = categories ?? [];
  const categoryMap = new Map(
    typedCategories.map((c: Category) => [c._id, c.name])
  );

  const activeItems = typedMenuItems.filter(
    (item: MenuItem) => item.status === "active"
  );

  const selectedItem = activeItems.find(
    (item: MenuItem) => item._id === selectedItemId
  );

  // Group items by category
  const groupedItems = new Map<string, MenuItem[]>();
  for (const item of activeItems) {
    const catName = categoryMap.get(item.categoryId) ?? "Uncategorized";
    const group = groupedItems.get(catName) ?? [];
    group.push(item);
    groupedItems.set(catName, group);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Recipes</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
          Define ingredient recipes for menu items
        </p>
      </div>

      <div className="flex gap-6">
        {/* Menu item selector sidebar */}
        <div className="w-64 shrink-0">
          <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-3 px-1">
            Menu Items
          </h2>

          {menuItems === undefined ? (
            <p className="text-sm text-stone-400 px-1">Loading...</p>
          ) : activeItems.length === 0 ? (
            <p className="text-sm text-stone-400 px-1">
              No active menu items found.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {Array.from(groupedItems.entries()).map(
                ([catName, items]: [string, MenuItem[]]) => (
                  <div key={catName}>
                    <p className="text-xs font-medium text-stone-400 px-3 mb-1">
                      {catName}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {items.map((item: MenuItem) => (
                        <button
                          key={item._id}
                          onClick={() =>
                            setSelectedItemId(item._id)
                          }
                          className={`text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                            selectedItemId === item._id
                              ? "bg-stone-900 text-white font-medium"
                              : "hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400"
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Recipe editor */}
        <div className="flex-1">
          {!selectedItemId ? (
            <div className="flex items-center justify-center h-64 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm">
              <div className="text-center">
                <p className="text-stone-400 text-sm">
                  Select a menu item to view or edit its recipe
                </p>
              </div>
            </div>
          ) : selectedItem ? (
            <RecipeEditor
              menuItemId={selectedItem._id}
              menuItemName={selectedItem.name}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
