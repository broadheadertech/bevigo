"use client";

import { useQuery, useMutation } from"convex/react";
import { api } from"../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useState } from"react";
import { Id } from"../../../convex/_generated/dataModel";
import { CategoryForm } from"@/components/menu/category-form";
import { ItemForm } from"@/components/menu/item-form";
import { ItemCard } from"@/components/menu/item-card";
import { ManagerMenuView } from"@/components/menu/manager-menu-view";

type Category = {
 _id: Id<"categories">;
 name: string;
 sortOrder: number;
 status:"active" |"inactive";
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
 status:"active" |"inactive" |"archived";
 tenantId: Id<"tenants">;
 updatedAt: number;
};

export default function MenuPage() {
 const { session, token } = useAuth();

 const categories = useQuery(
 api.menu.queries.listCategories,
 token ? { token } :"skip"
 ) as Category[] | undefined;

 const items = useQuery(
 api.menu.queries.listItems,
 token ? { token } :"skip"
 ) as MenuItem[] | undefined;

 const deactivateItem = useMutation(api.menu.mutations.deactivateItem);
 const reactivateItem = useMutation(api.menu.mutations.reactivateItem);
 const toggleFeatured = useMutation(api.menu.mutations.toggleFeatured);

 const [selectedCategoryId, setSelectedCategoryId] =
 useState<Id<"categories"> | null>(null);
 const [showCategoryForm, setShowCategoryForm] = useState(false);
 const [editingCategory, setEditingCategory] = useState<Category | null>(null);
 const [showItemForm, setShowItemForm] = useState(false);
 const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
 const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

 if (!token || !session) {
 return (
 <div className="flex items-center justify-center h-64">
 <p style={{ color: 'var(--muted-fg)' }}>Loading...</p>
 </div>
 );
 }

 // Managers get the location-scoped view
 if (session.role ==="manager") {
 return <ManagerMenuView />;
 }

 const typedCategories = categories ?? [];
 const typedItems = items ?? [];

 let filteredItems = selectedCategoryId
 ? typedItems.filter((item) => item.categoryId === selectedCategoryId)
 : typedItems;

 if (showFeaturedOnly) {
 filteredItems = filteredItems.filter((item) => item.isFeatured);
 }

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

 const handleToggleFeatured = async (itemId: Id<"menuItems">) => {
 if (!token) return;
 await toggleFeatured({ token, itemId });
 };

 return (
 <div>
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>Menu Management</h1>
 <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>Organize categories and menu items</p>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => {
 setEditingCategory(null);
 setShowCategoryForm(true);
 }}
 className="px-4 py-2.5 text-sm font-medium rounded-xl transition-colors"
 >
 + Add Category
 </button>
 <button
 onClick={() => {
 setEditingItem(null);
 setShowItemForm(true);
 }}
 className="px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg" style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
 >
 + Add Item
 </button>
 </div>
 </div>

 <div className="flex gap-6">
 {/* Categories sidebar */}
 <div className="w-56 shrink-0">
 <h2 className="text-xs font-medium uppercase tracking-wide mb-3 px-1">
 Categories
 </h2>
 <div className="flex flex-col gap-1">
 <button
 onClick={() => {
 setSelectedCategoryId(null);
 setShowFeaturedOnly(false);
 }}
 className="text-left px-3 py-2 rounded-xl text-sm transition-colors font-medium"
 style={selectedCategoryId === null && !showFeaturedOnly
  ? { backgroundColor: 'var(--muted)', color: 'var(--fg)' }
  : { color: 'var(--muted-fg)' }
 }
 >
 All Items
 <span className={`ml-1.5 text-xs ${selectedCategoryId === null && !showFeaturedOnly ?"" :""}`}>
 {typedItems.length}
 </span>
 </button>
 <button
 onClick={() => {
 setSelectedCategoryId(null);
 setShowFeaturedOnly(true);
 }}
 className={`text-left px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-1.5 ${
 showFeaturedOnly
 ?"bg-amber-500/10 text-amber-400 font-medium"
 :"hover:bg-stone-500/10"
 }`}
 >
 <span className="text-amber-500">&#9733;</span> Featured
 <span className="text-xs">
 {typedItems.filter((i) => i.isFeatured).length}
 </span>
 </button>
 {typedCategories.map((cat) => {
 const count = typedItems.filter(
 (i) => i.categoryId === cat._id
 ).length;
 return (
 <div key={cat._id} className="flex items-center group">
 <button
 onClick={() => {
 setSelectedCategoryId(cat._id);
 setShowFeaturedOnly(false);
 }}
 className="flex-1 text-left px-3 py-2 rounded-xl text-sm transition-colors font-medium"
 style={selectedCategoryId === cat._id && !showFeaturedOnly
  ? { backgroundColor: 'var(--muted)', color: 'var(--fg)' }
  : { color: 'var(--muted-fg)' }
 }
 >
 {cat.name}
 <span className={`ml-1.5 text-xs ${
 selectedCategoryId === cat._id && !showFeaturedOnly
 ?""
 :""
 }`}>
 {count}
 </span>
 {cat.status ==="inactive" && (
 <span className="ml-1 text-xs">
 (inactive)
 </span>
 )}
 </button>
 <button
 onClick={() => handleEditCategory(cat)}
 className="opacity-0 group-hover:opacity-100 text-xs hover:text-amber-400 px-1 transition-opacity"
 title="Edit category"
 >
 Edit
 </button>
 </div>
 );
 })}
 </div>

 {typedCategories.length === 0 && items !== undefined && (
 <p className="text-sm mt-2 px-1">
 No categories yet. Create one to get started.
 </p>
 )}
 </div>

 {/* Items grid */}
 <div className="flex-1">
 {items === undefined ? (
 <div className="flex items-center justify-center h-48">
 <p style={{ color: 'var(--muted-fg)' }}>Loading menu items...</p>
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
 onToggleFeatured={handleToggleFeatured}
 />
 ))}
 </div>
 ) : (
 <div className="flex items-center justify-center h-48">
 <p style={{ color: 'var(--muted-fg)' }}>
 {selectedCategoryId
 ?"No items in this category."
 :"No menu items yet. Add one to get started."}
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
