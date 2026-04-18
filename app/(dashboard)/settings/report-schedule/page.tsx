"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useMemo } from "react";

type ReportFrequency = "daily" | "weekly" | "monthly" | "none";

type SettingsResult = {
  idleLockTimeoutMs: number;
  reportEmail?: string;
  reportFrequency?: ReportFrequency;
  sendPartialReport?: boolean;
  partialReportTime?: string;
  dailyReportTime?: string;
};

export default function ReportSchedulePage() {
  const { session, token } = useAuth();
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<ReportFrequency>("none");
  const [sendPartial, setSendPartial] = useState(false);
  const [partialTime, setPartialTime] = useState("14:00");
  const [dailyTime, setDailyTime] = useState("22:00");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [testing, setTesting] = useState<"partial" | "daily" | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const settings = useQuery(
    api.settings.queries.getSettings,
    token ? { token } : "skip"
  ) as SettingsResult | undefined;

  const updateSchedule = useMutation(api.settings.mutations.updateReportSchedule);
  const sendTest = useAction(api.reports.email.sendTestReport);

  const shouldInit = !initialized && settings !== undefined;
  const initEmail = useMemo(
    () => (shouldInit ? settings?.reportEmail ?? "" : null),
    [shouldInit, settings?.reportEmail]
  );
  const initFreq = useMemo(
    () => (shouldInit ? settings?.reportFrequency ?? "none" : null),
    [shouldInit, settings?.reportFrequency]
  );
  const initPartial = useMemo(
    () => (shouldInit ? settings?.sendPartialReport ?? false : null),
    [shouldInit, settings?.sendPartialReport]
  );
  const initPartialTime = useMemo(
    () => (shouldInit ? settings?.partialReportTime ?? "14:00" : null),
    [shouldInit, settings?.partialReportTime]
  );
  const initDailyTime = useMemo(
    () => (shouldInit ? settings?.dailyReportTime ?? "22:00" : null),
    [shouldInit, settings?.dailyReportTime]
  );

  if (
    initEmail !== null &&
    initFreq !== null &&
    initPartial !== null &&
    initPartialTime !== null &&
    initDailyTime !== null &&
    !initialized
  ) {
    setEmail(initEmail);
    setFrequency(initFreq);
    setSendPartial(initPartial);
    setPartialTime(initPartialTime);
    setDailyTime(initDailyTime);
    setInitialized(true);
  }

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>Loading...</p>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateSchedule({
        token,
        reportEmail: email,
        reportFrequency: frequency,
        sendPartialReport: sendPartial,
        partialReportTime: partialTime,
        dailyReportTime: dailyTime,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (kind: "partial" | "daily") => {
    setTesting(kind);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await sendTest({ token, kind });
      setTestResult(`Sent to ${res.recipient}`);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setTesting(null);
    }
  };

  const frequencyOptions: Array<{ value: ReportFrequency; label: string }> = [
    { value: "none", label: "Disabled" },
    { value: "daily", label: "Every day" },
    { value: "weekly", label: "Weekly (Sunday)" },
    { value: "monthly", label: "Monthly (last day)" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-lg md:text-xl font-bold" style={{ color: "var(--fg)" }}>
          Scheduled Email Reports
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
          Get sales, payroll, and stock snapshots delivered to your inbox automatically
        </p>
      </div>

      <div
        className="rounded-2xl shadow-lg p-6 max-w-2xl space-y-6"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        {/* Recipient */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
            Recipient Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSaved(false);
            }}
            placeholder="owner@yourcafe.com"
            className="w-full rounded-2xl px-3 py-3 text-sm"
            style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
          />
          <p className="text-xs mt-1" style={{ color: "var(--muted-fg)" }}>
            Falls back to the <code>REPORT_DEFAULT_EMAIL</code> env var if blank.
          </p>
        </div>

        {/* End-of-day */}
        <div className="pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>
            End-of-Day Report
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => {
                  setFrequency(e.target.value as ReportFrequency);
                  setSaved(false);
                }}
                className="w-full rounded-2xl px-3 py-3 text-sm"
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
              >
                {frequencyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                Time of day
              </label>
              <input
                type="time"
                value={dailyTime}
                onChange={(e) => {
                  setDailyTime(e.target.value);
                  setSaved(false);
                }}
                className="w-full rounded-2xl px-3 py-3 text-sm"
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                disabled={frequency === "none"}
              />
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--muted-fg)" }}>
            Includes full-day sales totals, payment breakdown, top items, staff hours, shift cash variances, and low-stock alerts. Time is in your shop's timezone.
          </p>
          <button
            onClick={() => handleTest("daily")}
            disabled={testing !== null}
            className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            {testing === "daily" ? "Sending..." : "Send a test now"}
          </button>
        </div>

        {/* Mid-day */}
        <div className="pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>
            Mid-Day (Partial) Report
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendPartial}
              onChange={(e) => {
                setSendPartial(e.target.checked);
                setSaved(false);
              }}
              className="w-4 h-4 accent-amber-500"
            />
            <span className="text-sm" style={{ color: "var(--fg)" }}>
              Send a mid-day snapshot
            </span>
          </label>

          <div className="mt-3 max-w-45">
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
              Time of day
            </label>
            <input
              type="time"
              value={partialTime}
              onChange={(e) => {
                setPartialTime(e.target.value);
                setSaved(false);
              }}
              disabled={!sendPartial}
              className="w-full rounded-2xl px-3 py-3 text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--muted-fg)" }}>
            Sales so far today, payment breakdown, top items, who's currently clocked in, and low-stock alerts.
          </p>
          <button
            onClick={() => handleTest("partial")}
            disabled={testing !== null}
            className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            {testing === "partial" ? "Sending..." : "Send a test now"}
          </button>
        </div>

        {testResult && (
          <p className="text-sm p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
            ✓ {testResult}
          </p>
        )}
        {testError && (
          <p className="text-sm p-3 rounded-2xl bg-red-500/10 text-red-400">
            {testError}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
          {saved && (
            <span className="text-sm font-medium text-emerald-400">
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
