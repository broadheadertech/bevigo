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

type SourceOverride = {
  menuItemId: string;
  itemName: string;
  price: number;
};

type Conflict = {
  menuItemId: string;
  itemName: string;
  sourcePrice: number;
  targetPrice: number;
};

type CloneMenuDialogProps = {
  onClose: () => void;
};

export function CloneMenuDialog({ onClose }: CloneMenuDialogProps) {
  const { token } = useAuth();

  const [sourceLocationId, setSourceLocationId] = useState<
    Id<"locations"> | ""
  >("");
  const [targetLocationId, setTargetLocationId] = useState<
    Id<"locations"> | ""
  >("");
  const [overwriteConflicts, setOverwriteConflicts] = useState(false);
  const [step, setStep] = useState<"select" | "preview" | "done">("select");
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
  } | null>(null);

  const locationData = useQuery(
    api.settings.queries.listLocations,
    token ? { token } : "skip"
  );

  const preview = useQuery(
    api.menu.cloneMutations.previewClone,
    token && sourceLocationId && targetLocationId
      ? {
          token,
          sourceLocationId: sourceLocationId as Id<"locations">,
          targetLocationId: targetLocationId as Id<"locations">,
        }
      : "skip"
  );

  const cloneMenuMutation = useMutation(api.menu.cloneMutations.cloneMenu);

  const locationsList = (locationData ?? []) as LocationInfo[];

  const canPreview =
    sourceLocationId && targetLocationId && sourceLocationId !== targetLocationId;

  const handlePreview = () => {
    if (!canPreview) return;
    setError(null);
    setStep("preview");
  };

  const handleClone = async () => {
    if (!token || !sourceLocationId || !targetLocationId) return;

    setIsCloning(true);
    setError(null);

    try {
      const res = await cloneMenuMutation({
        token,
        sourceLocationId: sourceLocationId as Id<"locations">,
        targetLocationId: targetLocationId as Id<"locations">,
        overwriteConflicts,
      });
      setResult(res);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsCloning(false);
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-4">Clone Menu Pricing</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {step === "select" && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-stone-300 mb-1">
                Source Location
              </label>
              <select
                value={sourceLocationId}
                onChange={(e) =>
                  setSourceLocationId(e.target.value as Id<"locations"> | "")
                }
                className="w-full border border-gray-300 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded px-3 py-2"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-stone-300 mb-1">
                Target Location
              </label>
              <select
                value={targetLocationId}
                onChange={(e) =>
                  setTargetLocationId(e.target.value as Id<"locations"> | "")
                }
                className="w-full border border-gray-300 dark:border-stone-700 dark:bg-stone-800 dark:text-white rounded px-3 py-2"
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

            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
              This will copy all location-specific price overrides from the
              source to the target location.
            </p>

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-stone-400 border border-gray-300 dark:border-stone-700 rounded-lg hover:bg-gray-50 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={!canPreview}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Preview
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-4 overflow-hidden">
            {preview === undefined ? (
              <p className="text-gray-400 dark:text-gray-500">Loading preview...</p>
            ) : (
              <>
                <div className="overflow-y-auto flex-1">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Price overrides to copy ({preview.sourceOverrides.length})
                  </h3>

                  {preview.sourceOverrides.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      No price overrides found at the source location.
                    </p>
                  ) : (
                    <div className="border border-gray-200 dark:border-stone-700 rounded overflow-hidden mb-4">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-stone-400">
                              Item
                            </th>
                            <th className="text-right px-3 py-2 font-medium text-gray-600 dark:text-stone-400">
                              Price
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.sourceOverrides.map((o: SourceOverride) => (
                            <tr
                              key={o.menuItemId}
                              className="border-t border-gray-100 dark:border-stone-800"
                            >
                              <td className="px-3 py-2">{o.itemName}</td>
                              <td className="px-3 py-2 text-right">
                                ${formatPrice(o.price)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {preview.conflicts.length > 0 && (
                    <>
                      <h3 className="text-sm font-medium text-amber-700 mb-2">
                        Conflicts ({preview.conflicts.length})
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        These items already have price overrides at the target
                        location.
                      </p>
                      <div className="border border-amber-200 rounded overflow-hidden mb-4">
                        <table className="w-full text-sm">
                          <thead className="bg-amber-50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-amber-700">
                                Item
                              </th>
                              <th className="text-right px-3 py-2 font-medium text-amber-700">
                                Source
                              </th>
                              <th className="text-right px-3 py-2 font-medium text-amber-700">
                                Target
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.conflicts.map((c: Conflict) => (
                              <tr
                                key={c.menuItemId}
                                className="border-t border-amber-100"
                              >
                                <td className="px-3 py-2">{c.itemName}</td>
                                <td className="px-3 py-2 text-right">
                                  ${formatPrice(c.sourcePrice)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  ${formatPrice(c.targetPrice)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={overwriteConflicts}
                          onChange={(e) =>
                            setOverwriteConflicts(e.target.checked)
                          }
                          className="rounded border-gray-300"
                        />
                        <span>Overwrite existing prices at target location</span>
                      </label>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("select");
                      setOverwriteConflicts(false);
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-stone-400 border border-gray-300 dark:border-stone-700 rounded-lg hover:bg-gray-50 dark:hover:bg-stone-800"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleClone}
                    disabled={
                      isCloning || preview.sourceOverrides.length === 0
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isCloning ? "Cloning..." : "Clone Prices"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 font-medium mb-2">
                Clone completed successfully!
              </p>
              <ul className="text-sm text-green-700 space-y-1">
                <li>Created: {result.created} price override(s)</li>
                <li>Updated: {result.updated} price override(s)</li>
                <li>Skipped: {result.skipped} conflicting override(s)</li>
              </ul>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
