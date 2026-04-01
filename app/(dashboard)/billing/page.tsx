"use client";

import { useQuery, useMutation } from"convex/react";
import { api } from"../../../convex/_generated/api";
import { useAuth } from"@/lib/auth-context";
import { useState } from"react";
import Link from"next/link";

type PlanData = {
 name: string;
 slug: string;
 features: string[];
 priceMonthly: number;
 maxLocations: number;
 maxOrdersPerMonth: number;
};

type SubscriptionData = {
 status: string;
 currentPeriodEnd: number;
 monthlyOrderCount: number;
 plan: PlanData | null;
};

type UsageData = {
 monthlyOrderCount: number;
 maxOrdersPerMonth: number;
 orderUsagePercent: number;
 locationCount: number;
 maxLocations: number;
 locationUsagePercent: number;
 isOverOrderLimit: boolean;
 isOverLocationLimit: boolean;
 planName: string;
 planSlug: string | null;
};

function UsageBar({ label, current, max, percent }: { label: string; current: number; max: number; percent: number }) {
 const barColor =
 percent >= 100
 ?"bg-red-500"
 : percent >= 90
 ?"bg-amber-500"
 : percent >= 80
 ?"bg-yellow-400"
 :"bg-emerald-500";

 const warningText =
 percent >= 100
 ?"Limit reached"
 : percent >= 90
 ?"Almost at limit"
 : percent >= 80
 ?"Approaching limit"
 : null;

 return (
 <div className="space-y-2">
 <div className="flex items-center justify-between text-sm">
 <span className="font-medium">{label}</span>
 <span style={{ color: 'var(--muted-fg)' }}>
 {current.toLocaleString()} / {max >= 999999 ?"Unlimited" : max.toLocaleString()}
 </span>
 </div>
 <div className="w-full rounded-full h-3">
 <div
 className={`h-3 rounded-full transition-all ${barColor}`}
 style={{ width: `${Math.min(percent, 100)}%` }}
 />
 </div>
 {warningText && (
 <p className={`text-xs font-medium ${percent >= 100 ?"text-red-600" :"text-amber-600"}`}>
 {warningText}
 </p>
 )}
 </div>
 );
}

export default function BillingPage() {
 const { session, token } = useAuth();
 const [showCancelConfirm, setShowCancelConfirm] = useState(false);

 const subscription = useQuery(
 api.billing.queries.getCurrentSubscription,
 token ? { token } :"skip"
 ) as SubscriptionData | null | undefined;

 const usage = useQuery(
 api.billing.queries.getUsageStats,
 token && session?.role ==="owner" ? { token } :"skip"
 ) as UsageData | undefined;

 const cancelSubscription = useMutation(api.billing.mutations.cancelSubscription);

 if (!token || !session) {
 return (
 <div className="flex items-center justify-center h-64">
 <p style={{ color: 'var(--muted-fg)' }}>Loading...</p>
 </div>
 );
 }

 if (session.role !=="owner") {
 return (
 <div className="flex items-center justify-center h-64">
 <p style={{ color: 'var(--muted-fg)' }}>Only owners can access billing settings.</p>
 </div>
 );
 }

 const handleCancel = async () => {
 if (!token) return;
 try {
 await cancelSubscription({ token });
 setShowCancelConfirm(false);
 } catch {
 // Error handled silently
 }
 };

 const plan = subscription?.plan;
 const isLoading = subscription === undefined || usage === undefined;

 return (
 <div>
 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
 <div>
 <h1 className="text-lg md:text-xl font-bold" style={{ color: 'var(--fg)' }}>Billing</h1>
 <p className="text-sm mt-0.5" style={{ color: 'var(--muted-fg)' }}>
 Manage your subscription and usage
 </p>
 </div>
 <Link
 href="/billing/upgrade"
 className="self-start md:self-auto px-4 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg"
 >
 Change Plan
 </Link>
 </div>

 {isLoading ? (
 <div className="flex items-center justify-center h-48">
 <p style={{ color: 'var(--muted-fg)' }}>Loading billing data...</p>
 </div>
 ) : (
 <div className="grid gap-6 md:grid-cols-2">
 {/* Current Plan Card */}
 <div className="rounded-2xl border shadow-lg p-6">
 <h2 className="text-sm font-medium uppercase tracking-wide mb-4">
 Current Plan
 </h2>
 {subscription && plan ? (
 <div className="space-y-4">
 <div className="flex items-baseline gap-3">
 <span className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{plan.name}</span>
 <span
 className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
 subscription.status ==="active"
 ?"bg-green-500/10 text-green-400"
 : subscription.status ==="cancelled"
 ?"bg-red-500/10 text-red-400"
 :"bg-amber-500/10 text-amber-400"
 }`}
 >
 {subscription.status}
 </span>
 </div>
 <p className="text-lg font-semibold">
 {plan.priceMonthly === 0
 ?"Free"
 : `₱${(plan.priceMonthly).toLocaleString()}/mo`}
 </p>
 <div className="border-t pt-4">
 <p className="text-xs mb-2">Features</p>
 <ul className="space-y-1.5">
 {plan.features.map((feature: string) => (
 <li key={feature} className="flex items-center gap-2 text-sm">
 <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
 </svg>
 {feature}
 </li>
 ))}
 </ul>
 </div>
 <div className="border-t pt-4 text-xs">
 Period ends: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 <p className="text-stone-500 text-sm">No subscription active.</p>
 <Link
 href="/billing/upgrade"
 className="inline-block px-4 py-2 text-white text-sm font-semibold rounded-xl transition-colors"
 >
 Choose a Plan
 </Link>
 </div>
 )}
 </div>

 {/* Usage Stats Card */}
 <div className="rounded-2xl border shadow-lg p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-sm font-medium uppercase tracking-wide mb-4">
 Usage This Month
 </h2>
 {usage ? (
 <div className="space-y-6">
 <UsageBar
 label="Orders"
 current={usage.monthlyOrderCount}
 max={usage.maxOrdersPerMonth}
 percent={usage.orderUsagePercent}
 />
 <UsageBar
 label="Locations"
 current={usage.locationCount}
 max={usage.maxLocations}
 percent={usage.locationUsagePercent}
 />
 </div>
 ) : (
 <p className="text-stone-400 text-sm">No usage data available.</p>
 )}
 </div>

 {/* Cancel Subscription */}
 {subscription && subscription.status ==="active" && plan && plan.slug !=="free" && (
 <div className="md:col-span-2 rounded-2xl border shadow-lg p-6" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}>
 <h2 className="text-sm font-medium uppercase tracking-wide mb-4">
 Cancel Subscription
 </h2>
 {showCancelConfirm ? (
 <div className="space-y-3">
 <p className="text-sm">
 Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.
 </p>
 <div className="flex gap-2">
 <button
 onClick={handleCancel}
 className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors" style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
 >
 Confirm Cancel
 </button>
 <button
 onClick={() => setShowCancelConfirm(false)}
 className="px-4 py-2 text-sm rounded-xl transition-colors"
 >
 Keep Plan
 </button>
 </div>
 </div>
 ) : (
 <button
 onClick={() => setShowCancelConfirm(true)}
 className="px-4 py-2 border border-red-500/20 text-red-400 text-sm rounded-xl hover:bg-red-500/10 transition-colors"
 >
 Cancel Subscription
 </button>
 )}
 </div>
 )}
 </div>
 )}
 </div>
 );
}
