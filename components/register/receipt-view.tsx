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

type ReceiptPayment = {
 type: string;
 amount: number;
 tendered?: number;
 change?: number;
};

type BirInfo = {
 businessName: string | null;
 tradeName: string | null;
 businessAddress: string | null;
 tin: string | null;
 vatStatus: "vat" | "non_vat" | "vat_exempt" | null;
 accreditedSupplierName: string | null;
 accreditedSupplierAccreditation: string | null;
 accreditedSupplierDateIssued: number | null;
 accreditedSupplierDateValid: number | null;
 ptu: string | null;
 min: string | null;
 atp: string | null;
 birSerial: string | null;
 vatableSales: number | null;
 vatExemptSales: number | null;
 zeroRatedSales: number | null;
 srPwdType: "senior" | "pwd" | null;
 srPwdName: string | null;
 srPwdId: string | null;
};

type ReceiptData = {
 orderNumber: string;
 completedAt: number;
 locationName: string;
 locationAddress: string;
 baristaName: string;
 paymentType: string;
 payments: ReceiptPayment[];
 items: ReceiptItem[];
 subtotal: number;
 taxAmount: number;
 taxRate: number;
 taxLabel: string;
 total: number;
 discountAmount?: number;
 discountReason?: string | null;
 bir?: BirInfo;
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
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:p-0 print:bg-white print:block print:items-start">
 <div className="print-receipt rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden print:max-h-none print:block" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 {/* Close button - hidden in print */}
 <div className="flex justify-end px-4 pt-3 shrink-0 print:hidden">
 <button
 onClick={onClose}
 className="text-xl leading-none p-1 hover:opacity-80"
 style={{ color: 'var(--muted-fg)' }}
 >
 &#10005;
 </button>
 </div>

 {/* Receipt body — switches to BIR-compliant layout when the tenant
 has filled in TIN + business name in Settings → BIR. Otherwise
 falls back to the legacy header. */}
 <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-2 font-mono text-sm print:overflow-visible print:block">
 {(() => {
 const bir = receipt.bir;
 const usesBir = !!(bir && bir.tin && bir.businessName);
 const vatStatusLabel =
 bir?.vatStatus === "vat"
 ? "VAT REG TIN"
 : bir?.vatStatus === "non_vat"
 ? "NON-VAT TIN"
 : bir?.vatStatus === "vat_exempt"
 ? "VAT-EXEMPT TIN"
 : "TIN";

 return (
 <>
 {/* Header */}
 <div className="text-center mb-3">
 {usesBir ? (
 <>
 <p className="text-sm font-bold leading-tight">
 {bir!.businessName}
 </p>
 {bir!.tradeName && (
 <p className="text-xs italic leading-tight">
 ({bir!.tradeName})
 </p>
 )}
 <p className="text-xs leading-tight mt-0.5">
 {bir!.businessAddress ?? receipt.locationAddress}
 </p>
 <p className="text-xs leading-tight mt-0.5">
 {vatStatusLabel}: {bir!.tin}
 </p>
 <p className="text-xs leading-tight mt-1">
 {receipt.locationName}
 </p>
 </>
 ) : (
 <>
 <p className="text-base font-bold">{receipt.locationName}</p>
 {receipt.locationAddress && (
 <p className="text-xs mt-0.5">{receipt.locationAddress}</p>
 )}
 </>
 )}
 </div>

 {/* OR / SI heading */}
 <div className="text-center mb-2">
 {usesBir && (
 <p className="text-xs font-bold uppercase tracking-widest">
 {bir!.vatStatus === "non_vat"
 ? "Sales Invoice"
 : "Official Receipt"}
 </p>
 )}
 <p className="text-xs">
 #{bir?.birSerial ?? receipt.orderNumber}
 </p>
 <p className="text-xs">
 {formatDateTime(receipt.completedAt)}
 </p>
 </div>

 <div className="border-t border-dashed border-stone-300 my-2" />

 {/* Items */}
 <div className="space-y-1.5">
 {receipt.items.map((item: ReceiptItem, idx: number) => (
 <div key={idx}>
 <div className="flex justify-between">
 <span>
 {item.quantity > 1 && (
 <span style={{ color: "var(--muted-fg)" }}>
 {item.quantity}x{" "}
 </span>
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

 <div className="border-t border-dashed border-stone-300 my-2" />

 {/* VAT / Sales breakdown */}
 {usesBir ? (
 <div className="space-y-0.5 text-xs">
 <div className="flex justify-between">
 <span>Vatable sales</span>
 <span>{formatPrice(bir!.vatableSales ?? 0)}</span>
 </div>
 <div className="flex justify-between">
 <span>VAT-exempt sales</span>
 <span>{formatPrice(bir!.vatExemptSales ?? 0)}</span>
 </div>
 <div className="flex justify-between">
 <span>Zero-rated sales</span>
 <span>{formatPrice(bir!.zeroRatedSales ?? 0)}</span>
 </div>
 <div className="flex justify-between mt-1 pt-1 border-t border-stone-300">
 <span>Subtotal (gross)</span>
 <span>{formatPrice(receipt.subtotal)}</span>
 </div>
 {(receipt.discountAmount ?? 0) > 0 && (
 <div className="flex justify-between">
 <span>
 Less: {receipt.discountReason ?? "Discount"}
 </span>
 <span>− {formatPrice(receipt.discountAmount ?? 0)}</span>
 </div>
 )}
 <div className="flex justify-between">
 <span>
 {receipt.taxLabel} ({(receipt.taxRate / 100).toFixed(0)}%)
 </span>
 <span>{formatPrice(receipt.taxAmount)}</span>
 </div>
 <div className="flex justify-between font-bold text-base pt-1 border-t border-stone-300">
 <span>Total</span>
 <span>{formatPrice(receipt.total)}</span>
 </div>
 </div>
 ) : (
 <div className="space-y-1">
 <div className="flex justify-between">
 <span>Subtotal</span>
 <span>{formatPrice(receipt.subtotal)}</span>
 </div>
 <div className="flex justify-between text-xs">
 <span>
 {receipt.taxLabel} ({(receipt.taxRate / 100).toFixed(0)}%)
 </span>
 <span>{formatPrice(receipt.taxAmount)}</span>
 </div>
 <div className="flex justify-between font-bold text-base pt-1 border-t border-stone-300">
 <span>Total</span>
 <span>{formatPrice(receipt.total)}</span>
 </div>
 </div>
 )}

 {/* Payment type */}
 <div className="mt-3 text-center text-xs">
 <p>Paid by: {formatPaymentType(receipt.paymentType)}</p>
 </div>

 {/* Cash tender + change */}
 {receipt.payments.some(
 (p) => p.type === "cash" && p.tendered !== undefined
 ) && (
 <div className="mt-2 space-y-0.5">
 {receipt.payments
 .filter((p) => p.type === "cash" && p.tendered !== undefined)
 .map((p, idx) => (
 <div key={idx}>
 <div className="flex justify-between text-xs">
 <span>Cash tendered</span>
 <span>{formatPrice(p.tendered ?? 0)}</span>
 </div>
 <div className="flex justify-between text-xs">
 <span>Change</span>
 <span>{formatPrice(p.change ?? 0)}</span>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Senior/PWD block — BIR requires the cardholder's name, ID,
 and a signature line on every SC/PWD transaction. */}
 {bir?.srPwdType && (
 <>
 <div className="border-t border-dashed border-stone-300 my-2" />
 <div className="text-xs space-y-0.5">
 <p className="font-bold uppercase">
 {bir.srPwdType === "senior" ? "Senior Citizen" : "PWD"}{" "}
 Discount
 </p>
 <p>Name: {bir.srPwdName ?? "—"}</p>
 <p>
 {bir.srPwdType === "senior" ? "OSCA ID" : "PWD ID"}:{" "}
 {bir.srPwdId ?? "—"}
 </p>
 <p className="mt-3">Signature: ___________________</p>
 </div>
 </>
 )}

 <div className="border-t border-dashed border-stone-300 my-2" />

 {/* Cashier + BIR footer */}
 <div className="text-center text-[10px] leading-tight space-y-0.5">
 <p>Served by: {receipt.baristaName}</p>
 {usesBir && (
 <>
 {bir!.ptu && <p>PTU #: {bir!.ptu}</p>}
 {bir!.min && <p>MIN: {bir!.min}</p>}
 {bir!.atp && <p>ATP #: {bir!.atp}</p>}
 {bir!.accreditedSupplierName && (
 <p>
 Acc. by {bir!.accreditedSupplierName}
 {bir!.accreditedSupplierAccreditation
 ? ` (${bir!.accreditedSupplierAccreditation})`
 : ""}
 </p>
 )}
 <p className="mt-2 font-semibold uppercase">
 {bir!.vatStatus === "non_vat"
 ? "This invoice/receipt shall be valid for five (5) years from the date of the permit to use."
 : "This document is not valid for claim of input tax."}
 </p>
 <p>
 THIS RECEIPT SHALL BE VALID FOR FIVE (5) YEARS FROM THE
 DATE OF THE PERMIT TO USE.
 </p>
 </>
 )}
 <p className="text-stone-400 mt-2">Powered by bevi&amp;go</p>
 </div>
 </>
 );
 })()}
 </div>

 {/* Action buttons - hidden in print */}
 <div className="px-6 pb-6 pt-3 flex gap-3 shrink-0 print:hidden" style={{ borderTop: '1px solid var(--border-color)' }}>
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
