"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";

export default function DomainSettingsPage() {
  const { session, token } = useAuth();

  const branding = useQuery(
    api.settings.queries.getBranding,
    token ? { token } : "skip"
  );
  const updateDomain = useMutation(api.settings.mutations.updateCustomDomain);

  const [customDomain, setCustomDomain] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (branding?.customDomain) {
      setCustomDomain(branding.customDomain);
    }
  }, [branding?.customDomain]);

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
        <p className="text-stone-400">Only owners can access domain settings.</p>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await updateDomain({ token, customDomain });
      setSuccessMessage("Custom domain saved. Verification is not yet active.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save domain");
    } finally {
      setIsSaving(false);
    }
  };

  const tenantSlug = session.tenantId.split("|").pop() ?? "your-shop";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Custom Domain</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
          Configure a custom domain for your public menu and storefront
        </p>
      </div>

      <div className="space-y-6 max-w-lg">
        {/* Current domain */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-6">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-1">Current Domain</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
            Your public menu is accessible at:
          </p>
          <div className="px-3 py-2.5 bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 text-sm font-mono text-stone-700">
            {tenantSlug}.bevigo.app
          </div>
        </div>

        {/* Custom domain */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">Custom Domain</h2>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              Coming Soon
            </span>
          </div>

          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
            Use your own domain for the public menu. Follow these steps:
          </p>

          <ol className="text-sm text-stone-600 space-y-3 mb-6 list-decimal list-inside">
            <li>
              Add a <span className="font-mono text-xs bg-stone-100 px-1.5 py-0.5 rounded">CNAME</span> record
              pointing to <span className="font-mono text-xs bg-stone-100 px-1.5 py-0.5 rounded">bevigo.app</span>
            </li>
            <li>Enter your domain below</li>
            <li>We&apos;ll verify and activate it</li>
          </ol>

          <div className="mb-4">
            <label htmlFor="custom-domain" className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Your Domain
            </label>
            <input
              id="custom-domain"
              type="text"
              value={customDomain}
              onChange={(e) => { setCustomDomain(e.target.value); setSuccessMessage(null); }}
              placeholder="menu.yourcoffeeshop.com"
              className="w-full rounded-xl border-stone-200 dark:border-stone-700 border dark:bg-stone-800 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm">
              {successMessage}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !customDomain}
            className="px-4 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? "Saving..." : "Save Domain"}
          </button>
        </div>
      </div>
    </div>
  );
}
