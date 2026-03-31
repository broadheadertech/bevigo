"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";

type LocationInfo = {
  _id: Id<"locations">;
  name: string;
  slug: string;
  status: string;
};

type CloneOptions = {
  menuPricing: boolean;
  taxConfig: boolean;
  operatingHours: boolean;
  currency: boolean;
};

type CloneConfigDialogProps = {
  onClose: () => void;
};

const inputClass = "w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors";

export function CloneConfigDialog({ onClose }: CloneConfigDialogProps) {
  const { token } = useAuth();

  const [sourceLocationId, setSourceLocationId] = useState<
    Id<"locations"> | ""
  >("");
  const [targetLocationId, setTargetLocationId] = useState<
    Id<"locations"> | ""
  >("");
  const [cloneOptions, setCloneOptions] = useState<CloneOptions>({
    menuPricing: false,
    taxConfig: false,
    operatingHours: false,
    currency: false,
  });
  const [overwriteConflicts, setOverwriteConflicts] = useState(false);
  const [step, setStep] = useState<"select" | "options" | "done">("select");
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string[]>([]);

  const locationData = useQuery(
    api.settings.queries.listLocations,
    token ? { token } : "skip"
  );

  const cloneLocationConfig = useMutation(
    api.locations.cloneMutations.cloneLocationConfig
  );
  const cloneMenu = useMutation(api.menu.cloneMutations.cloneMenu);

  const locationsList = (locationData ?? []) as LocationInfo[];

  const canProceed =
    sourceLocationId &&
    targetLocationId &&
    sourceLocationId !== targetLocationId;

  const anyOptionSelected =
    cloneOptions.menuPricing ||
    cloneOptions.taxConfig ||
    cloneOptions.operatingHours ||
    cloneOptions.currency;

  const toggleOption = (key: keyof CloneOptions) => {
    setCloneOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNextStep = () => {
    if (!canProceed) return;
    setError(null);
    setStep("options");
  };

  const handleClone = async () => {
    if (!token || !sourceLocationId || !targetLocationId || !anyOptionSelected)
      return;

    setIsCloning(true);
    setError(null);

    const results: string[] = [];

    try {
      // Clone location config (tax, hours, currency) if any selected
      if (
        cloneOptions.taxConfig ||
        cloneOptions.operatingHours ||
        cloneOptions.currency
      ) {
        const configResult = await cloneLocationConfig({
          token,
          sourceLocationId: sourceLocationId as Id<"locations">,
          targetLocationId: targetLocationId as Id<"locations">,
          cloneOptions: {
            taxConfig: cloneOptions.taxConfig,
            operatingHours: cloneOptions.operatingHours,
            currency: cloneOptions.currency,
          },
        });

        if (configResult.clonedFields.includes("taxConfig")) {
          results.push("Tax configuration (rate and label)");
        }
        if (configResult.clonedFields.includes("operatingHours")) {
          results.push("Operating hours");
        }
        if (
          configResult.clonedFields.includes("currency") ||
          configResult.clonedFields.includes("timezone")
        ) {
          results.push("Currency and timezone");
        }
      }

      // Clone menu pricing if selected (uses existing mutation)
      if (cloneOptions.menuPricing) {
        const menuResult = await cloneMenu({
          token,
          sourceLocationId: sourceLocationId as Id<"locations">,
          targetLocationId: targetLocationId as Id<"locations">,
          overwriteConflicts,
        });
        results.push(
          `Menu pricing (${menuResult.created} created, ${menuResult.updated} updated, ${menuResult.skipped} skipped)`
        );
      }

      setSummary(results);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col border border-stone-200/60">
        <h2 className="text-lg font-bold text-stone-900 mb-4">Clone Location Configuration</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        {step === "select" && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Source Location
              </label>
              <select
                value={sourceLocationId}
                onChange={(e) =>
                  setSourceLocationId(e.target.value as Id<"locations"> | "")
                }
                className={inputClass}
              >
                <option value="">Select source location...</option>
                {locationsList.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Target Location
              </label>
              <select
                value={targetLocationId}
                onChange={(e) =>
                  setTargetLocationId(e.target.value as Id<"locations"> | "")
                }
                className={inputClass}
              >
                <option value="">Select target location...</option>
                {locationsList
                  .filter((loc) => loc._id !== sourceLocationId)
                  .map((loc) => (
                    <option key={loc._id} value={loc._id}>
                      {loc.name}
                    </option>
                  ))}
              </select>
            </div>

            {sourceLocationId &&
              targetLocationId &&
              sourceLocationId === targetLocationId && (
                <p className="text-sm text-red-600">
                  Source and target locations must be different.
                </p>
              )}

            <p className="text-sm text-stone-500">
              Copy configuration from one location to another. You will choose
              what to clone in the next step.
            </p>

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-stone-700 border border-stone-200 rounded-xl hover:bg-stone-50 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                disabled={!canProceed}
                className="px-4 py-2.5 bg-stone-900 text-white rounded-xl hover:bg-stone-800 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === "options" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-stone-600">
              Select which configuration to clone:
            </p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={cloneOptions.menuPricing}
                  onChange={() => toggleOption("menuPricing")}
                  className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500/20"
                />
                <div>
                  <span className="text-sm font-medium text-stone-800">
                    Menu pricing
                  </span>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Location-specific price overrides for menu items
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={cloneOptions.taxConfig}
                  onChange={() => toggleOption("taxConfig")}
                  className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500/20"
                />
                <div>
                  <span className="text-sm font-medium text-stone-800">
                    Tax configuration
                  </span>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Tax rate and tax label
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={cloneOptions.operatingHours}
                  onChange={() => toggleOption("operatingHours")}
                  className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500/20"
                />
                <div>
                  <span className="text-sm font-medium text-stone-800">
                    Operating hours
                  </span>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Weekly schedule (open/close times for each day)
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-stone-200 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={cloneOptions.currency}
                  onChange={() => toggleOption("currency")}
                  className="mt-0.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500/20"
                />
                <div>
                  <span className="text-sm font-medium text-stone-800">
                    Currency and timezone
                  </span>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Currency code and timezone setting
                  </p>
                </div>
              </label>
            </div>

            {cloneOptions.menuPricing && (
              <label className="flex items-center gap-2 text-sm pl-1">
                <input
                  type="checkbox"
                  checked={overwriteConflicts}
                  onChange={(e) => setOverwriteConflicts(e.target.checked)}
                  className="rounded border-stone-300 text-amber-600 focus:ring-amber-500/20"
                />
                <span className="text-stone-700">
                  Overwrite existing price overrides at target location
                </span>
              </label>
            )}

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setStep("select")}
                className="px-4 py-2.5 text-stone-700 border border-stone-200 rounded-xl hover:bg-stone-50 text-sm font-medium transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleClone}
                disabled={isCloning || !anyOptionSelected}
                className="px-4 py-2.5 bg-stone-900 text-white rounded-xl hover:bg-stone-800 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {isCloning ? "Cloning..." : "Clone Configuration"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-emerald-800 font-medium mb-2">
                Configuration cloned successfully!
              </p>
              <ul className="text-sm text-emerald-700 space-y-1">
                {summary.map((item, i) => (
                  <li key={i}>- {item}</li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-stone-900 text-white rounded-xl hover:bg-stone-800 text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
