"use client";

import { useConvex, useQuery } from"convex/react";
import { api } from"../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useEffect, useLayoutEffect, useRef, useState, useMemo } from"react";
import { Id } from"../../../convex/_generated/dataModel";
import { exportToCSV } from"@/lib/export";
import { exportReportPDF } from"@/lib/export-pdf";
import { formatCurrency } from"@/lib/currency";
import { OrderDetailModal } from"@/components/orders/order-detail-modal";
import { Pagination, usePagination } from"@/components/ui/pagination";

type Tab ="daily" |"product" |"hourly" |"ledger";

type LineRow = {
 orderId: Id<"orders">;
 orderNumber: string;
 completedAt: number;
 status: string;
 isRefunded: boolean;
 paymentType: string;
 baristaName: string;
 customerName: string | null;
 tableName: string | null;
 itemName: string;
 modifiers: string;
 quantity: number;
 unitPrice: number; // base item price per unit (cents)
 lineSubtotal: number; // (base + modifier) * qty (cents)
 orderSubtotal: number;
 orderDiscount: number;
 orderTax: number;
 orderTotal: number;
};

type LedgerRow = {
 _id: Id<"orders">;
 orderNumber: string;
 completedAt: number;
 subtotal: number;
 total: number;
 paymentType: string;
 itemCount: number;
 status: string;
 baristaName: string;
 customerName: string | null;
 tableName: string | null;
 discountAmount: number | null;
 discountType: string | null;
 discountValue: number | null;
 discountReason: string | null;
 taxAmount?: number;
 taxRate?: number;
 taxLabel?: string;
 refundedAt: number | null;
 refundAmount: number | null;
};

type LocationOption = {
 _id: Id<"locations">;
 name: string;
 slug: string;
 status: string;
};

type DailySummaryResult = {
 totalRevenue: number;
 transactionCount: number;
 averageOrderValue: number;
 taxCollected: number;
};

type DailyDigestResult = {
 date: number;
 locationName: string;
 generatedAt: number;
 sales: {
 revenue: number;
 net: number;
 tax: number;
 avgTicket: number;
 orderCount: number;
 voidCount: number;
 refundCount: number;
 refundAmount: number;
 };
 tender: { cash: number; card: number; ewallet: number };
 products: {
 totalUnits: number;
 distinctItems: number;
 mix: Array<{
 name: string;
 qty: number;
 revenue: number;
 percentageOfRevenue: number;
 }>;
 };
 ingredients: {
 consumedCount: number;
 belowThresholdCount: number;
 outCount: number;
 rows: Array<{
 ingredientId: string;
 name: string;
 unit: string;
 category: string | null;
 openingStock: number;
 consumed: number;
 adjustment: number;
 closingStock: number;
 reorderThreshold: number;
 belowThreshold: boolean;
 isOut: boolean;
 }>;
 };
 operations: {
 peakHour: number;
 peakHourOrders: number;
 shiftCount: number;
 };
};

type ProductMixItem = {
 itemName: string;
 quantitySold: number;
 totalRevenue: number;
 percentageOfTotal: number;
};

type HourlyVolumeItem = {
 hour: number;
 transactionCount: number;
 revenue: number;
};

