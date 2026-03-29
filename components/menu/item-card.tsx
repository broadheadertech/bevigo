"use client";

import { Id } from "../../convex/_generated/dataModel";

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

type ItemCardProps = {
  item: MenuItem;
  categoryName?: string;
  onEdit: (item: MenuItem) => void;
  onDeactivate: (itemId: Id<"menuItems">) => void;
  onReactivate: (itemId: Id<"menuItems">) => void;
};

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function ItemCard({
  item,
  categoryName,
  onEdit,
  onDeactivate,
  onReactivate,
}: ItemCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">{item.name}</h3>
          {item.isFeatured && (
            <span className="text-yellow-500" title="Featured">
              &#9733;
            </span>
          )}
        </div>
        <span
          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
            item.status === "active"
              ? "bg-green-100 text-green-700"
              : item.status === "inactive"
                ? "bg-gray-100 text-gray-500"
                : "bg-red-100 text-red-600"
          }`}
        >
          {item.status}
        </span>
      </div>

      {item.description && (
        <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>
      )}

      <div className="flex items-center justify-between mt-1">
        <span className="text-lg font-bold text-gray-900">
          P{formatPrice(item.basePrice)}
        </span>
        {categoryName && (
          <span className="text-xs text-gray-400">{categoryName}</span>
        )}
      </div>

      <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
        <button
          onClick={() => onEdit(item)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Edit
        </button>
        {item.status === "active" ? (
          <button
            onClick={() => onDeactivate(item._id)}
            className="text-sm text-orange-600 hover:text-orange-800"
          >
            Deactivate
          </button>
        ) : item.status === "inactive" ? (
          <button
            onClick={() => onReactivate(item._id)}
            className="text-sm text-green-600 hover:text-green-800"
          >
            Reactivate
          </button>
        ) : null}
      </div>
    </div>
  );
}
