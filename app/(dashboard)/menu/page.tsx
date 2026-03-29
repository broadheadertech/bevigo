"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { CategoryForm } from "@/components/menu/category-form";
import { ItemForm } from "@/components/menu/item-form";
import { ItemCard } from "@/components/menu/item-card";

type Category = {
  _id: Id<"categories">;
  name: string;
  sortOrder: number;
  status: "active" | "inactive";
  tenantId: Id<"tenants">;
  updatedAt: number;
};

type MenuItem = {
  _id: Id<"menuItems">;
  name: string;
  description?: string;
  basePrice: number;
  categoryId: Id<"categories">;
  isFeatured: boolean;
  sortOrder: number;
  status: "active" | "inactive" | "archived";
  tenantId: Id<"tenants">;
  updatedAt: number;
};

export default function MenuPage() {
  const { session, token } = useAuth();

  const categories = useQuery(
    api.menu.queries.listCategories,
    token ? { token } : "skip"
  ) as Category[] | undefined;

  const items = useQuery(
    api.menu.queries.listItems,
    token ? { token } : "skip"
  ) as MenuItem[] | undefined;

  const deactivateItem = useMutation(api.menu.mutations.deactivateItem);
  const reactivateItem = useMutation(api.menu.mutations.reactivateItem);

  const [selectedCategoryId, setSelectedCategoryId] =
    useState<Id<"categories"> | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const typedCategories = categories ?? [];
  const typedItems = items ?? [];

  const filteredItems = selectedCategoryId
    ? typedItems.filter((item) => item.categoryId === selectedCategoryId)
    : typedItems;

  const categoryMap = new Map(
    typedCategories.map((c) => [c._id, c.name])
  );

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setShowCategoryForm(true);
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setShowItemForm(true);
  };

  const handleDeactivate = async (itemId: Id<"menuItems">) => {
    if (!token) return;
    await deactivateItem({ token, itemId });
  };

  const handleReactivate = async (itemId: Id<"menuItems">) => {
    if (!token) return;
    await reactivateItem({ token, itemId });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Menu Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingCategory(null);
              setShowCategoryForm(true);
            }}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
          >
            + Add Category
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setShowItemForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Item
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Categories sidebar */}
        <div className="w-56 flex-shrink-0">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Categories
          </h2>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedCategoryId === null
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "hover:bg-gray-100 text-gray-700"
              }`}
            >
              All Items ({typedItems.length})
            </button>
            {typedCategories.map((cat) => {
              const count = typedItems.filter(
                (i) => i.categoryId === cat._id
              ).length;
              return (
                <div key={cat._id} className="flex items-center group">
                  <button
                    onClick={() => setSelectedCategoryId(cat._id)}
                    className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedCategoryId === cat._id
                        ? "bg-blue-100 text-blue-700 font-medium"
                        : "hover:bg-gray-100 text-gray-700"
                    }`}
                  >
                    {cat.name} ({count})
                    {cat.status === "inactive" && (
                      <span className="ml-1 text-xs text-gray-400">
                        (inactive)
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleEditCategory(cat)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-blue-600 px-1 transition-opacity"
                    title="Edit category"
                  >
                    Edit
                  </button>
                </div>
              );
            })}
          </div>

          {typedCategories.length === 0 && items !== undefined && (
            <p className="text-sm text-gray-400 mt-2">
              No categories yet. Create one to get started.
            </p>
          )}
        </div>

        {/* Items grid */}
        <div className="flex-1">
          {items === undefined ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-gray-400">Loading menu items...</p>
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  categoryName={categoryMap.get(item.categoryId)}
                  onEdit={handleEditItem}
                  onDeactivate={handleDeactivate}
                  onReactivate={handleReactivate}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-gray-400">
                {selectedCategoryId
                  ? "No items in this category."
                  : "No menu items yet. Add one to get started."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Category Form Modal */}
      {showCategoryForm && (
        <CategoryForm
          editingCategory={editingCategory}
          onClose={() => {
            setShowCategoryForm(false);
            setEditingCategory(null);
          }}
        />
      )}

      {/* Item Form Modal */}
      {showItemForm && (
        <ItemForm
          categories={typedCategories}
          editingItem={editingItem}
          defaultCategoryId={selectedCategoryId ?? undefined}
          onClose={() => {
            setShowItemForm(false);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}
