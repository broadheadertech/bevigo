"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";

type ReportFrequency = "daily" | "weekly" | "monthly" | "none";

type SettingsResult = {
  idleLockTimeoutMs: number;
  reportEmail?: string;
  reportFrequency?: ReportFrequency;
};

export default function ReportSchedulePage() {
  const { session, token } = useAuth();
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<ReportFrequency>("none");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const settings = useQuery(
    api.settings.queries.getSettings,
    token ? { token } : "skip"
  ) as SettingsResult | undefined;

  const updateSchedule = useMutation(api.settings.mutations.updateReportSchedule);

  // Initialize form from settings once loaded
  const shouldInit = !initialized && settings !== undefined;
  const initEmail = useMemo(
    () => (shouldInit ? (settings?.reportEmail ?? "") : null),
    [shouldInit, settings?.reportEmail]
  );
  const initFreq = useMemo(
    () => (shouldInit ? (settings?.reportFrequency ?? "none") : null),
    [shouldInit, settings?.reportFrequency]
  );

  if (initEmail !== null && initFreq !== null && !initialized) {
    setEmail(initEmail);
    setFrequency(initFreq);
    setInitialized(true);
  }

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateSchedule({ token, reportEmail: email, reportFrequency: frequency });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const frequencyOptions: Array<{ value: ReportFrequency; label: string }> = [
    { value: "none", label: "Disabled" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100">
          Scheduled Email Reports
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
          Configure automated report delivery to your inbox
        </p>
      </div>

      {/* Coming soon banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-amber-600 mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-900">
              Coming soon
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Automated email delivery is under development. You can save your
              preferences now and they will be activated once the feature is
              ready. In the meantime, use the Export CSV and Export PDF buttons
              on each report page.
            </p>
          </div>
        </div>
      </div>

      {/* Settings form */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-sm p-6 max-w-lg">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSaved(false);
              }}
              placeholder="owner@bevigo.com"
              className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
            <p className="text-xs text-stone-400 mt-1">
              Reports will be sent to this email address.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => {
                setFrequency(e.target.value as ReportFrequency);
                setSaved(false);
              }}
              className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            >
              {frequencyOptions.map((opt: { value: ReportFrequency; label: string }) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-stone-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-800 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">
                Saved successfully
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
