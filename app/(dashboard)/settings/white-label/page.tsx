"use client";

import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/components/providers/branding-provider";

export default function WhiteLabelSettingsPage() {
  const { session, token } = useAuth();
  const { entitlements } = useBranding();

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>Loading...</p>
      </div>
    );
  }

  if (session.role !== "owner") {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>
          Only owners can access white-label settings.
        </p>
      </div>
    );
  }

  // Each feature derives its availability from the live entitlements
  // surfaced by BrandingProvider. Add a row here and the gating happens
  // automatically — the receipts and chrome already check the same flag.
  const features: Array<{
    title: string;
    description: string;
    enabled: boolean;
    requiredPlan: string;
  }> = [
    {
      title: "Custom Branding",
      description:
        "Replace bevi&go branding with your own logo, colors, and name. Active on every receipt, PIN screen, and PWA install prompt.",
      enabled: true,
      requiredPlan: "All plans",
    },
    {
      title: "Remove \"Powered by bevi&go\" Footer",
      description:
        "Hide the bevi&go attribution on customer-facing receipts, payslips, and printed documents.",
      enabled: entitlements.hidePoweredBy,
      requiredPlan: "Pro",
    },
    {
      title: "Branded Emails",
      description:
        "Daily / weekly sales reports go out under your business name and logo instead of bevi&go's.",
      enabled: entitlements.brandedEmails,
      requiredPlan: "Pro",
    },
    {
      title: "Custom Domain",
      description:
        "Serve the public menu + customer-facing pages from your own domain (e.g. menu.yourshop.com).",
      enabled: entitlements.customDomain,
      requiredPlan: "Enterprise",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
          White-Label
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
          Make the POS completely yours.
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Current plan card */}
        <div
          className="rounded-3xl p-5 flex items-center justify-between"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--muted-fg)" }}
            >
              Current Plan
            </p>
            <p
              className="text-lg font-bold mt-1"
              style={{ color: "var(--fg)" }}
            >
              {entitlements.planName}
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--muted-fg)" }}
            >
              {features.filter((f) => f.enabled).length} of {features.length}{" "}
              white-label features unlocked
            </p>
          </div>
          <a
            href="/settings/billing"
            className="px-3 py-2 rounded-2xl text-xs font-semibold"
            style={{
              backgroundColor: "var(--accent-color)",
              color: "white",
            }}
          >
            Manage plan
          </a>
        </div>

        {/* Features list */}
        <div
          className="rounded-3xl p-5"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <h2
            className="text-[10px] font-semibold uppercase tracking-widest mb-4"
            style={{ color: "var(--muted-fg)" }}
          >
            What's Included
          </h2>
          <ul className="space-y-3">
            {features.map((feature) => (
              <li key={feature.title} className="flex items-start gap-3">
                <div
                  className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: feature.enabled
                      ? "rgba(16,185,129,0.15)"
                      : "var(--muted)",
                    color: feature.enabled ? "#059669" : "var(--muted-fg)",
                  }}
                >
                  {feature.enabled ? (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--fg)" }}
                    >
                      {feature.title}
                    </p>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: feature.enabled
                          ? "rgba(16,185,129,0.15)"
                          : "var(--muted)",
                        color: feature.enabled
                          ? "#059669"
                          : "var(--muted-fg)",
                      }}
                    >
                      {feature.enabled
                        ? "Active"
                        : `Requires ${feature.requiredPlan}`}
                    </span>
                  </div>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {feature.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact / upgrade CTA */}
        {features.some((f) => !f.enabled) && (
          <div
            className="rounded-3xl p-5 text-center"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <p className="text-sm mb-3" style={{ color: "var(--fg)" }}>
              Need the full white-label experience?
            </p>
            <a
              href="mailto:support@bevigo.app?subject=White-Label%20Inquiry"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-2xl"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              Contact us about Enterprise
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
