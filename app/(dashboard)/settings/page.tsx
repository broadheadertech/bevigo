"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";
import { CloneConfigDialog } from "@/components/locations/clone-config-dialog";
import { LocaleSelector } from "@/components/ui/locale-selector";

const TIMEOUT_OPTIONS = [
  { label: "5 minutes", value: 5 * 60 * 1000 },
  { label: "10 minutes", value: 10 * 60 * 1000 },
  { label: "15 minutes", value: 15 * 60 * 1000 },
  { label: "30 minutes", value: 30 * 60 * 1000 },
  { label: "1 hour", value: 60 * 60 * 1000 },
];

export default function SettingsPage() {
  const { session, token } = useAuth();

  const settings = useQuery(
    api.settings.queries.getSettings,
    token ? { token } : "skip"
  );
  const updateTimeout = useMutation(api.settings.mutations.updateIdleLockTimeout);

  const [selectedTimeout, setSelectedTimeout] = useState<number>(5 * 60 * 1000);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCloneDialog, setShowCloneDialog] = useState(false);

  // Sync from server settings when loaded
  useEffect(() => {
    if (settings?.idleLockTimeoutMs) {
      setSelectedTimeout(settings.idleLockTimeoutMs);
    }
  }, [settings?.idleLockTimeoutMs]);

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
        <p className="text-stone-400">Only owners can access settings.</p>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await updateTimeout({
        token,
        idleLockTimeoutMs: selectedTimeout,
      });
      setSuccessMessage("Settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = settings && selectedTimeout !== settings.idleLockTimeoutMs;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-stone-900">Settings</h1>
        <p className="text-sm text-stone-500 mt-0.5">Configure your POS system preferences</p>
      </div>

      <div className="space-y-6 max-w-lg">
        {/* Session Settings Section */}
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-6">
          <h2 className="text-base font-semibold text-stone-900 mb-1">Session Settings</h2>
          <p className="text-sm text-stone-500 mb-6">
            Configure auto-lock timeout for register sessions. After this period
            of inactivity, the register will lock and require PIN entry.
          </p>

          <div className="mb-6">
            <label
              htmlFor="idle-timeout"
              className="block text-sm font-medium text-stone-700 mb-2"
            >
              Auto-lock idle timeout
            </label>
            <select
              id="idle-timeout"
              value={selectedTimeout}
              onChange={(e) => {
                setSelectedTimeout(Number(e.target.value));
                setSuccessMessage(null);
                setError(null);
              }}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            >
              {TIMEOUT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-stone-400">
              Minimum: 5 minutes. Applies to all register sessions across all locations.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
              {successMessage}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="px-4 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Language Section */}
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-6">
          <h2 className="text-base font-semibold text-stone-900 mb-1">Language</h2>
          <p className="text-sm text-stone-500 mb-6">
            Choose the display language for the POS interface.
          </p>
          <LocaleSelector />
        </div>

        {/* Location Management Section */}
        <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm p-6">
          <h2 className="text-base font-semibold text-stone-900 mb-1">Location Management</h2>
          <p className="text-sm text-stone-500 mb-6">
            Clone configuration between locations, including menu pricing, tax
            settings, operating hours, and currency.
          </p>
          <button
            onClick={() => setShowCloneDialog(true)}
            className="px-4 py-2.5 border border-stone-200 text-stone-700 text-sm font-medium rounded-xl hover:bg-stone-50 transition-colors"
          >
            Clone Configuration
          </button>
        </div>
      </div>

      {showCloneDialog && (
        <CloneConfigDialog onClose={() => setShowCloneDialog(false)} />
      )}
    </div>
  );
}
