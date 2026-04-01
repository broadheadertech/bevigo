"use client";

import Link from"next/link";
import { useQuery } from"convex/react";
import { api } from"../../convex/_generated/api";
import { Id } from"../../convex/_generated/dataModel";

type LowStockBannerProps = {
 token: string;
 locationId: Id<"locations">;
};

export function LowStockBanner({ token, locationId }: LowStockBannerProps) {
 const lowStockItems = useQuery(
 api.inventory.queries.getLowStock,
 { token, locationId }
 );

 // Still loading or no low stock items
 if (!lowStockItems || lowStockItems.length === 0) {
 return null;
 }

 const count = lowStockItems.length;
 const isCritical = lowStockItems.some(
 (item: { stockQuantity: number }) => item.stockQuantity <= 0
 );

 return (
 <Link href="/inventory">
 <div
 className={
 isCritical
 ?"bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-6 flex items-center justify-between cursor-pointer hover:bg-red-500/20 transition-colors"
 :"bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl px-4 py-3 mb-6 flex items-center justify-between cursor-pointer hover:bg-amber-500/20 transition-colors"
 }
 >
 <div className="flex items-center gap-2">
 <svg
 xmlns="http://www.w3.org/2000/svg"
 className="h-5 w-5 flex-shrink-0"
 viewBox="0 0 20 20"
 fill="currentColor"
 >
 <path
 fillRule="evenodd"
 d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
 clipRule="evenodd"
 />
 </svg>
 <span className="text-sm font-medium">
 {count} ingredient{count !== 1 ?"s" :""}{""}
 {count !== 1 ?"are" :"is"} low on stock
 {isCritical ?" — some are out of stock!" :""}
 </span>
 </div>
 <span className="text-xs font-medium opacity-70">
 View details →
 </span>
 </div>
 </Link>
 );
}
