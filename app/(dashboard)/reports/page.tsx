"use client";

import { useConvex, useQuery } from"convex/react";
import { api } from"../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useState, useMemo } from"react";
import { Id } from"../../../convex/_generated/dataModel";
import { exportToCSV } from"@/lib/export";
import { exportReportPDF } from"@/lib/export-pdf";
import { formatCurrency } from"@/lib/currency";
import { OrderDetailModal } from"@/components/orders/order-detail-modal";
import { Pagination, usePagination } from"@/components/ui/pagination";

type Tab ="daily" |"product" |"hourly" |"ledger";

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
 // Sales Ledger export = one row per ITEM (with order context repeated
 // on each row) so the CSV captures exactly what was rung up. Pulled
 // on demand instead of from the table cache so we get every line
 // even if the on-screen ledger is paginated.
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
 orderTotal: number;
 };
 exportToCSV(
 (rows as LineRow[]).map((r) => ({
"Date/Time": new Date(r.completedAt).toLocaleString(),
"Order #": r.orderNumber,
"Status": r.status === "voided" ?"Voided" : r.isRefunded ?"Refunded" :"Completed",
"Cashier": r.baristaName,
"Customer / Table": r.customerName ?? r.tableName ?? "",
"Item": r.itemName,
"Modifiers": r.modifiers,
"Qty": r.quantity,
"Unit Price": (r.unitPrice / 100).toFixed(2),
"Line Total": (r.lineSubtotal / 100).toFixed(2),
"Payment": r.paymentType,
"Order Total": (r.orderTotal / 100).toFixed(2),
 })),
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
 ? "Item name…"
 : "Order #, customer, cashier, payment…"
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
 <LedgerTab data={ledger} onView={(id) => setViewOrderId(id)} filterQuery={filterQuery} />
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

function LedgerTab({
 data,
 onView,
 filterQuery,
}: {
 data: LedgerRow[] | undefined;
 onView: (orderId: Id<"orders">) => void;
 filterQuery: string;
}) {
 if (!data) {
 return (
 <div className="text-center py-12" style={{ color: 'var(--muted-fg)' }}>
 Loading sales ledger...
 </div>
 );
 }

 // Client-side filter: order #, cashier, customer, table, or payment.
 // Totals below are recomputed off the FILTERED set so the summary
 // strip always matches what's on screen.
 const trimmed = filterQuery.trim().toLowerCase();
 const filteredData = trimmed
 ? data.filter((o: LedgerRow) => {
 if (o.orderNumber.toLowerCase().includes(trimmed)) return true;
 if (o.baristaName.toLowerCase().includes(trimmed)) return true;
 if ((o.customerName ?? "").toLowerCase().includes(trimmed)) return true;
 if ((o.tableName ?? "").toLowerCase().includes(trimmed)) return true;
 if (o.paymentType.toLowerCase().includes(trimmed)) return true;
 return false;
 })
 : data;

 if (filteredData.length === 0) {
 return (
 <div className="text-center py-12 rounded-2xl" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)', color: 'var(--muted-fg)' }}>
 {trimmed
 ? `No orders match "${filterQuery.trim()}" in this date range.`
 : "No orders in this date range."}
 </div>
 );
 }

 const totals = filteredData.reduce(
 (acc, o) => {
 const isVoided = o.status === "voided";
 const isRefunded = !!o.refundedAt;
 const discount = o.discountAmount ?? 0;
 const refund = o.refundAmount ?? 0;
 const tax = o.total - o.subtotal + discount;
 const net = (isVoided ? 0 : o.total) - refund;
 return {
 gross: acc.gross + (isVoided ? 0 : o.subtotal),
 discount: acc.discount + (isVoided ? 0 : discount),
 tax: acc.tax + (isVoided ? 0 : tax),
 refund: acc.refund + refund,
 net: acc.net + net,
 completed: acc.completed + (isVoided ? 0 : 1),
 voided: acc.voided + (isVoided ? 1 : 0),
 refunded: acc.refunded + (isRefunded && !isVoided ? 1 : 0),
 };
 },
 { gross: 0, discount: 0, tax: 0, refund: 0, net: 0, completed: 0, voided: 0, refunded: 0 }
 );

 return (
 <div className="space-y-4">
 {/* Summary cards */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
 <SummaryCard label="Orders" value={`${totals.completed}`} sub={`${totals.refunded} refunded · ${totals.voided} voided`} />
 <SummaryCard label="Gross" value={formatCurrency(totals.gross)} />
 <SummaryCard label="Discounts" value={`− ${formatCurrency(totals.discount)}`} />
 <SummaryCard label="Tax" value={formatCurrency(totals.tax)} />
 <SummaryCard label="Net Total" value={formatCurrency(totals.net)} highlight />
 </div>

 {/* Ledger table */}
 <div className="rounded-2xl shadow-lg overflow-hidden overflow-x-auto" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <table className="w-full text-xs min-w-[1000px]">
 <thead>
 <tr style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border-color)' }}>
 <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Date / Time</th>
 <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Order #</th>
 <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Cashier</th>
 <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Customer / Table</th>
 <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Items</th>
 <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Gross</th>
 <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Discount</th>
 <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Tax</th>
 <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Refund</th>
 <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Net</th>
 <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Payment</th>
 <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Status</th>
 </tr>
 </thead>
 <tbody>
 {filteredData.map((o: LedgerRow) => {
 const isVoided = o.status === "voided";
 const isRefunded = !!o.refundedAt;
 const discount = o.discountAmount ?? 0;
 const refund = o.refundAmount ?? 0;
 const tax = o.total - o.subtotal + discount;
 const net = (isVoided ? 0 : o.total) - refund;
 return (
 <tr
 key={o._id}
 style={{
 borderBottom: '1px solid var(--border-color)',
 opacity: isVoided ? 0.5 : 1,
 }}
 >
 <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--muted-fg)' }}>
 {new Date(o.completedAt).toLocaleString(undefined, {
 month: 'short', day: 'numeric', year: 'numeric',
 hour: 'numeric', minute: '2-digit', hour12: true,
 })}
 </td>
 <td className="px-3 py-2 font-mono">
 <button
 onClick={() => onView(o._id)}
 className="font-mono underline hover:opacity-80 active:opacity-60 transition-opacity"
 style={{ color: 'var(--accent-color)' }}
 title="View items in this order"
 >
 {o.orderNumber}
 </button>
 </td>
 <td className="px-3 py-2" style={{ color: 'var(--fg)' }}>{o.baristaName}</td>
 <td className="px-3 py-2" style={{ color: 'var(--muted-fg)' }}>{o.customerName ?? o.tableName ?? '—'}</td>
 <td className="px-3 py-2 text-right font-mono">{o.itemCount}</td>
 <td className="px-3 py-2 text-right font-mono">{formatCurrency(o.subtotal)}</td>
 <td className="px-3 py-2 text-right font-mono" style={{ color: discount > 0 ? '#ef4444' : 'var(--muted-fg)' }}>
 {discount > 0 ? `− ${formatCurrency(discount)}` : '—'}
 </td>
 <td className="px-3 py-2 text-right font-mono">{formatCurrency(tax)}</td>
 <td className="px-3 py-2 text-right font-mono" style={{ color: refund > 0 ? '#ef4444' : 'var(--muted-fg)' }}>
 {refund > 0 ? `− ${formatCurrency(refund)}` : '—'}
 </td>
 <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: 'var(--fg)' }}>
 {formatCurrency(net)}
 </td>
 <td className="px-3 py-2 capitalize" style={{ color: 'var(--muted-fg)' }}>
 {o.paymentType === 'ewallet' ? 'E-Wallet' : o.paymentType}
 </td>
 <td className="px-3 py-2">
 <span
 className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
 style={
 isVoided
 ? { backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }
 : isRefunded
 ? { backgroundColor: 'rgba(245,158,11,0.15)', color: '#d97706' }
 : { backgroundColor: 'rgba(16,185,129,0.15)', color: '#059669' }
 }
 >
 {isVoided ? 'Voided' : isRefunded ? 'Refunded' : 'Completed'}
 </span>
 </td>
 </tr>
 );
 })}
 </tbody>
 <tfoot>
 <tr style={{ backgroundColor: 'var(--muted)', borderTop: '1px solid var(--border-color)' }}>
 <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>Totals</td>
 <td className="px-3 py-2.5 text-right font-mono font-semibold" style={{ color: 'var(--fg)' }}>
 {data.reduce((s, o) => s + o.itemCount, 0)}
 </td>
 <td className="px-3 py-2.5 text-right font-mono font-semibold" style={{ color: 'var(--fg)' }}>
 {formatCurrency(totals.gross)}
 </td>
 <td className="px-3 py-2.5 text-right font-mono font-semibold" style={{ color: totals.discount > 0 ? '#ef4444' : 'var(--muted-fg)' }}>
 − {formatCurrency(totals.discount)}
 </td>
 <td className="px-3 py-2.5 text-right font-mono font-semibold" style={{ color: 'var(--fg)' }}>
 {formatCurrency(totals.tax)}
 </td>
 <td className="px-3 py-2.5 text-right font-mono font-semibold" style={{ color: totals.refund > 0 ? '#ef4444' : 'var(--muted-fg)' }}>
 − {formatCurrency(totals.refund)}
 </td>
 <td className="px-3 py-2.5 text-right font-mono font-bold" style={{ color: 'var(--accent-color)' }}>
 {formatCurrency(totals.net)}
 </td>
 <td colSpan={2}></td>
 </tr>
 </tfoot>
 </table>
 </div>

 <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>
 Net = Gross − Discount + Tax − Refund. Voided orders do not contribute to Net.
 </p>
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
 const filteredData = trimmed
 ? data.filter((it) => it.itemName.toLowerCase().includes(trimmed))
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
