"use client";

import { useQuery } from"convex/react";
import { api } from"../../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useState, useMemo } from"react";
import { Id } from"../../../../convex/_generated/dataModel";
import { exportToCSV } from"@/lib/export";
import { formatCurrency } from"@/lib/currency";

type AnalyticsTab =
 |"payment"
 |"time"
 |"staff"
 |"tables"
 |"peak"
 |"voids"
 |"repeat";

type LocationOption = {
 _id: Id<"locations">;
 name: string;
 slug: string;
 status: string;
};

type PaymentTypeRow = {
 paymentType: string;
 orderCount: number;
 totalRevenue: number;
 percentage: number;
};

type TimePeriodRow = {
 period: string;
 label: string;
 orderCount: number;
 totalRevenue: number;
 avgOrderValue: number;
};

type StaffRow = {
 userName: string;
 role: string;
 orderCount: number;
 totalRevenue: number;
 avgOrderValue: number;
 voidCount: number;
};

type TableRow = {
 tableName: string;
 orderCount: number;
 totalRevenue: number;
 avgOrderValue: number;
};

type PeakDayRow = {
 dayOfWeek: number;
 dayName: string;
 orderCount: number;
 totalRevenue: number;
 avgOrderValue: number;
};

type VoidItem = {
 orderNumber: string;
 voidedAt: number;
 voidReason: string;
 voidedByName: string;
 originalTotal: number;
};

type VoidReportResult = {
 totalVoided: number;
 voidCount: number;
 voidRate: number;
 voids: VoidItem[];
};

type TopCustomer = {
 customerName: string;
 orderCount: number;
 totalSpent: number;
};

type RepeatRateResult = {
 totalOrdersWithCustomer: number;
 uniqueCustomers: number;
 repeatRate: number;
 topCustomers: TopCustomer[];
};

function dateToTimestamp(dateStr: string): number {
 const parts = dateStr.split("-");
 return Date.UTC(
 parseInt(parts[0], 10),
 parseInt(parts[1], 10) - 1,
 parseInt(parts[2], 10)
 );
}

function timestampToDateStr(ts: number): string {
 const d = new Date(ts);
 const year = d.getUTCFullYear();
 const month = String(d.getUTCMonth() + 1).padStart(2,"0");
 const day = String(d.getUTCDate()).padStart(2,"0");
 return `${year}-${month}-${day}`;
}

function sevenDaysAgo(): number {
 const now = new Date();
 return Date.UTC(
 now.getUTCFullYear(),
 now.getUTCMonth(),
 now.getUTCDate() - 7
 );
}

function todayEnd(): number {
 const now = new Date();
 return (
 Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) +
 24 * 60 * 60 * 1000 -
 1
 );
}

const PAYMENT_COLORS: Record<string, string> = {
 cash:"#10b981",
 card:"#3b82f6",
 ewallet:"#8b5cf6",
};

const PAYMENT_LABELS: Record<string, string> = {
 cash:"Cash",
 card:"Card",
 ewallet:"E-Wallet",
};

