"use client";

import { useQuery } from"convex/react";
import { api } from"../../convex/_generated/api";
import { Id } from"../../convex/_generated/dataModel";

type ReceiptModifier = {
 name: string;
 priceAdj: number;
};

type ReceiptItem = {
 name: string;
 quantity: number;
 subtotal: number;
 modifiers: ReceiptModifier[];
};

type ReceiptData = {
 orderNumber: string;
 completedAt: number;
 locationName: string;
 locationAddress: string;
 baristaName: string;
 paymentType: string;
 items: ReceiptItem[];
 subtotal: number;
 taxAmount: number;
 taxRate: number;
 taxLabel: string;
 total: number;
};

type ReceiptViewProps = {
 orderId: Id<"orders">;
 token: string;
 onClose: () => void;
};

function formatPrice(cents: number): string {
 return (cents / 100).toFixed(2);
}

function formatDateTime(timestamp: number): string {
 const date = new Date(timestamp);
 return date.toLocaleString("en-US", {
 year:"numeric",
 month:"short",
 day:"numeric",
 hour:"2-digit",
 minute:"2-digit",
 });
}

function formatPaymentType(type: string): string {
 switch (type) {
 case"cash":
 return"Cash";
 case"card":
 return"Card";
 case"ewallet":
 return"E-Wallet";
 default:
 return type;
 }
}

export function ReceiptView({ orderId, token, onClose }: ReceiptViewProps) {
 const receipt = useQuery(api.orders.queries.getReceipt, {
 token,
 orderId,
 }) as ReceiptData | null | undefined;

 if (receipt === undefined) {
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
 <div className="rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <p className="text-stone-500 text-sm">Loading receipt...</p>
 </div>
 </div>
 );
 }

 if (receipt === null) {
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
 <div className="rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <p className="text-red-600 text-sm">Receipt not found</p>
 <button
 onClick={onClose}
 className="mt-4 px-4 py-2 text-sm font-medium hover:text-stone-900"
 >
 Close
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:print:static">
 <div className="rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden print:shadow-none print:rounded-none print:max-w-none print:mx-0" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 {/* Close button - hidden in print */}
 <div className="flex justify-end px-4 pt-3 print:hidden">
 <button
 onClick={onClose}
 className="text-stone-400 text-xl leading-none p-1"
 >
 &#10005;
 </button>
 </div>

 {/* Receipt body */}
 <div className="px-6 pb-6 pt-2 font-mono text-sm">
 {/* Header */}
 <div className="text-center mb-4">
 <p className="text-base font-bold">{receipt.locationName}</p>
 {receipt.locationAddress && (
 <p className="text-xs mt-0.5">
 {receipt.locationAddress}
 </p>
 )}
 </div>

 {/* Order info */}
 <div className="text-center mb-3">
 <p className="text-xs">
 Order #{receipt.orderNumber}
 </p>
 <p className="text-xs">
 {formatDateTime(receipt.completedAt)}
 </p>
 </div>

 {/* Divider */}
 <div className="border-t border-dashed border-stone-300 my-3" />

 {/* Items */}
 <div className="space-y-2">
 {receipt.items.map((item: ReceiptItem, idx: number) => (
 <div key={idx}>
 <div className="flex justify-between">
 <span>
 {item.quantity > 1 && (
 <span style={{ color: 'var(--muted-fg)' }}>{item.quantity}x </span>
 )}
 {item.name}
 </span>
 <span className="ml-2 flex-shrink-0">
 {formatPrice(item.subtotal)}
 </span>
 </div>
 {item.modifiers.map(
 (mod: ReceiptModifier, modIdx: number) => (
 <div
 key={modIdx}
 className="flex justify-between text-xs pl-3"
 >
 <span>+ {mod.name}</span>
 {mod.priceAdj > 0 && (
 <span className="ml-2 flex-shrink-0">
 {formatPrice(mod.priceAdj)}
 </span>
 )}
 </div>
 )
 )}
 </div>
 ))}
 </div>

 {/* Divider */}
 <div className="border-t border-dashed border-stone-300 my-3" />

 {/* Totals */}
 <div className="space-y-1">
 <div className="flex justify-between">
 <span>Subtotal</span>
 <span>{formatPrice(receipt.subtotal)}</span>
 </div>
 <div className="flex justify-between text-xs">
 <span>
 {receipt.taxLabel} ({(receipt.taxRate * 100).toFixed(0)}%)
 </span>
 <span>{formatPrice(receipt.taxAmount)}</span>
 </div>
 <div className="flex justify-between font-bold text-base pt-1 border-t border-stone-300">
 <span>Total</span>
 <span>{formatPrice(receipt.total)}</span>
 </div>
 </div>

 {/* Payment type */}
 <div className="mt-3 text-center text-xs">
 <p>Paid by: {formatPaymentType(receipt.paymentType)}</p>
 </div>

 {/* Divider */}
 <div className="border-t border-dashed border-stone-300 my-3" />

 {/* Footer */}
 <div className="text-center text-xs space-y-1">
 <p>Served by: {receipt.baristaName}</p>
 <p className="text-stone-400 mt-2">Powered by bevi&amp;go</p>
 </div>
 </div>

 {/* Action buttons - hidden in print */}
 <div className="px-6 pb-6 flex gap-3 print:hidden">
 <button
 onClick={() => window.print()}
 className="flex-1 py-2.5 font-medium rounded-2xl hover:bg-stone-200 active:bg-stone-300 transition-colors text-sm"
 >
 Print
 </button>
 <button
 onClick={onClose}
 className="flex-1 py-2.5 text-white font-medium rounded-2xl hover:bg-stone-900 active:bg-stone-950 transition-colors text-sm"
 >
 Close
 </button>
 </div>
 </div>
 </div>
 );
}
