"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";

export default function BrandingSettingsPage() {
  const { session, token } = useAuth();

  const branding = useQuery(
    api.settings.queries.getBranding,
    token ? { token } : "skip"
  );
  const updateBranding = useMutation(api.settings.mutations.updateBranding);

  const [brandName, setBrandName] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#7C3A12");
  const [accentColor, setAccentColor] = useState("#D97706");
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (branding) {
      setBrandName(branding.brandName);
      setBrandLogoUrl(branding.brandLogoUrl);
      setPrimaryColor(branding.primaryColor);
      setAccentColor(branding.accentColor);
    }
  }, [branding]);

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
        <p className="text-stone-400">Only owners can access branding settings.</p>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await updateBranding({
        token,
        brandName: brandName || undefined,
        brandLogoUrl: brandLogoUrl || undefined,
        primaryColor: primaryColor || undefined,
        accentColor: accentColor || undefined,
      });
      setSuccessMessage("Branding saved successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save branding");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-stone-900">Branding</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Customize your brand appearance across the POS and public menu
        </p>
      </div>

      <div className="grid gap-6 max-w-2xl lg:grid-cols-2">
        {/* Settings Form */}
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-6">
          <h2 className="text-base font-semibold text-stone-900 mb-4">Brand Settings</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="brand-name" className="block text-sm font-medium text-stone-700 mb-1.5">
                Brand Name
              </label>
              <input
                id="brand-name"
                type="text"
                value={brandName}
                onChange={(e) => { setBrandName(e.target.value); setSuccessMessage(null); }}
                placeholder="e.g. My Coffee Shop"
                className="w-full rounded-xl border-stone-200 border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              />
              <p className="mt-1 text-xs text-stone-400">
                Replaces &quot;bevi&amp;go&quot; in the sidebar and public menu
              </p>
            </div>

            <div>
              <label htmlFor="brand-logo" className="block text-sm font-medium text-stone-700 mb-1.5">
                Logo URL
              </label>
              <input
                id="brand-logo"
                type="url"
                value={brandLogoUrl}
                onChange={(e) => { setBrandLogoUrl(e.target.value); setSuccessMessage(null); }}
                placeholder="https://example.com/logo.png"
                className="w-full rounded-xl border-stone-200 border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              />
              <p className="mt-1 text-xs text-stone-400">
                Square image recommended (at least 64x64)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="primary-color" className="block text-sm font-medium text-stone-700 mb-1.5">
                  Primary Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => { setPrimaryColor(e.target.value); setSuccessMessage(null); }}
                    className="w-10 h-10 rounded-lg border border-stone-200 cursor-pointer p-0.5"
                  />
                  <input
                    id="primary-color"
                    type="text"
                    value={primaryColor}
                    onChange={(e) => { setPrimaryColor(e.target.value); setSuccessMessage(null); }}
                    className="flex-1 rounded-xl border-stone-200 border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="accent-color" className="block text-sm font-medium text-stone-700 mb-1.5">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => { setAccentColor(e.target.value); setSuccessMessage(null); }}
                    className="w-10 h-10 rounded-lg border border-stone-200 cursor-pointer p-0.5"
                  />
                  <input
                    id="accent-color"
                    type="text"
                    value={accentColor}
                    onChange={(e) => { setAccentColor(e.target.value); setSuccessMessage(null); }}
                    className="flex-1 rounded-xl border-stone-200 border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
              {successMessage}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="mt-4 px-4 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? "Saving..." : "Save Branding"}
          </button>
        </div>

        {/* Live Preview */}
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-6">
          <h2 className="text-base font-semibold text-stone-900 mb-4">Preview</h2>

          {/* Sidebar preview */}
          <div className="rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100" style={{ backgroundColor: primaryColor + "10" }}>
              <div className="flex items-center gap-2.5">
                {brandLogoUrl ? (
                  <img
                    src={brandLogoUrl}
                    alt="Brand logo"
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span className="text-white text-sm font-bold">
                      {(brandName || "B").charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold" style={{ color: primaryColor }}>
                    {brandName || "bevi&go"}
                  </p>
                  <p className="text-[10px] font-medium text-stone-400 uppercase tracking-widest">POS</p>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 space-y-1.5">
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: accentColor }}
              >
                <div className="w-4 h-4 rounded bg-white/30" />
                Dashboard
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-stone-500">
                <div className="w-4 h-4 rounded bg-stone-200" />
                Menu
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-stone-500">
                <div className="w-4 h-4 rounded bg-stone-200" />
                Orders
              </div>
            </div>
          </div>

          {/* Public menu preview */}
          <div className="mt-4 rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-200" style={{ backgroundColor: primaryColor + "08" }}>
              <p className="text-sm font-bold" style={{ color: primaryColor }}>
                {brandName || "bevi&go"}
              </p>
              <p className="text-xs text-stone-400">Public Menu Header</p>
            </div>
            <div className="px-4 py-2 text-center border-t border-stone-100 bg-stone-50">
              <p className="text-[10px] text-stone-400">
                Powered by {brandName || "bevi&go"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