export default function OrderAnalyticsPage() {
 const { session, token } = useAuth();

 const defaultStart = useMemo(() => sevenDaysAgo(), []);
 const defaultEnd = useMemo(() => todayEnd(), []);

 const [activeTab, setActiveTab] = useState<AnalyticsTab>("payment");
 const [startDateStr, setStartDateStr] = useState(
 timestampToDateStr(defaultStart)
 );
 const [endDateStr, setEndDateStr] = useState(timestampToDateStr(defaultEnd));
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

 const availableLocations = useMemo(() => {
 if (!locations || !session) return [];
 if (session.role ==="owner") return locations;
 return locations.filter((loc: LocationOption) =>
 session.locationIds.includes(loc._id)
 );
 }, [locations, session]);

 const isOwner = session?.role ==="owner";

 const paymentData = useQuery(
 api.reports.queries.salesByPaymentType,
 token && activeTab ==="payment"
 ? { token, startDate, endDate, locationId }
 :"skip"
 ) as PaymentTypeRow[] | undefined;

 const timeData = useQuery(
 api.reports.queries.salesByTimePeriod,
 token && activeTab ==="time"
 ? { token, startDate, endDate, locationId }
 :"skip"
 ) as TimePeriodRow[] | undefined;

 const staffData = useQuery(
 api.reports.queries.salesByStaff,
 token && activeTab ==="staff"
 ? { token, startDate, endDate, locationId }
 :"skip"
 ) as StaffRow[] | undefined;

 const tableData = useQuery(
 api.reports.queries.salesByTable,
 token && activeTab ==="tables" && isOwner
 ? { token, startDate, endDate, locationId }
 :"skip"
 ) as TableRow[] | undefined;

 const peakData = useQuery(
 api.reports.queries.peakDayAnalysis,
 token && activeTab ==="peak"
 ? { token, startDate, endDate, locationId }
 :"skip"
 ) as PeakDayRow[] | undefined;

 const voidData = useQuery(
 api.reports.queries.voidReport,
 token && activeTab ==="voids" && isOwner
 ? { token, startDate, endDate, locationId }
 :"skip"
 ) as VoidReportResult | undefined;

 const repeatData = useQuery(
 api.reports.queries.customerRepeatRate,
 token && activeTab ==="repeat"
 ? { token, startDate, endDate, locationId }
 :"skip"
 ) as RepeatRateResult | undefined;

 if (!token || !session) {
 return (
 <div className="flex items-center justify-center h-64">
 <p style={{ color:"var(--muted-fg)" }}>Loading...</p>
 </div>
 );
 }

 const allTabs: Array<{ key: AnalyticsTab; label: string; ownerOnly?: boolean }> = [
 { key:"payment", label:"Payment Types" },
 { key:"time", label:"Time Periods" },
 { key:"staff", label:"Staff" },
 { key:"tables", label:"Tables", ownerOnly: true },
 { key:"peak", label:"Peak Days" },
 { key:"voids", label:"Voids", ownerOnly: true },
 { key:"repeat", label:"Customer Repeat" },
 ];

 const visibleTabs = allTabs.filter(
 (t: { key: AnalyticsTab; label: string; ownerOnly?: boolean }) =>
 !t.ownerOnly || isOwner
 );

 function handleExport() {
 if (activeTab ==="payment" && paymentData) {
 exportToCSV(
 paymentData.map((r: PaymentTypeRow) => ({
"Payment Type": PAYMENT_LABELS[r.paymentType] ?? r.paymentType,
 Orders: r.orderCount,
 Revenue: r.totalRevenue,
"% of Total": `${r.percentage.toFixed(1)}%`,
 })),
"sales-by-payment-type.csv"
 );
 } else if (activeTab ==="time" && timeData) {
 exportToCSV(
 timeData.map((r: TimePeriodRow) => ({
 Period: r.label,
 Orders: r.orderCount,
 Revenue: r.totalRevenue,
"Avg Order": r.avgOrderValue,
 })),
"sales-by-time-period.csv"
 );
 } else if (activeTab ==="staff" && staffData) {
 exportToCSV(
 staffData.map((r: StaffRow) => ({
"Staff Name": r.userName,
 Role: r.role,
 Orders: r.orderCount,
 Revenue: r.totalRevenue,
"Avg Order": r.avgOrderValue,
 Voids: r.voidCount,
 })),
"sales-by-staff.csv"
 );
 } else if (activeTab ==="tables" && tableData) {
 exportToCSV(
 tableData.map((r: TableRow) => ({
"Table/Zone": r.tableName,
 Orders: r.orderCount,
 Revenue: r.totalRevenue,
"Avg Order": r.avgOrderValue,
 })),
"sales-by-table.csv"
 );
 } else if (activeTab ==="peak" && peakData) {
 exportToCSV(
 peakData.map((r: PeakDayRow) => ({
 Day: r.dayName,
 Orders: r.orderCount,
 Revenue: r.totalRevenue,
"Avg Order": r.avgOrderValue,
 })),
"peak-day-analysis.csv"
 );
 } else if (activeTab ==="voids" && voidData) {
 exportToCSV(
 voidData.voids.map((v: VoidItem) => ({
"Order #": v.orderNumber,
 Date: new Date(v.voidedAt).toLocaleDateString(),
"Original Total": v.originalTotal,
 Reason: v.voidReason,
"Voided By": v.voidedByName,
 })),
"void-report.csv"
 );
 } else if (activeTab ==="repeat" && repeatData) {
 exportToCSV(
 repeatData.topCustomers.map((c: TopCustomer) => ({
 Name: c.customerName,
 Orders: c.orderCount,
"Total Spent": c.totalSpent,
 })),
"customer-repeat-rate.csv"
 );
 }
 }

 return (
 <div>
 <div className="mb-8">
 <h1
 className="text-lg md:text-xl font-bold"
 style={{ color:"var(--fg)" }}
 >
 Order Analytics
 </h1>
 <p className="text-sm mt-0.5" style={{ color:"var(--muted-fg)" }}>
 Detailed breakdowns of order data by payment, time, staff, and more
 </p>
 </div>

 {/* Filter Bar */}
 <div
 className="rounded-2xl border shadow-lg p-4 mb-6"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <div className="flex flex-wrap gap-4 items-end">
 <div>
 <label
 className="block text-xs font-medium uppercase tracking-wide mb-1.5"
 style={{ color:"var(--muted-fg)" }}
 >
 Start Date
 </label>
 <input
 type="date"
 value={startDateStr}
 onChange={(e) => setStartDateStr(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
 style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />
 </div>
 <div>
 <label
 className="block text-xs font-medium uppercase tracking-wide mb-1.5"
 style={{ color:"var(--muted-fg)" }}
 >
 End Date
 </label>
 <input
 type="date"
 value={endDateStr}
 onChange={(e) => setEndDateStr(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
 style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 />
 </div>
 <div>
 <label
 className="block text-xs font-medium uppercase tracking-wide mb-1.5"
 style={{ color:"var(--muted-fg)" }}
 >
 Location
 </label>
 <select
 value={selectedLocationId}
 onChange={(e) => setSelectedLocationId(e.target.value)}
 className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
 style={{ backgroundColor: 'var(--muted)', color: 'var(--fg)', border: '1px solid var(--border-color)' }}
 >
 <option value="">All Locations</option>
 {availableLocations.map((loc: LocationOption) => (
 <option key={loc._id} value={loc._id}>
 {loc.name}
 </option>
 ))}
 </select>
 </div>
 <button
 onClick={handleExport}
 className="px-3 py-2 border text-sm rounded-xl transition-colors hover:opacity-80"
 style={{
 borderColor:"var(--border-color)",
 color:"var(--muted-fg)",
 }}
 >
 Export CSV
 </button>
 </div>
 </div>

 {/* Tab pills */}
 <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
 {visibleTabs.map(
 (tab: { key: AnalyticsTab; label: string; ownerOnly?: boolean }) => (
 <button
 key={tab.key}
 onClick={() => setActiveTab(tab.key)}
 className="px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors"
 style={
 activeTab === tab.key
 ? { backgroundColor: 'var(--accent-color)', color: 'white' }
 : undefined
 }
 >
 {tab.label}
 </button>
 )
 )}
 </div>

 {/* Tab Content */}
 {activeTab ==="payment" && <PaymentTypesTab data={paymentData} />}
 {activeTab ==="time" && <TimePeriodsTab data={timeData} />}
 {activeTab ==="staff" && <StaffTab data={staffData} />}
 {activeTab ==="tables" && <TablesTab data={tableData} />}
 {activeTab ==="peak" && <PeakDaysTab data={peakData} />}
 {activeTab ==="voids" && <VoidsTab data={voidData} />}
 {activeTab ==="repeat" && <CustomerRepeatTab data={repeatData} />}
 </div>
 );
}

// ---------------------------------------------------------------------------
// Payment Types Tab
// ---------------------------------------------------------------------------
function PaymentTypesTab({ data }: { data: PaymentTypeRow[] | undefined }) {
 if (!data) {
 return (
 <div className="text-center py-12" style={{ color:"var(--muted-fg)" }}>
 Loading payment data...
 </div>
 );
 }

 if (data.length === 0) {
 return (
 <div className="text-center py-12" style={{ color:"var(--muted-fg)" }}>
 No sales data for this period.
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Colored bar visualization */}
 <div
 className="rounded-2xl border shadow-lg p-6"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <p
 className="text-xs font-medium uppercase tracking-wide mb-4"
 style={{ color:"var(--muted-fg)" }}
 >
 Revenue Distribution
 </p>
 <div className="flex rounded-xl overflow-hidden h-8">
 {data.map((row: PaymentTypeRow) => (
 <div
 key={row.paymentType}
 style={{
 width: `${row.percentage}%`,
 backgroundColor: PAYMENT_COLORS[row.paymentType] ??"#94a3b8",
 minWidth: row.percentage > 0 ?"24px" :"0",
 }}
 className="flex items-center justify-center"
 title={`${PAYMENT_LABELS[row.paymentType] ?? row.paymentType}: ${row.percentage.toFixed(1)}%`}
 >
 {row.percentage >= 10 && (
 <span className="text-xs font-medium text-white">
 {row.percentage.toFixed(0)}%
 </span>
 )}
 </div>
 ))}
 </div>
 <div className="flex gap-6 mt-4">
 {data.map((row: PaymentTypeRow) => (
 <div key={row.paymentType} className="flex items-center gap-2">
 <div
 className="w-3 h-3 rounded-full"
 style={{
 backgroundColor:
 PAYMENT_COLORS[row.paymentType] ??"#94a3b8",
 }}
 />
 <span className="text-sm" style={{ color:"var(--card-fg)" }}>
 {PAYMENT_LABELS[row.paymentType] ?? row.paymentType}
 </span>
 </div>
 ))}
 </div>
 </div>

 {/* Table */}
 <div
 className="rounded-2xl border shadow-lg overflow-hidden overflow-x-auto"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <table className="w-full min-w-[400px]">
 <thead>
 <tr style={{ backgroundColor:"var(--muted)" }}>
 <th
 className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide"
 style={{ color:"var(--muted-fg)" }}
 >
 Payment Type
 </th>
 <th
 className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide"
 style={{ color:"var(--muted-fg)" }}
 >
 Orders
 </th>
 <th
 className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide"
 style={{ color:"var(--muted-fg)" }}
 >
 Revenue
 </th>
 <th
 className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide"
 style={{ color:"var(--muted-fg)" }}
 >
 % of Total
 </th>
 </tr>
 </thead>
 <tbody>
 {data.map((row: PaymentTypeRow) => (
 <tr
 key={row.paymentType}
 className="border-t"
 style={{ borderColor:"var(--border-color)" }}
 >
 <td className="px-5 py-3.5 font-medium" style={{ color:"var(--card-fg)" }}>
 <span className="flex items-center gap-2">
 <span
 className="w-2.5 h-2.5 rounded-full inline-block"
 style={{
 backgroundColor:
 PAYMENT_COLORS[row.paymentType] ??"#94a3b8",
 }}
 />
 {PAYMENT_LABELS[row.paymentType] ?? row.paymentType}
 </span>
 </td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>
 {row.orderCount}
 </td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>
 {formatCurrency(row.totalRevenue)}
 </td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>
 {row.percentage.toFixed(1)}%
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Time Periods Tab
// ---------------------------------------------------------------------------
function TimePeriodsTab({ data }: { data: TimePeriodRow[] | undefined }) {
 if (!data) {
 return (
 <div className="text-center py-12" style={{ color:"var(--muted-fg)" }}>
 Loading time period data...
 </div>
 );
 }

 const maxRevenue = Math.max(
 ...data.map((r: TimePeriodRow) => r.totalRevenue),
 1
 );
 const peakPeriod = data.reduce(
 (peak: TimePeriodRow, curr: TimePeriodRow) =>
 curr.totalRevenue > peak.totalRevenue ? curr : peak,
 data[0]
 );

 return (
 <div className="space-y-6">
 {/* Horizontal bar chart */}
 <div
 className="rounded-2xl border shadow-lg p-6"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <p
 className="text-xs font-medium uppercase tracking-wide mb-4"
 style={{ color:"var(--muted-fg)" }}
 >
 Revenue by Time Block
 </p>
 <div className="space-y-3">
 {data.map((row: TimePeriodRow) => {
 const widthPct =
 maxRevenue > 0 ? (row.totalRevenue / maxRevenue) * 100 : 0;
 const isPeak = row.period === peakPeriod.period && row.totalRevenue > 0;
 return (
 <div key={row.period} className="flex items-center gap-3">
 <span
 className="text-sm w-36 shrink-0"
 style={{ color:"var(--card-fg)" }}
 >
 {row.label}
 </span>
 <div className="flex-1 h-6 rounded-2xl overflow-hidden" style={{ backgroundColor:"var(--muted)" }}>
 <div
 className={`h-full rounded-2xl transition-all ${isPeak ?"bg-amber-600" :"bg-amber-300"}`}
 style={{ width: `${widthPct}%`, minWidth: row.totalRevenue > 0 ?"4px" :"0" }}
 />
 </div>
 <span className="text-sm w-24 text-right shrink-0" style={{ color:"var(--muted-fg)" }}>
 {formatCurrency(row.totalRevenue)}
 </span>
 </div>
 );
 })}
 </div>
 {peakPeriod.totalRevenue > 0 && (
 <p className="text-sm mt-4" style={{ color:"var(--muted-fg)" }}>
 Peak period:{""}
 <span className="font-semibold" style={{ color:"var(--card-fg)" }}>
 {peakPeriod.label}
 </span>{""}
 ({peakPeriod.orderCount} orders, {formatCurrency(peakPeriod.totalRevenue)})
 </p>
 )}
 </div>

 {/* Table */}
 <div
 className="rounded-2xl border shadow-lg overflow-hidden overflow-x-auto"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <table className="w-full min-w-[500px]">
 <thead>
 <tr style={{ backgroundColor:"var(--muted)" }}>
 <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Period</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Orders</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Revenue</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Avg Order</th>
 </tr>
 </thead>
 <tbody>
 {data.map((row: TimePeriodRow) => {
 const isPeak = row.period === peakPeriod.period && row.totalRevenue > 0;
 return (
 <tr
 key={row.period}
 className="border-t"
 style={{
 borderColor:"var(--border-color)",
 backgroundColor: isPeak ?"rgba(245, 158, 11, 0.08)" : undefined,
 }}
 >
 <td className="px-5 py-3.5 font-medium" style={{ color:"var(--card-fg)" }}>
 {row.label}
 {isPeak && <span className="ml-2 text-xs text-amber-600 font-semibold">PEAK</span>}
 </td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{row.orderCount}</td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{formatCurrency(row.totalRevenue)}</td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{formatCurrency(row.avgOrderValue)}</td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Staff Tab
// ---------------------------------------------------------------------------
function StaffTab({ data }: { data: StaffRow[] | undefined }) {
 if (!data) {
 return (
 <div className="text-center py-12" style={{ color:"var(--muted-fg)" }}>
 Loading staff data...
 </div>
 );
 }

 if (data.length === 0) {
 return (
 <div className="text-center py-12" style={{ color:"var(--muted-fg)" }}>
 No staff sales data for this period.
 </div>
 );
 }

 const topPerformer = data[0];

 return (
 <div
 className="rounded-2xl border shadow-lg overflow-hidden overflow-x-auto"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <table className="w-full min-w-[600px]">
 <thead>
 <tr style={{ backgroundColor:"var(--muted)" }}>
 <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Staff Name</th>
 <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Role</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Orders</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Revenue</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Avg Order</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Voids</th>
 </tr>
 </thead>
 <tbody>
 {data.map((row: StaffRow) => {
 const isTop = row.userName === topPerformer.userName && row.totalRevenue > 0;
 return (
 <tr
 key={row.userName}
 className="border-t"
 style={{
 borderColor:"var(--border-color)",
 backgroundColor: isTop ?"rgba(245, 158, 11, 0.08)" : undefined,
 }}
 >
 <td className="px-5 py-3.5 font-medium" style={{ color:"var(--card-fg)" }}>
 {row.userName}
 {isTop && <span className="ml-2 text-xs text-amber-600 font-semibold">TOP</span>}
 </td>
 <td className="px-5 py-3.5 capitalize" style={{ color:"var(--muted-fg)" }}>{row.role}</td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{row.orderCount}</td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{formatCurrency(row.totalRevenue)}</td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{formatCurrency(row.avgOrderValue)}</td>
 <td className="px-5 py-3.5 text-right" style={{ color: row.voidCount > 0 ?"#ef4444" :"var(--muted-fg)" }}>
 {row.voidCount}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Tables Tab
// ---------------------------------------------------------------------------
function TablesTab({ data }: { data: TableRow[] | undefined }) {
 if (!data) {
 return (
 <div className="text-center py-12" style={{ color:"var(--muted-fg)" }}>
 Loading table data...
 </div>
 );
 }

 if (data.length === 0) {
 return (
 <div className="text-center py-12" style={{ color:"var(--muted-fg)" }}>
 No table sales data for this period.
 </div>
 );
 }

 return (
 <div
 className="rounded-2xl border shadow-lg overflow-hidden overflow-x-auto"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <table className="w-full min-w-[500px]">
 <thead>
 <tr style={{ backgroundColor:"var(--muted)" }}>
 <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Table / Zone</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Orders</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Revenue</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Avg Order</th>
 </tr>
 </thead>
 <tbody>
 {data.map((row: TableRow) => (
 <tr
 key={row.tableName}
 className="border-t"
 style={{ borderColor:"var(--border-color)" }}
 >
 <td className="px-5 py-3.5 font-medium" style={{ color:"var(--card-fg)" }}>{row.tableName}</td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{row.orderCount}</td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{formatCurrency(row.totalRevenue)}</td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{formatCurrency(row.avgOrderValue)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Peak Days Tab
// ---------------------------------------------------------------------------
function PeakDaysTab({ data }: { data: PeakDayRow[] | undefined }) {
 if (!data) {
 return (
 <div className="text-center py-12" style={{ color:"var(--muted-fg)" }}>
 Loading peak day data...
 </div>
 );
 }

 const maxOrders = Math.max(
 ...data.map((r: PeakDayRow) => r.orderCount),
 1
 );
 const busiestDay = data.reduce(
 (peak: PeakDayRow, curr: PeakDayRow) =>
 curr.orderCount > peak.orderCount ? curr : peak,
 data[0]
 );

 return (
 <div className="space-y-6">
 {/* Bar chart */}
 <div
 className="rounded-2xl border shadow-lg p-6"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <p
 className="text-xs font-medium uppercase tracking-wide mb-4"
 style={{ color:"var(--muted-fg)" }}
 >
 Orders per Day of Week
 </p>
 <div className="flex items-end gap-2" style={{ height:"180px" }}>
 {data.map((row: PeakDayRow) => {
 const heightPct =
 maxOrders > 0 ? (row.orderCount / maxOrders) * 100 : 0;
 const isBusiest =
 row.dayOfWeek === busiestDay.dayOfWeek && row.orderCount > 0;
 return (
 <div
 key={row.dayOfWeek}
 className="flex-1 flex flex-col items-center justify-end h-full"
 >
 <span
 className="text-xs font-medium mb-1"
 style={{ color:"var(--muted-fg)" }}
 >
 {row.orderCount > 0 ? row.orderCount :""}
 </span>
 <div
 className={`w-full rounded-t transition-all ${isBusiest ?"bg-amber-600" :"bg-amber-300"}`}
 style={{
 height: `${heightPct}%`,
 minHeight: row.orderCount > 0 ?"4px" :"0px",
 }}
 />
 <span
 className="text-xs mt-1"
 style={{ color:"var(--muted-fg)" }}
 >
 {row.dayName}
 </span>
 </div>
 );
 })}
 </div>
 {busiestDay.orderCount > 0 && (
 <p className="text-sm mt-4" style={{ color:"var(--muted-fg)" }}>
 Busiest day:{""}
 <span className="font-semibold" style={{ color:"var(--card-fg)" }}>
 {busiestDay.dayName}
 </span>{""}
 ({busiestDay.orderCount} orders, {formatCurrency(busiestDay.totalRevenue)})
 </p>
 )}
 </div>

 {/* Table */}
 <div
 className="rounded-2xl border shadow-lg overflow-hidden overflow-x-auto"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <table className="w-full min-w-[500px]">
 <thead>
 <tr style={{ backgroundColor:"var(--muted)" }}>
 <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Day</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Orders</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Revenue</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Avg Order</th>
 </tr>
 </thead>
 <tbody>
 {data.map((row: PeakDayRow) => {
 const isBusiest = row.dayOfWeek === busiestDay.dayOfWeek && row.orderCount > 0;
 return (
 <tr
 key={row.dayOfWeek}
 className="border-t"
 style={{
 borderColor:"var(--border-color)",
 backgroundColor: isBusiest ?"rgba(245, 158, 11, 0.08)" : undefined,
 }}
 >
 <td className="px-5 py-3.5 font-medium" style={{ color:"var(--card-fg)" }}>
 {row.dayName}
 {isBusiest && <span className="ml-2 text-xs text-amber-600 font-semibold">BUSIEST</span>}
 </td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{row.orderCount}</td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{formatCurrency(row.totalRevenue)}</td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{formatCurrency(row.avgOrderValue)}</td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Voids Tab
// ---------------------------------------------------------------------------
function VoidsTab({ data }: { data: VoidReportResult | undefined }) {
 if (!data) {
 return (
 <div className="text-center py-12" style={{ color:"var(--muted-fg)" }}>
 Loading void data...
 </div>
 );
 }

 const summaryCards: Array<{ label: string; value: string }> = [
 { label:"Total Voided Amount", value: formatCurrency(data.totalVoided) },
 { label:"Void Count", value: String(data.voidCount) },
 { label:"Void Rate", value: `${data.voidRate}%` },
 ];

 return (
 <div className="space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 {summaryCards.map((card: { label: string; value: string }) => (
 <div
 key={card.label}
 className="rounded-2xl border shadow-lg p-6"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <p
 className="text-xs font-medium uppercase tracking-wide mb-2"
 style={{ color:"var(--muted-fg)" }}
 >
 {card.label}
 </p>
 <p className="text-2xl font-bold" style={{ color:"var(--card-fg)" }}>
 {card.value}
 </p>
 </div>
 ))}
 </div>

 {data.voids.length > 0 ? (
 <div
 className="rounded-2xl border shadow-lg overflow-hidden overflow-x-auto"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <table className="w-full min-w-[600px]">
 <thead>
 <tr style={{ backgroundColor:"var(--muted)" }}>
 <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Order #</th>
 <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Date</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Original Total</th>
 <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Reason</th>
 <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Voided By</th>
 </tr>
 </thead>
 <tbody>
 {data.voids.map((v: VoidItem, idx: number) => (
 <tr
 key={`${v.orderNumber}-${idx}`}
 className="border-t"
 style={{ borderColor:"var(--border-color)" }}
 >
 <td className="px-5 py-3.5 font-medium" style={{ color:"var(--card-fg)" }}>{v.orderNumber}</td>
 <td className="px-5 py-3.5" style={{ color:"var(--muted-fg)" }}>
 {new Date(v.voidedAt).toLocaleDateString()}
 </td>
 <td className="px-5 py-3.5 text-right" style={{ color:"#ef4444" }}>
 {formatCurrency(v.originalTotal)}
 </td>
 <td className="px-5 py-3.5" style={{ color:"var(--muted-fg)" }}>{v.voidReason}</td>
 <td className="px-5 py-3.5" style={{ color:"var(--muted-fg)" }}>{v.voidedByName}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : (
 <div className="text-center py-12" style={{ color:"var(--muted-fg)" }}>
 No voided orders in this period.
 </div>
 )}
 </div>
 );
}

// ---------------------------------------------------------------------------
// Customer Repeat Tab
// ---------------------------------------------------------------------------
function CustomerRepeatTab({ data }: { data: RepeatRateResult | undefined }) {
 if (!data) {
 return (
 <div className="text-center py-12" style={{ color:"var(--muted-fg)" }}>
 Loading customer data...
 </div>
 );
 }

 const summaryCards: Array<{ label: string; value: string }> = [
 { label:"Orders with Customer", value: String(data.totalOrdersWithCustomer) },
 { label:"Unique Customers", value: String(data.uniqueCustomers) },
 { label:"Repeat Rate", value: `${data.repeatRate}%` },
 ];

 return (
 <div className="space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 {summaryCards.map((card: { label: string; value: string }) => (
 <div
 key={card.label}
 className="rounded-2xl border shadow-lg p-6"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <p
 className="text-xs font-medium uppercase tracking-wide mb-2"
 style={{ color:"var(--muted-fg)" }}
 >
 {card.label}
 </p>
 <p className="text-2xl font-bold" style={{ color:"var(--card-fg)" }}>
 {card.value}
 </p>
 </div>
 ))}
 </div>

 {data.topCustomers.length > 0 ? (
 <div
 className="rounded-2xl border shadow-lg overflow-hidden overflow-x-auto"
 style={{
 backgroundColor:"var(--card)",
 borderColor:"var(--border-color)",
 }}
 >
 <table className="w-full min-w-[400px]">
 <thead>
 <tr style={{ backgroundColor:"var(--muted)" }}>
 <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Name</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Orders</th>
 <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color:"var(--muted-fg)" }}>Total Spent</th>
 </tr>
 </thead>
 <tbody>
 {data.topCustomers.map((c: TopCustomer) => (
 <tr
 key={c.customerName}
 className="border-t"
 style={{ borderColor:"var(--border-color)" }}
 >
 <td className="px-5 py-3.5 font-medium" style={{ color:"var(--card-fg)" }}>{c.customerName}</td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{c.orderCount}</td>
 <td className="px-5 py-3.5 text-right" style={{ color:"var(--muted-fg)" }}>{formatCurrency(c.totalSpent)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : (
 <div className="text-center py-12" style={{ color:"var(--muted-fg)" }}>
 No customer-linked orders in this period.
 </div>
 )}
 </div>
 );
}
