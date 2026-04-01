"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import Link from "next/link";
import { Id } from "../../../../convex/_generated/dataModel";

type Plan = {
  _id: Id<"subscriptionPlans">;
  name: string;
  slug: string;
  maxLocations: number;
  maxOrdersPerMonth: number;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  status: string;
};

type SubscriptionData = {
  status: string;
  plan: { slug: string } | null;
};

export default function UpgradePage() {
  const { session, token } = useAuth();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const plans = useQuery(api.billing.queries.listPlans) as Plan[] | undefined;

  const subscription = useQuery(
    api.billing.queries.getCurrentSubscription,
    token ? { token } : "skip"
  ) as SubscriptionData | null | undefined;

  const selectPlan = useMutation(api.billing.mutations.selectPlan);

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  if (session.role !== "owner") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-500">Only owners can manage billing.</p>
      </div>
    );
  }

  const currentSlug = subscription?.plan?.slug ?? null;

  const handleSelectPlan = async (slug: string) => {
    if (!token || isSubmitting) return;
    setSelectedSlug(slug);
    setIsSubmitting(true);
    setSuccessMessage(null);
    try {
      await selectPlan({ token, planSlug: slug });
      setSuccessMessage(`Successfully switched to ${slug} plan.`);
    } catch {
      // Error handled silently
    } finally {
      setIsSubmitting(false);
      setSelectedSlug(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100">Choose a Plan</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            Select the plan that best fits your business
          </p>
        </div>
        <Link
          href="/billing"
          className="self-start md:self-auto px-4 py-2 border border-stone-200 text-stone-600 text-sm rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
        >
          Back to Billing
        </Link>
      </div>

      {/* Payment notice */}
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800">
          Payment integration coming soon. All plan changes are applied immediately at no charge during the preview period.
        </p>
      </div>

      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {plans === undefined ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-stone-400">Loading plans...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-stone-400">No plans available.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan: Plan) => {
            const isCurrent = plan.slug === currentSlug;
            return (
              <div
                key={plan._id}
                className={`bg-white dark:bg-stone-900 rounded-2xl border shadow-sm p-6 flex flex-col ${
                  isCurrent
                    ? "border-amber-400 ring-2 ring-amber-100"
                    : "border-stone-200/60"
                }`}
              >
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">{plan.name}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold text-stone-900 dark:text-stone-100">
                    {plan.priceMonthly === 0 ? "Free" : `₱${plan.priceMonthly.toLocaleString()}`}
                  </span>
                  {plan.priceMonthly > 0 && (
                    <span className="text-stone-400 text-sm">/month</span>
                  )}
                </div>

                <div className="text-xs text-stone-400 mb-4 space-y-1">
                  <p>
                    {plan.maxLocations >= 999 ? "Unlimited" : plan.maxLocations} location{plan.maxLocations !== 1 ? "s" : ""}
                  </p>
                  <p>
                    {plan.maxOrdersPerMonth >= 999999 ? "Unlimited" : plan.maxOrdersPerMonth.toLocaleString()} orders/month
                  </p>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feature: string) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-stone-600 dark:text-stone-400">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="px-4 py-2.5 text-center text-sm font-medium text-amber-700 bg-amber-50 rounded-xl">
                    Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleSelectPlan(plan.slug)}
                    disabled={isSubmitting && selectedSlug === plan.slug}
                    className="px-4 py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-800 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isSubmitting && selectedSlug === plan.slug
                      ? "Switching..."
                      : plan.priceMonthly === 0
                        ? "Downgrade"
                        : "Upgrade"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