// Use LOCAL time for the day boundaries so a Manila operator picking
// "Apr 28" gets the Manila-Apr-28 window, not UTC-Apr-28. The previous
// implementation used Date.UTC() which leaked early-morning local orders
// into the wrong calendar day.
function todayStart(): number {
 const now = new Date();
 return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function todayEnd(): number {
 return todayStart() + 24 * 60 * 60 * 1000 - 1;
}

function dateToTimestamp(dateStr: string): number {
 // LOCAL midnight for the picked date — matches how the operator thinks
 // about "today" in their wall clock (vs UTC, which silently shifts).
 const parts = dateStr.split("-");
 return new Date(
 parseInt(parts[0], 10),
 parseInt(parts[1], 10) - 1,
 parseInt(parts[2], 10)
 ).getTime();
}

function timestampToDateStr(ts: number): string {
 const d = new Date(ts);
 const year = d.getFullYear();
 const month = String(d.getMonth() + 1).padStart(2,"0");
 const day = String(d.getDate()).padStart(2,"0");
 return `${year}-${month}-${day}`;
}

export default function ReportsPage() {
 const { session, token } = useAuth();
 const convex = useConvex();
 const [viewOrderId, setViewOrderId] = useState<Id<"orders"> | null>(null);
 const [exportingItems, setExportingItems] = useState(false);

 const defaultStart = useMemo(() => todayStart(), []);
 const defaultEnd = useMemo(() => todayEnd(), []);

 const [activeTab, setActiveTab] = useState<Tab>("daily");
 // Free-text filter applied client-side. Behaviour per tab:
 //   - Product Mix : matches item name
 //   - Sales Ledger: matches order #, cashier, customer, table, or payment
 //   - Daily / Hourly: ignored (no obvious attribute to filter on)
 const [filterQuery, setFilterQuery] = useState("");
 const [startDateStr, setStartDateStr] = useState(
 timestampToDateStr(defaultStart)
 );
 const [endDateStr, setEndDateStr] = useState(
 timestampToDateStr(defaultEnd)
 );
 const [selectedLocationId, setSelectedLocationId] = useState<string>("");

 const startDate = useMemo(
 () => dateToTimestamp(startDateStr),
 [startDateStr]
 );
 const endDate = useMemo(
 () => dateToTimestamp(endDateStr) + 24 * 60 * 60 * 1000 - 1,
 [endDateStr]
 );

 const locationId = selectedLocationId
 ? (selectedLocationId as Id<"locations">)
 : undefined;

 const locations = useQuery(
 api.settings.queries.listLocations,
 token ? { token } :"skip"
 ) as LocationOption[] | undefined;

 // Filter locations for managers
 const availableLocations = useMemo(() => {
 if (!locations || !session) return [];
 if (session.role ==="owner") return locations;
 return locations.filter((loc: LocationOption) =>
 session.locationIds.includes(loc._id)
 );
 }, [locations, session]);

 const dailySummary = useQuery(
 api.reports.queries.dailySummary,
 token && activeTab ==="daily"
 ? { token, startDate, endDate, locationId }
 :"skip"
 ) as DailySummaryResult | undefined;

 // Rich daily digest (the "what happened today" report). Requires a
 // specific location because opening/closing stock is per-location.
 const dailyDigest = useQuery(
 api.reports.dailyDigest.dailyDigest,
 token && activeTab ==="daily" && locationId
 ? { token, date: dateToTimestamp(startDateStr), locationId }
 :"skip"
 ) as DailyDigestResult | undefined;

 const productMix = useQuery(
 api.reports.queries.productMix,
 token && activeTab ==="product"
 ? { token, startDate, endDate, locationId }
 :"skip"
 ) as ProductMixItem[] | undefined;

 const hourlyVolume = useQuery(
 api.reports.queries.hourlyVolume,
 token && activeTab ==="hourly"
 ? { token, date: dateToTimestamp(startDateStr), locationId }
 :"skip"
 ) as HourlyVolumeItem[] | undefined;

 const ledger = useQuery(
 api.orders.historyQueries.listOrderHistory,
 token && activeTab ==="ledger" && (session?.role ==="owner" || session?.role ==="manager")
 ? {
 token,
 locationId,
 startDate,
 endDate,
 limit: 1000,
 }
 :"skip"
 ) as LedgerRow[] | undefined;

 // Live per-line view used by both the on-screen table AND the CSV.
 // Subscribed only on the ledger tab so we don't pull thousands of
 // rows for users browsing other tabs.
 const ledgerLines = useQuery(
 api.orders.historyQueries.listOrderHistoryLineItems,
 token && activeTab ==="ledger" && (session?.role ==="owner" || session?.role ==="manager")
 ? {
 token,
 locationId,
 startDate,
 endDate,
 limit: 5000,
 }
 :"skip"
 ) as LineRow[] | undefined;

 if (!token || !session) {
 return (
 <div className="flex items-center justify-center h-64">
 <p style={{ color: 'var(--muted-fg)' }}>Loading...</p>
 </div>
 );
 }

 const tabs: Array<{ key: Tab; label: string }> = [
 { key:"ledger", label:"Sales Ledger" },
 { key:"daily", label:"Daily Summary" },
 { key:"product", label:"Product Mix" },
 { key:"hourly", label:"Hourly Volume" },
 ];

 return (
 <div>
 <div className="mb-8">
 <h1 className="text-lg md:text-xl font-bold" style={{ color: 'var(--fg)' }}>Sales Reports</h1>
 <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>Track revenue, products, and hourly trends</p>
 </div>

 {/* Filter Bar */}
 <div className="rounded-2xl border shadow-lg p-4 mb-6">
 <div className="flex flex-wrap gap-4 items-end">
 <button
 onClick={async () => {
 if (activeTab ==="daily" && dailySummary) {
 // If a single location is picked, export the FULL digest as a
 // multi-section CSV (sales / product mix / ingredients). Otherwise
 // fall back to the 4-stat summary.
 if (dailyDigest) {
 exportDailyDigestCSV(dailyDigest);
 } else {
 exportToCSV([{
 totalRevenue: dailySummary.totalRevenue,
 transactionCount: dailySummary.transactionCount,
 averageOrderValue: dailySummary.averageOrderValue,
 taxCollected: dailySummary.taxCollected,
 }],"daily-summary.csv");
 }
 } else if (activeTab ==="product" && productMix) {
 exportToCSV(productMix.map((item: ProductMixItem) => ({
 itemName: item.itemName,
 quantitySold: item.quantitySold,
 totalRevenue: item.totalRevenue,
 percentageOfTotal: item.percentageOfTotal,
 })),"product-mix.csv");
 } else if (activeTab ==="hourly" && hourlyVolume) {
 exportToCSV(hourlyVolume.map((h: HourlyVolumeItem) => ({
 hour: formatHour(h.hour),
 transactionCount: h.transactionCount,
 revenue: h.revenue,
 })),"hourly-volume.csv");
 } else if (activeTab ==="ledger" && token) {
 // Sales Ledger export = ONE ROW PER ORDER, with every item + its
 // modifiers consolidated into a single readable cell, and payment +
 // total combined. Pulled on demand so we capture every line even if
 // the on-screen ledger is paginated.
 setExportingItems(true);
 try {
 const rows = await convex.query(
 api.orders.historyQueries.listOrderHistoryLineItems,
 {
 token,
 locationId,
 startDate,
 endDate,
 limit: 5000,
 }
 );
 if (!rows || rows.length === 0) {
 alert("No items to export in this date range.");
 return;
 }
 type LineRow = {
 orderId: string;
 orderNumber: string;
 completedAt: number;
 status: string;
 isRefunded: boolean;
 paymentType: string;
 baristaName: string;
 customerName: string | null;
 tableName: string | null;
 itemName: string;
 modifiers: string;
 quantity: number;
 unitPrice: number;
 lineSubtotal: number;
 orderSubtotal: number;
 orderDiscount: number;
 orderTax: number;
 orderTotal: number;
 };

 const fmtPay = (p: string) => {
 if (!p) return "—";
 if (p === "ewallet") return "E-Wallet";
 if (p === "split") return "Split";
 return p.charAt(0).toUpperCase() + p.slice(1);
 };

 // Cross-reference the on-screen ledger so the CSV's per-order
 // discount/tax/total values are correct even when the line-items
 // query response is missing the canonical per-order fields.
 const ledgerById = new Map<string, LedgerRow>();
 for (const row of (ledger ?? []) as LedgerRow[]) {
 ledgerById.set(row._id, row);
 }

 // Modifier price = lineSubtotal/qty − unit (base) price. The
 // server's lineSubtotal already bakes in modifier adjustments, so
 // subtracting the base unit price recovers the per-unit modifier
 // contribution. Multiply by quantity for the line's modifier total.
 const modifierTotal = (l: LineRow) => l.lineSubtotal - l.unitPrice * l.quantity;

 // ONE ROW PER LINE ITEM. Order context (discount/tax/payment/total)
 // repeats on every row of the same order — that's what the operator
 // wants so they can pivot/group in their spreadsheet however they
 // like.
 const sortedRows = [...(rows as LineRow[])].sort(
 (a, b) => b.completedAt - a.completedAt
 );

 exportToCSV(
 sortedRows.map((r) => {
 const status =
 r.status === "voided"
 ? "Voided"
 : r.isRefunded
 ? "Refunded"
 : "Completed";
 const modTotalPerUnit = modifierTotal(r) / r.quantity;
 const fromLedger = ledgerById.get(r.orderId);
 const orderDiscount =
 fromLedger?.discountAmount ??
 (Number.isFinite(r.orderDiscount) ? r.orderDiscount : 0);
 const subtotal = fromLedger?.subtotal ?? r.orderSubtotal ?? 0;
 const orderTotal = fromLedger?.total ?? r.orderTotal ?? 0;
 const derivedTax = orderTotal - subtotal + (orderDiscount ?? 0);
 const tax = Number.isFinite(fromLedger?.taxAmount as number)
 ? (fromLedger?.taxAmount as number)
 : Number.isFinite(r.orderTax)
 ? r.orderTax
 : Number.isFinite(derivedTax)
 ? derivedTax
 : 0;

 // Per-line discount allocation: spread the order-level discount
 // across each line proportionally to its share of the subtotal.
 // r.lineSubtotal already includes modifiers, so rate × line is
 // the line's share of the discount in pesos.
 const lineDiscount =
 subtotal > 0
 ? Math.round(((orderDiscount ?? 0) * r.lineSubtotal) / subtotal)
 : 0;

 const unitPrice = r.lineSubtotal; // pre-discount line total
 const lineTotalAfterDiscount = unitPrice - lineDiscount;

 return {
"Date/Time": new Date(r.completedAt).toLocaleString(),
"Order #": r.orderNumber,
"Status": status,
"Cashier": r.baristaName,
"Customer / Table": r.customerName ?? r.tableName ?? "",
"Item": r.itemName,
"Base Price": (r.unitPrice / 100).toFixed(2),
"Modifier": r.modifiers || "",
"Modifier Price": (modTotalPerUnit / 100).toFixed(2),
"Qty": r.quantity,
"Unit Price": (unitPrice / 100).toFixed(2),
"Discount": (lineDiscount / 100).toFixed(2),
"Total": (lineTotalAfterDiscount / 100).toFixed(2),
"Tax": (tax / 100).toFixed(2),
"Payment Method": fmtPay(r.paymentType),
 };
 }),
"sales-ledger.csv"
 );
 } catch (err) {
 alert(err instanceof Error ? err.message :"Export failed");
 } finally {
 setExportingItems(false);
 }
 }
 }}
 disabled={exportingItems}
 className="btn-ghost px-3 py-2 text-sm rounded-xl"
 >
 {activeTab ==="ledger" && exportingItems ?"Preparing…" :"Export CSV"}
 </button>
 <button
 onClick={() => {
 if (activeTab ==="daily" && dailySummary) {
 exportReportPDF(
"Daily Summary",
 [{
"Total Revenue": formatCurrency(dailySummary.totalRevenue),
"Transactions": String(dailySummary.transactionCount),
"Avg Order Value": formatCurrency(dailySummary.averageOrderValue),
"Tax Collected": formatCurrency(dailySummary.taxCollected),
 }],
 [
 { key:"Total Revenue", label:"Total Revenue" },
 { key:"Transactions", label:"Transactions" },
 { key:"Avg Order Value", label:"Avg Order Value" },
 { key:"Tax Collected", label:"Tax Collected" },
 ],
 {
"Total Revenue": formatCurrency(dailySummary.totalRevenue),
"Transactions": String(dailySummary.transactionCount),
 }
 );
 } else if (activeTab ==="product" && productMix) {
 exportReportPDF(
"Product Mix",
 productMix.map((item: ProductMixItem) => ({
"Item Name": item.itemName,
"Qty Sold": String(item.quantitySold),
"Revenue": formatCurrency(item.totalRevenue),
"% of Total": `${item.percentageOfTotal.toFixed(1)}%`,
 })),
 [
 { key:"Item Name", label:"Item Name" },
 { key:"Qty Sold", label:"Qty Sold" },
 { key:"Revenue", label:"Revenue" },
 { key:"% of Total", label:"% of Total" },
 ]
 );
 } else if (activeTab ==="hourly" && hourlyVolume) {
 exportReportPDF(
"Hourly Volume",
 hourlyVolume.map((h: HourlyVolumeItem) => ({
"Hour": formatHour(h.hour),
"Transactions": String(h.transactionCount),
"Revenue": formatCurrency(h.revenue),
 })),
 [
 { key:"Hour", label:"Hour" },
 { key:"Transactions", label:"Transactions" },
 { key:"Revenue", label:"Revenue" },
 ]
 );
 }
 }}
 className="btn-ghost px-3 py-2 text-sm rounded-xl"
 >
 Export PDF
 </button>
 </div>
 <div className="flex flex-wrap gap-4 items-end mt-3">
 <div>
 <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 Start Date
 </label>
 <input
 type="date"
 value={startDateStr}
 onChange={(e) => setStartDateStr(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />
 </div>
 <div>
 <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 End Date
 </label>
 <input
 type="date"
 value={endDateStr}
 onChange={(e) => setEndDateStr(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />
 </div>
 <div>
 <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 Location
 </label>
 <select
 value={selectedLocationId}
 onChange={(e) => setSelectedLocationId(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors" style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 <option value="">All Locations</option>
 {availableLocations.map((loc: LocationOption) => (
 <option key={loc._id} value={loc._id}>
 {loc.name}
 </option>
 ))}
 </select>
 </div>
 {(activeTab === "ledger" || activeTab === "product") && (
 <div className="flex-1 min-w-50">
 <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted-fg)' }}>
 Filter
 </label>
 <input
 type="search"
 value={filterQuery}
 onChange={(e) => setFilterQuery(e.target.value)}
 placeholder={
 activeTab === "product"
 ? "Item name… (comma-separate for multiple)"
 : "Order #, customer, cashier, payment… (comma-separate for multiple)"
 }
 className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
 style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />
 </div>
 )}
 </div>
 </div>

 {/* Tab pills */}
 <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
 {tabs.map((tab: { key: Tab; label: string }) => (
 <button
 key={tab.key}
 onClick={() => setActiveTab(tab.key)}
 className="px-4 py-2 text-sm font-medium rounded-full transition-colors"
 style={activeTab === tab.key
  ? { backgroundColor: 'var(--accent-color)', color: 'white' }
  : { backgroundColor: 'var(--muted)', color: 'var(--muted-fg)' }
 }
 >
 {tab.label}
 </button>
 ))}
 </div>

 {/* Tab Content */}
 {activeTab ==="ledger" && (
 <LedgerTab lines={ledgerLines} ledger={ledger} onView={(id) => setViewOrderId(id)} filterQuery={filterQuery} />
 )}
 {activeTab ==="daily" && (
 <DailySummaryTab data={dailySummary} digest={dailyDigest} hasLocation={!!locationId} />
 )}
 {activeTab ==="product" && (
 <ProductMixTab data={productMix} filterQuery={filterQuery} />
 )}
 {activeTab ==="hourly" && (
 <HourlyVolumeTab data={hourlyVolume} />
 )}

 {viewOrderId && (
 <OrderDetailModal
 orderId={viewOrderId}
 onClose={() => setViewOrderId(null)}
 canRefund={false}
 />
 )}
 </div>
 );
}

type ColId =
 | "datetime"
 | "orderNumber"
 | "status"
 | "cashier"
 | "customer"
 | "item"
 | "basePrice"
 | "modifier"
 | "modifierPrice"
 | "qty"
 | "unitPrice"
 | "discount"
 | "total"
 | "tax"
 | "payment";

type ColDef = {
 id: ColId;
 label: string;
 align: "left" | "right";
 width?: string;
};

const DEFAULT_COLS: ColDef[] = [
 { id: "datetime", label: "Date / Time", align: "left", width: "170px" },
 { id: "orderNumber", label: "Order #", align: "left" },
 { id: "status", label: "Status", align: "left" },
 { id: "cashier", label: "Cashier", align: "left" },
 { id: "customer", label: "Customer / Table", align: "left" },
 { id: "item", label: "Item", align: "left" },
 { id: "basePrice", label: "Base Price", align: "right" },
 { id: "modifier", label: "Modifier", align: "left" },
 { id: "modifierPrice", label: "Modifier Price", align: "right" },
 { id: "qty", label: "Qty", align: "right" },
 { id: "unitPrice", label: "Unit Price", align: "right" },
 { id: "discount", label: "Discount", align: "right" },
 { id: "total", label: "Total", align: "right" },
 { id: "tax", label: "Tax", align: "right" },
 { id: "payment", label: "Payment Method", align: "left" },
];

type ColPref = { id: ColId; visible: boolean };
const PREF_KEY = "bevigo:reports:ledger-cols";

function loadColPrefs(): ColPref[] {
 if (typeof window === "undefined") return DEFAULT_COLS.map((c) => ({ id: c.id, visible: true }));
 try {
 const raw = localStorage.getItem(PREF_KEY);
 if (!raw) return DEFAULT_COLS.map((c) => ({ id: c.id, visible: true }));
 const saved = JSON.parse(raw) as ColPref[];
 // Merge: keep saved order/visibility for known cols, append any new cols.
 const known = new Set(saved.map((p) => p.id));
 const merged: ColPref[] = saved.filter((p) =>
 DEFAULT_COLS.some((c) => c.id === p.id)
 );
 for (const c of DEFAULT_COLS) {
 if (!known.has(c.id)) merged.push({ id: c.id, visible: true });
 }
 return merged;
 } catch {
 return DEFAULT_COLS.map((c) => ({ id: c.id, visible: true }));
 }
}

function LedgerTab({
 lines,
 ledger,
 onView,
 filterQuery,
}: {
 lines: LineRow[] | undefined;
 ledger: LedgerRow[] | undefined;
 onView: (orderId: Id<"orders">) => void;
 filterQuery: string;
}) {
 const [colPrefs, setColPrefs] = useState<ColPref[]>(() => loadColPrefs());
 const [showColsPopover, setShowColsPopover] = useState(false);

 useEffect(() => {
 if (typeof window === "undefined") return;
 try {
 localStorage.setItem(PREF_KEY, JSON.stringify(colPrefs));
 } catch {
 /* ignore */
 }
 }, [colPrefs]);

 const colDefById = useMemo(() => new Map(DEFAULT_COLS.map((c) => [c.id, c])), []);
 const visibleCols = colPrefs
 .filter((p) => p.visible)
 .map((p) => colDefById.get(p.id))
 .filter((c): c is ColDef => Boolean(c));

 // Dual scroll bar — wide ledger tables need a horizontal scrollbar at
 // the top too, so the operator doesn't have to scroll all the way down
 // to drag the bottom one. Refs sync the two scrollers in both
 // directions; the top track's inner div is sized to match the actual
 // table content width so the scrollbar thumbs stay proportional.
 const topScrollRef = useRef<HTMLDivElement | null>(null);
 const bottomScrollRef = useRef<HTMLDivElement | null>(null);
 const topInnerRef = useRef<HTMLDivElement | null>(null);
 const tableRef = useRef<HTMLTableElement | null>(null);
 const syncFromTop = (e: React.UIEvent<HTMLDivElement>) => {
 if (bottomScrollRef.current) {
 bottomScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
 }
 };
 const syncFromBottom = (e: React.UIEvent<HTMLDivElement>) => {
 if (topScrollRef.current) {
 topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
 }
 };
 useLayoutEffect(() => {
 // Match the top inner spacer to the real table width so the top
 // scrollbar thumb mirrors the bottom one. Re-runs on column changes
 // and window resize.
 const sync = () => {
 if (topInnerRef.current && tableRef.current) {
 topInnerRef.current.style.width = `${tableRef.current.scrollWidth}px`;
 }
 };
 sync();
 const ro = new ResizeObserver(sync);
 if (tableRef.current) ro.observe(tableRef.current);
 window.addEventListener("resize", sync);
 return () => {
 ro.disconnect();
 window.removeEventListener("resize", sync);
 };
 }, [colPrefs]);

 if (!lines) {
 return (
 <div className="text-center py-12" style={{ color: "var(--muted-fg)" }}>
 Loading sales ledger…
 </div>
 );
 }

 // Filter: comma-separated tokens OR'd. Match anywhere meaningful.
 const trimmed = filterQuery.trim().toLowerCase();
 const tokens = trimmed
 ? trimmed.split(",").map((t) => t.trim()).filter(Boolean)
 : [];
 const matchLine = (l: LineRow, t: string) => {
 if (l.orderNumber.toLowerCase().includes(t)) return true;
 if (l.baristaName.toLowerCase().includes(t)) return true;
 if ((l.customerName ?? "").toLowerCase().includes(t)) return true;
 if ((l.tableName ?? "").toLowerCase().includes(t)) return true;
 if (l.itemName.toLowerCase().includes(t)) return true;
 if (l.modifiers.toLowerCase().includes(t)) return true;
 if (l.paymentType.toLowerCase().includes(t)) return true;
 const alias = t.replace(/[-\s]/g, "");
 if (l.paymentType.toLowerCase().replace(/[-\s]/g, "").includes(alias))
 return true;
 return false;
 };
 const filtered = tokens.length
 ? lines.filter((l) => tokens.some((t) => matchLine(l, t)))
 : lines;

 const ledgerById = new Map<string, LedgerRow>();
 for (const r of ledger ?? []) ledgerById.set(r._id, r);

 // Build per-line render rows with derived per-line discount + total.
 const renderRows = filtered
 .slice()
 .sort((a, b) => b.completedAt - a.completedAt)
 .map((l) => {
 const fromLedger = ledgerById.get(l.orderId);
 const orderDiscount =
 fromLedger?.discountAmount ??
 (Number.isFinite(l.orderDiscount) ? l.orderDiscount : 0);
 const orderSubtotal = fromLedger?.subtotal ?? l.orderSubtotal ?? 0;
 const orderTotal = fromLedger?.total ?? l.orderTotal ?? 0;
 const derivedTax = orderTotal - orderSubtotal + (orderDiscount ?? 0);
 const tax = Number.isFinite(fromLedger?.taxAmount as number)
 ? (fromLedger?.taxAmount as number)
 : Number.isFinite(l.orderTax)
 ? l.orderTax
 : Number.isFinite(derivedTax)
 ? derivedTax
 : 0;
 const lineDiscount =
 orderSubtotal > 0
 ? Math.round(((orderDiscount ?? 0) * l.lineSubtotal) / orderSubtotal)
 : 0;
 const modPerUnit =
 (l.lineSubtotal - l.unitPrice * l.quantity) / Math.max(1, l.quantity);
 return {
 ...l,
 lineDiscount,
 lineTotalAfterDiscount: l.lineSubtotal - lineDiscount,
 modPerUnit,
 tax,
 };
 });

 const totals = renderRows.reduce(
 (acc, r) => ({
 unitPriceSum: acc.unitPriceSum + r.lineSubtotal,
 discountSum: acc.discountSum + r.lineDiscount,
 totalSum: acc.totalSum + r.lineTotalAfterDiscount,
 qtySum: acc.qtySum + r.quantity,
 }),
 { unitPriceSum: 0, discountSum: 0, totalSum: 0, qtySum: 0 }
 );

 if (renderRows.length === 0) {
 return (
 <div className="space-y-4">
 <LedgerToolbar
 colPrefs={colPrefs}
 setColPrefs={setColPrefs}
 showPopover={showColsPopover}
 setShowPopover={setShowColsPopover}
 />
 <div
 className="text-center py-12 rounded-2xl"
 style={{
 backgroundColor: "var(--card)",
 border: "1px solid var(--border-color)",
 color: "var(--muted-fg)",
 }}
 >
 {trimmed
 ? `No items match "${filterQuery.trim()}" in this date range.`
 : "No items in this date range."}
 </div>
 </div>
 );
 }

 const renderCell = (col: ColDef, r: (typeof renderRows)[number]) => {
 switch (col.id) {
 case "datetime":
 return (
 <span style={{ color: "var(--muted-fg)" }}>
 {new Date(r.completedAt).toLocaleString(undefined, {
 month: "short",
 day: "numeric",
 hour: "numeric",
 minute: "2-digit",
 hour12: true,
 })}
 </span>
 );
 case "orderNumber":
 return (
 <button
 onClick={() => onView(r.orderId)}
 className="font-mono underline hover:opacity-80 active:opacity-60"
 style={{ color: "var(--accent-color)" }}
 >
 {r.orderNumber}
 </button>
 );
 case "status":
 return (
 <span
 className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
 style={
 r.status === "voided"
 ? { backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }
 : r.isRefunded
 ? { backgroundColor: "rgba(245,158,11,0.15)", color: "#d97706" }
 : { backgroundColor: "rgba(16,185,129,0.15)", color: "#059669" }
 }
 >
 {r.status === "voided" ? "Voided" : r.isRefunded ? "Refunded" : "Completed"}
 </span>
 );
 case "cashier":
 return <span style={{ color: "var(--fg)" }}>{r.baristaName}</span>;
 case "customer":
 return (
 <span style={{ color: "var(--muted-fg)" }}>
 {r.customerName ?? r.tableName ?? "—"}
 </span>
 );
 case "item":
 return <span style={{ color: "var(--fg)" }}>{r.itemName}</span>;
 case "basePrice":
 return <span className="font-mono">{formatCurrency(r.unitPrice)}</span>;
 case "modifier":
 return (
 <span style={{ color: "var(--muted-fg)" }}>{r.modifiers || "—"}</span>
 );
 case "modifierPrice":
 return (
 <span className="font-mono">
 {r.modPerUnit !== 0 ? formatCurrency(Math.round(r.modPerUnit)) : "—"}
 </span>
 );
 case "qty":
 return <span className="font-mono">{r.quantity}</span>;
 case "unitPrice":
 return <span className="font-mono">{formatCurrency(r.lineSubtotal)}</span>;
 case "discount":
 return (
 <span
 className="font-mono"
 style={{
 color: r.lineDiscount > 0 ? "#ef4444" : "var(--muted-fg)",
 }}
 >
 {r.lineDiscount > 0 ? `− ${formatCurrency(r.lineDiscount)}` : "—"}
 </span>
 );
 case "total":
 return (
 <span className="font-mono font-semibold" style={{ color: "var(--fg)" }}>
 {formatCurrency(r.lineTotalAfterDiscount)}
 </span>
 );
 case "tax":
 return <span className="font-mono">{formatCurrency(r.tax)}</span>;
 case "payment":
 return (
 <span className="capitalize" style={{ color: "var(--muted-fg)" }}>
 {r.paymentType === "ewallet"
 ? "E-Wallet"
 : r.paymentType === "split"
 ? "Split"
 : r.paymentType}
 </span>
 );
 default:
 return null;
 }
 };

 return (
 <div className="space-y-4">
 <LedgerToolbar
 colPrefs={colPrefs}
 setColPrefs={setColPrefs}
 showPopover={showColsPopover}
 setShowPopover={setShowColsPopover}
 />

 {/* Top scroll bar — synced with the bottom scroller below. The inner
 spacer div has its width set in the layout effect above to match the
 table's real scrollWidth so the thumb is proportional. */}
 <div
 ref={topScrollRef}
 onScroll={syncFromTop}
 className="overflow-x-auto"
 style={{
 height: 14,
 backgroundColor: "var(--card)",
 border: "1px solid var(--border-color)",
 borderRadius: "0.75rem 0.75rem 0 0",
 borderBottom: "none",
 }}
 >
 <div ref={topInnerRef} style={{ height: 1 }} />
 </div>

 <div
 ref={bottomScrollRef}
 onScroll={syncFromBottom}
 className="shadow-lg overflow-x-auto"
 style={{
 backgroundColor: "var(--card)",
 border: "1px solid var(--border-color)",
 borderRadius: "0 0 1rem 1rem",
 }}
 >
 <table ref={tableRef} className="w-full text-xs">
 <thead>
 <tr
 style={{
 backgroundColor: "var(--muted)",
 borderBottom: "1px solid var(--border-color)",
 }}
 >
 {visibleCols.map((c) => (
 <th
 key={c.id}
 className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}
 style={{ color: "var(--muted-fg)", width: c.width }}
 >
 {c.label}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 {renderRows.map((r, i) => (
 <tr
 key={`${r.orderId}-${i}`}
 style={{
 borderBottom: "1px solid var(--border-color)",
 opacity: r.status === "voided" ? 0.5 : 1,
 }}
 >
 {visibleCols.map((c) => (
 <td
 key={c.id}
 className={`px-3 py-2 whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}
 >
 {renderCell(c, r)}
 </td>
 ))}
 </tr>
 ))}
 </tbody>
 <tfoot>
 <tr
 style={{
 backgroundColor: "var(--muted)",
 borderTop: "1px solid var(--border-color)",
 }}
 >
 {visibleCols.map((c, idx) => {
 if (idx === 0) {
 return (
 <td
 key={c.id}
 colSpan={1}
 className="px-3 py-2.5 text-xs uppercase tracking-widest font-semibold"
 style={{ color: "var(--muted-fg)" }}
 >
 Totals · {renderRows.length} line
 {renderRows.length === 1 ? "" : "s"}
 </td>
 );
 }
 if (c.id === "qty") {
 return (
 <td key={c.id} className="px-3 py-2.5 text-right font-mono font-semibold">
 {totals.qtySum}
 </td>
 );
 }
 if (c.id === "unitPrice") {
 return (
 <td key={c.id} className="px-3 py-2.5 text-right font-mono font-semibold">
 {formatCurrency(totals.unitPriceSum)}
 </td>
 );
 }
 if (c.id === "discount") {
 return (
 <td
 key={c.id}
 className="px-3 py-2.5 text-right font-mono font-semibold"
 style={{
 color: totals.discountSum > 0 ? "#ef4444" : "var(--muted-fg)",
 }}
 >
 − {formatCurrency(totals.discountSum)}
 </td>
 );
 }
 if (c.id === "total") {
 return (
 <td
 key={c.id}
 className="px-3 py-2.5 text-right font-mono font-bold"
 style={{ color: "var(--accent-color)" }}
 >
 {formatCurrency(totals.totalSum)}
 </td>
 );
 }
 return <td key={c.id}></td>;
 })}
 </tr>
 </tfoot>
 </table>
 </div>

 <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
 One row per item. Discount is allocated per line (line ÷ order subtotal × order discount).
 Total = Unit Price − Discount.
 </p>
 </div>
 );
}

/**
 * Toolbar above the ledger with the "Columns" button and its popover.
 * Reorder is via up/down chevrons (tablet-friendly — no native HTML5
 * drag, which isn't reliable on touch devices).
 */
function LedgerToolbar({
 colPrefs,
 setColPrefs,
 showPopover,
 setShowPopover,
}: {
 colPrefs: ColPref[];
 setColPrefs: (p: ColPref[]) => void;
 showPopover: boolean;
 setShowPopover: (v: boolean) => void;
}) {
 const colDefById = useMemo(
 () => new Map(DEFAULT_COLS.map((c) => [c.id, c])),
 []
 );
 const move = (idx: number, dir: -1 | 1) => {
 const next = [...colPrefs];
 const swap = idx + dir;
 if (swap < 0 || swap >= next.length) return;
 [next[idx], next[swap]] = [next[swap], next[idx]];
 setColPrefs(next);
 };
 const toggle = (idx: number) => {
 const next = [...colPrefs];
 next[idx] = { ...next[idx], visible: !next[idx].visible };
 setColPrefs(next);
 };
 const reset = () => {
 setColPrefs(DEFAULT_COLS.map((c) => ({ id: c.id, visible: true })));
 };
 const visibleCount = colPrefs.filter((p) => p.visible).length;

 return (
 <div className="flex items-center justify-end relative">
 <button
 onClick={() => setShowPopover(!showPopover)}
 className="px-3 py-2 text-xs font-semibold rounded-xl transition-colors active:scale-95 inline-flex items-center gap-1.5"
 style={{
 backgroundColor: "var(--muted)",
 color: "var(--fg)",
 border: "1px solid var(--border-color)",
 }}
 >
 <svg
 className="w-3.5 h-3.5"
 fill="none"
 viewBox="0 0 24 24"
 stroke="currentColor"
 strokeWidth={2}
 >
 <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
 </svg>
 Columns ({visibleCount})
 </button>

 {showPopover && (
 <>
 {/* Click-away */}
 <div
 className="fixed inset-0 z-40"
 onClick={() => setShowPopover(false)}
 />
 <div
 className="absolute right-0 top-full mt-2 z-50 rounded-2xl shadow-2xl w-80 max-h-[70vh] overflow-y-auto"
 style={{
 backgroundColor: "var(--card)",
 border: "1px solid var(--border-color)",
 }}
 >
 <div
 className="px-4 py-3 flex items-center justify-between"
 style={{ borderBottom: "1px solid var(--border-color)" }}
 >
 <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
 Columns
 </p>
 <button
 onClick={reset}
 className="text-xs underline"
 style={{ color: "var(--muted-fg)" }}
 >
 Reset
 </button>
 </div>
 <ul className="p-2 space-y-1">
 {colPrefs.map((p, idx) => {
 const def = colDefById.get(p.id);
 if (!def) return null;
 return (
 <li
 key={p.id}
 className="flex items-center gap-2 px-2 py-1.5 rounded-xl"
 style={{ backgroundColor: "var(--muted)" }}
 >
 <input
 type="checkbox"
 checked={p.visible}
 onChange={() => toggle(idx)}
 className="w-4 h-4 accent-amber-500"
 />
 <span className="flex-1 text-sm" style={{ color: "var(--fg)" }}>
 {def.label}
 </span>
 <button
 onClick={() => move(idx, -1)}
 disabled={idx === 0}
 aria-label="Move up"
 className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 active:scale-95"
 style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
 >
 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
 </svg>
 </button>
 <button
 onClick={() => move(idx, 1)}
 disabled={idx === colPrefs.length - 1}
 aria-label="Move down"
 className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 active:scale-95"
 style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
 >
 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 </li>
 );
 })}
 </ul>
 <p className="px-4 py-2 text-[10px]" style={{ color: "var(--muted-fg)" }}>
 Saved per device.
 </p>
 </div>
 </>
 )}
 </div>
 );
}

function SummaryCard({
 label,
 value,
 sub,
 highlight,
}: { label: string; value: string; sub?: string; highlight?: boolean }) {
 return (
 <div
 className="rounded-2xl p-4"
 style={{
 backgroundColor: highlight ? 'var(--accent-color)' : 'var(--card)',
 border: '1px solid var(--border-color)',
 color: highlight ? 'white' : 'var(--fg)',
 }}
 >
 <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70">
 {label}
 </p>
 <p className="text-xl font-bold mt-1 font-mono">{value}</p>
 {sub && (
 <p className="text-[10px] mt-0.5 opacity-70">{sub}</p>
 )}
 </div>
 );
}

function DailySummaryTab({
 data,
 digest,
 hasLocation,
}: {
 data: DailySummaryResult | undefined;
 digest: DailyDigestResult | undefined;
 hasLocation: boolean;
}) {
 if (!data) {
 return <div className="text-center py-12">Loading summary…</div>;
 }

 // Top KPI strip works whether or not a location is picked.
 const cards: Array<{ label: string; value: string }> = [
 { label:"Total Revenue", value: formatCurrency(data.totalRevenue) },
 { label:"Transactions", value: String(data.transactionCount) },
 { label:"Avg Order Value", value: formatCurrency(data.averageOrderValue) },
 { label:"Tax Collected", value: formatCurrency(data.taxCollected) },
 ];

 return (
 <div className="space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
 {cards.map((card) => (
 <div
 key={card.label}
 className="rounded-2xl border shadow-lg p-6"
 style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}
 >
 <p className="text-xs font-medium uppercase tracking-wide mb-2">
 {card.label}
 </p>
 <p className="text-2xl font-bold">{card.value}</p>
 </div>
 ))}
 </div>

 {!hasLocation ? (
 <DigestEmpty
 msg="Pick a single location above to see the full daily digest (product mix, ingredients consumed, opening/closing stock)."
 />
 ) : !digest ? (
 <div className="text-center py-12" style={{ color: "var(--muted-fg)" }}>
 Loading daily digest…
 </div>
 ) : (
 <DigestSections digest={digest} />
 )}
 </div>
 );
}

function DigestEmpty({ msg }: { msg: string }) {
 return (
 <div
 className="rounded-3xl p-8 text-center text-sm"
 style={{
 backgroundColor: 'var(--card)',
 border: '1px solid var(--border-color)',
 color: 'var(--muted-fg)',
 }}
 >
 {msg}
 </div>
 );
}

function DigestSections({ digest }: { digest: DailyDigestResult }) {
 const tenderTotal =
 digest.tender.cash + digest.tender.card + digest.tender.ewallet;
 const tenderPct = (n: number) =>
 tenderTotal > 0 ? `${((n / tenderTotal) * 100).toFixed(0)}%` : "—";
 const fmtHour = (h: number) => `${h}:00–${h + 1}:00`;

 return (
 <>
 {/* Sales / Operations strip */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <DigestCard label="Net" value={formatCurrency(digest.sales.net)} />
 <DigestCard label="Tax" value={formatCurrency(digest.sales.tax)} />
 <DigestCard
 label="Refunds"
 value={`${digest.sales.refundCount} · ${formatCurrency(digest.sales.refundAmount)}`}
 />
 <DigestCard
 label="Voids"
 value={String(digest.sales.voidCount)}
 sub={`${digest.operations.shiftCount} shift${digest.operations.shiftCount === 1 ? "" : "s"}`}
 />
 </div>

 <div className="grid md:grid-cols-2 gap-4">
 <DigestPanel title={`Tender mix · peak ${fmtHour(digest.operations.peakHour)} (${digest.operations.peakHourOrders} orders)`}>
 <div className="space-y-2">
 <RowKV label={`Cash (${tenderPct(digest.tender.cash)})`} value={formatCurrency(digest.tender.cash)} />
 <RowKV label={`Card (${tenderPct(digest.tender.card)})`} value={formatCurrency(digest.tender.card)} />
 <RowKV label={`E-Wallet (${tenderPct(digest.tender.ewallet)})`} value={formatCurrency(digest.tender.ewallet)} />
 </div>
 </DigestPanel>

 <DigestPanel title="Products sold today">
 <div className="space-y-2">
 <RowKV label="Total units" value={String(digest.products.totalUnits)} />
 <RowKV label="Distinct items" value={String(digest.products.distinctItems)} />
 <RowKV
 label="Ingredients consumed"
 value={`${digest.ingredients.consumedCount} of ${digest.ingredients.rows.length}`}
 />
 <RowKV
 label="Below reorder threshold"
 value={`${digest.ingredients.belowThresholdCount}${digest.ingredients.outCount > 0 ? ` (${digest.ingredients.outCount} out of stock)` : ""}`}
 />
 </div>
 </DigestPanel>
 </div>

 {/* Product mix table */}
 <ProductMixPanel rows={digest.products.mix} />

 {/* Ingredient open/close + consumption table */}
 <IngredientStockPanel rows={digest.ingredients.rows} />
 </>
 );
}

function ProductMixPanel({
 rows,
}: {
 rows: DailyDigestResult["products"]["mix"];
}) {
 const { paginatedItems, currentPage, totalPages, setCurrentPage } =
 usePagination(rows, 10);
 return (
 <DigestPanel title={`Product mix (${rows.length} item${rows.length === 1 ? "" : "s"})`}>
 {rows.length === 0 ? (
 <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
 No items sold today.
 </p>
 ) : (
 <>
 <div className="overflow-x-auto">
 <table className="w-full text-xs min-w-[500px]">
 <thead>
 <tr style={{ color: "var(--muted-fg)" }} className="text-[10px] uppercase tracking-widest">
 <th className="text-left py-2">Item</th>
 <th className="text-right py-2">Qty</th>
 <th className="text-right py-2">Revenue</th>
 <th className="text-right py-2">% of revenue</th>
 </tr>
 </thead>
 <tbody>
 {paginatedItems.map((p) => (
 <tr key={p.name} style={{ borderTop: "1px solid var(--border-color)" }}>
 <td className="py-2" style={{ color: "var(--fg)" }}>{p.name}</td>
 <td className="py-2 text-right font-mono">{p.qty}</td>
 <td className="py-2 text-right font-mono">{formatCurrency(p.revenue)}</td>
 <td className="py-2 text-right font-mono" style={{ color: "var(--muted-fg)" }}>
 {p.percentageOfRevenue.toFixed(1)}%
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Pagination
 currentPage={currentPage}
 totalPages={totalPages}
 onPageChange={setCurrentPage}
 />
 </>
 )}
 </DigestPanel>
 );
}

function IngredientStockPanel({
 rows,
}: {
 rows: DailyDigestResult["ingredients"]["rows"];
}) {
 const { paginatedItems, currentPage, totalPages, setCurrentPage } =
 usePagination(rows, 10);
 return (
 <DigestPanel title="Ingredient stock (opening, consumed, adjustments, closing)">
 <p className="text-[11px] mb-2" style={{ color: "var(--muted-fg)" }}>
 Opening stock is reconstructed from today&apos;s consumption + adjustments —
 best treated as approximate; a real stocktake still wins.
 </p>
 <div className="overflow-x-auto">
 <table className="w-full text-xs min-w-[640px]">
 <thead>
 <tr style={{ color: "var(--muted-fg)" }} className="text-[10px] uppercase tracking-widest">
 <th className="text-left py-2">Ingredient</th>
 <th className="text-right py-2">Opening</th>
 <th className="text-right py-2">Consumed</th>
 <th className="text-right py-2">Adjustments</th>
 <th className="text-right py-2">Closing</th>
 <th className="text-right py-2">Threshold</th>
 </tr>
 </thead>
 <tbody>
 {paginatedItems.map((r) => {
 const closingColor = r.isOut
 ? "#ef4444"
 : r.belowThreshold
 ? "#f59e0b"
 : "var(--fg)";
 return (
 <tr key={r.ingredientId} style={{ borderTop: "1px solid var(--border-color)" }}>
 <td className="py-2" style={{ color: "var(--fg)" }}>
 {r.name}
 {r.category && (
 <span className="ml-2 text-[10px]" style={{ color: "var(--muted-fg)" }}>
 {r.category}
 </span>
 )}
 </td>
 <td className="py-2 text-right font-mono">
 {r.openingStock.toFixed(1)}{r.unit}
 </td>
 <td className="py-2 text-right font-mono" style={{ color: r.consumed > 0 ? "var(--accent-color)" : "var(--muted-fg)" }}>
 {r.consumed > 0 ? `−${r.consumed.toFixed(1)}${r.unit}` : "—"}
 </td>
 <td className="py-2 text-right font-mono" style={{ color: "var(--muted-fg)" }}>
 {r.adjustment === 0 ? "—" : `${r.adjustment > 0 ? "+" : ""}${r.adjustment.toFixed(1)}${r.unit}`}
 </td>
 <td className="py-2 text-right font-mono font-semibold" style={{ color: closingColor }}>
 {r.closingStock.toFixed(1)}{r.unit}
 </td>
 <td className="py-2 text-right font-mono" style={{ color: "var(--muted-fg)" }}>
 {r.reorderThreshold}{r.unit}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 <Pagination
 currentPage={currentPage}
 totalPages={totalPages}
 onPageChange={setCurrentPage}
 />
 </DigestPanel>
 );
}

function DigestCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
 return (
 <div
 className="rounded-2xl p-5"
 style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}
 >
 <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--muted-fg)' }}>
 {label}
 </p>
 <p className="text-xl font-bold" style={{ color: 'var(--fg)' }}>{value}</p>
 {sub && (
 <p className="text-[10px] mt-1" style={{ color: 'var(--muted-fg)' }}>{sub}</p>
 )}
 </div>
 );
}

function DigestPanel({ title, children }: { title: string; children: React.ReactNode }) {
 return (
 <div
 className="rounded-3xl p-5"
 style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}
 >
 <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-fg)' }}>
 {title}
 </h3>
 {children}
 </div>
 );
}

function RowKV({ label, value }: { label: string; value: string }) {
 return (
 <div className="flex justify-between text-sm">
 <span style={{ color: 'var(--muted-fg)' }}>{label}</span>
 <span className="font-medium" style={{ color: 'var(--fg)' }}>{value}</span>
 </div>
 );
}

function ProductMixTab({
 data,
 filterQuery,
}: {
 data: ProductMixItem[] | undefined;
 filterQuery: string;
}) {
 if (!data) {
 return (
 <div className="text-center py-12">
 Loading product mix...
 </div>
 );
 }

 const trimmed = filterQuery.trim().toLowerCase();
 const tokens = trimmed
 ? trimmed.split(",").map((t) => t.trim()).filter(Boolean)
 : [];
 const filteredData = tokens.length
 ? data.filter((it) =>
 tokens.some((t) => it.itemName.toLowerCase().includes(t))
 )
 : data;

 if (filteredData.length === 0) {
 return (
 <div className="text-center py-12" style={{ color: 'var(--muted-fg)' }}>
 {trimmed
 ? `No items match "${filterQuery.trim()}".`
 : "No sales data for this period."}
 </div>
 );
 }

 return (
 <div className="rounded-3xl shadow-lg overflow-hidden overflow-x-auto" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <table className="w-full min-w-[500px]">
 <thead>
 <tr style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
 <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Item Name
 </th>
 <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Qty Sold
 </th>
 <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 Revenue
 </th>
 <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
 % of Total
 </th>
 </tr>
 </thead>
 <tbody>
 {filteredData.map((item: ProductMixItem) => (
 <tr
 key={item.itemName}
 className="transition-colors"
 style={{ borderBottom: '1px solid var(--border-color)' }}
 >
 <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--fg)' }}>{item.itemName}</td>
 <td className="px-5 py-3.5 text-right">
 {item.quantitySold}
 </td>
 <td className="px-5 py-3.5 text-right">
 {formatCurrency(item.totalRevenue)}
 </td>
 <td className="px-5 py-3.5 text-right">
 {item.percentageOfTotal.toFixed(1)}%
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

function HourlyVolumeTab({
 data,
}: {
 data: HourlyVolumeItem[] | undefined;
}) {
 if (!data) {
 return (
 <div className="text-center py-12">
 Loading hourly data...
 </div>
 );
 }

 const maxCount = Math.max(
 ...data.map((h: HourlyVolumeItem) => h.transactionCount),
 1
 );
 const peakHour = data.reduce(
 (
 peak: HourlyVolumeItem,
 curr: HourlyVolumeItem
 ) => (curr.transactionCount > peak.transactionCount ? curr : peak),
 data[0]
 );

 const hasData = data.some(
 (h: HourlyVolumeItem) => h.transactionCount > 0
 );

 if (!hasData) {
 return (
 <div className="text-center py-12">
 No sales data for this date.
 </div>
 );
 }

 return (
 <div className="rounded-2xl border shadow-lg p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <p className="text-sm mb-4">
 Peak hour:{""}
 <span className="font-semibold">
 {formatHour(peakHour.hour)}
 </span>{""}
 ({peakHour.transactionCount} transactions,{""}
 {formatCurrency(peakHour.revenue)})
 </p>
 <div className="flex items-end gap-1" style={{ height:"200px" }}>
 {data.map((h: HourlyVolumeItem) => {
 const heightPct =
 maxCount > 0 ? (h.transactionCount / maxCount) * 100 : 0;
 const isPeak = h.hour === peakHour.hour && h.transactionCount > 0;
 return (
 <div
 key={h.hour}
 className="flex-1 flex flex-col items-center justify-end h-full"
 >
 <div
 className={`w-full rounded-t transition-all ${
 isPeak ?"bg-amber-600" :"bg-amber-300"
 }`}
 style={{
 height: `${heightPct}%`,
 minHeight: h.transactionCount > 0 ?"4px" :"0px",
 }}
 title={`${formatHour(h.hour)}: ${h.transactionCount} txns, ${formatCurrency(h.revenue)}`}
 />
 <span className="text-xs mt-1">
 {h.hour % 3 === 0 ? formatHourShort(h.hour) :""}
 </span>
 </div>
 );
 })}
 </div>
 </div>
 );
}


function formatHour(hour: number): string {
 if (hour === 0) return"12 AM";
 if (hour < 12) return `${hour} AM`;
 if (hour === 12) return"12 PM";
 return `${hour - 12} PM`;
}

function formatHourShort(hour: number): string {
 if (hour === 0) return"12a";
 if (hour < 12) return `${hour}a`;
 if (hour === 12) return"12p";
 return `${hour - 12}p`;
}

/**
 * Daily digest export = a multi-section CSV (Sales / Tender / Products /
 * Ingredient stock). exportToCSV writes one table at a time; we stitch the
 * sections together manually with section headers + blank lines so it
 * opens cleanly in Excel/Sheets/Numbers.
 */
function exportDailyDigestCSV(d: DailyDigestResult) {
 const dayStr = new Date(d.date).toISOString().slice(0, 10);
 const filename = `daily-digest-${d.locationName.replace(/[^a-z0-9]+/gi,"-").toLowerCase()}-${dayStr}.csv`;
 const lines: string[] = [];
 const esc = (s: string | number) => {
 const v = String(s);
 return /[",\r\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v;
 };
 const row = (...cols: Array<string | number>) =>
 lines.push(cols.map(esc).join(","));

 row("Daily Digest", d.locationName);
 row("Date", new Date(d.date).toLocaleDateString());
 row("Generated", new Date(d.generatedAt).toLocaleString());
 row("");

 row("SALES");
 row("Metric","Value");
 row("Gross revenue", (d.sales.revenue / 100).toFixed(2));
 row("Net (excl. tax)", (d.sales.net / 100).toFixed(2));
 row("Tax", (d.sales.tax / 100).toFixed(2));
 row("Avg ticket", (d.sales.avgTicket / 100).toFixed(2));
 row("Orders", d.sales.orderCount);
 row("Refunds", `${d.sales.refundCount} (${(d.sales.refundAmount / 100).toFixed(2)})`);
 row("Voids", d.sales.voidCount);
 row("Shifts", d.operations.shiftCount);
 row("Peak hour", `${d.operations.peakHour}:00–${d.operations.peakHour + 1}:00 (${d.operations.peakHourOrders} orders)`);
 row("");

 row("TENDER MIX");
 row("Method","Amount");
 row("Cash", (d.tender.cash / 100).toFixed(2));
 row("Card", (d.tender.card / 100).toFixed(2));
 row("E-Wallet", (d.tender.ewallet / 100).toFixed(2));
 row("");

 row("PRODUCT MIX");
 row("Item","Qty","Revenue","% of revenue");
 for (const p of d.products.mix) {
 row(p.name, p.qty, (p.revenue / 100).toFixed(2), p.percentageOfRevenue.toFixed(1) + "%");
 }
 row("Total units", d.products.totalUnits);
 row("");

 row("INGREDIENT STOCK");
 row(
"Ingredient",
"Category",
"Unit",
"Opening",
"Consumed",
"Adjustments",
"Closing",
"Reorder threshold",
"Below threshold?",
"Out of stock?"
 );
 for (const r of d.ingredients.rows) {
 row(
 r.name,
 r.category ?? "",
 r.unit,
 r.openingStock.toFixed(2),
 r.consumed.toFixed(2),
 r.adjustment.toFixed(2),
 r.closingStock.toFixed(2),
 r.reorderThreshold,
 r.belowThreshold ? "yes" : "no",
 r.isOut ? "yes" : "no"
 );
 }

 const csv = "﻿" + lines.join("\r\n");
 const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 setTimeout(() => URL.revokeObjectURL(url), 1000);
}
