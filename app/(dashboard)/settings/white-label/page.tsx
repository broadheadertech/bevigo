"use client";

import { useAuth } from "@/lib/auth-context";

export default function WhiteLabelSettingsPage() {
  const { session, token } = useAuth();

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
        <p className="text-stone-400">Only owners can access white-label settings.</p>
      </div>
    );
  }

  const features = [
    {
      title: "Custom Branding",
      description: "Replace all bevi&go branding with your own logo, colors, and name.",
      available: true,
    },
    {
      title: "Custom Domain",
      description: "Use your own domain for the public menu and customer-facing pages.",
      available: false,
    },
    {
      title: "Remove bevi&go Footer",
      description: "Remove the \"Powered by bevi&go\" footer from all public pages.",
      available: false,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">White-Label</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
          Make the POS completely yours with white-label features
        </p>
      </div>

      <div className="space-y-6 max-w-lg">
        {/* Info card */}
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <div>
              <h2 className="text-base font-semibold text-amber-900">White-Label Available</h2>
              <p className="text-sm text-amber-700 mt-1">
                White-label features allow you to completely customize the POS
                experience for your business. Contact us to enable the full
                white-label package.
              </p>
            </div>
          </div>
        </div>

        {/* Features list */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-6">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-4">What&apos;s Included</h2>

          <div className="space-y-4">
            {features.map((feature: { title: string; description: string; available: boolean }) => (
              <div key={feature.title} className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  feature.available
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-stone-100 text-stone-400"
                }`}>
                  {feature.available ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-800 dark:text-stone-200">{feature.title}</p>
                  <p className="text-sm text-stone-500">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-6 text-center">
          <p className="text-sm text-stone-600 mb-3">
            Interested in the full white-label experience?
          </p>
          <a
            href="mailto:support@bevigo.app?subject=White-Label%20Inquiry"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 transition-colors"
          >
            Contact Us to Enable
          </a>
        </div>
      </div>
    </div>
  );
}
