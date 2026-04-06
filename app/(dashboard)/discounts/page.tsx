"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useCallback } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { PresetForm } from "@/components/discounts/preset-form";

type Preset = {
  _id: Id<"discountPresets">;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  reason: string;
  requiresAuth: boolean;
  status: "active" | "inactive";
  sortOrder: number;
};

export default function DiscountsPage() {
  const { token } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);

  const presets = useQuery(
    api.discounts.queries.listAllPresets,
    token ? { token } : "skip"
  ) as Preset[] | undefined;

  const updatePreset = useMutation(api.discounts.mutations.updatePreset);

  const handleToggleStatus = useCallback(
    async (preset: Preset) => {
      if (!token) return;
      try {
        await updatePreset({
          token,
          presetId: preset._id,
          status: preset.status === "active" ? "inactive" : "active",
        });
      } catch (err) {
        console.error("Failed to toggle preset:", err);
      }
    },
    [token, updatePreset]
  );

  const handleEdit = useCallback((preset: Preset) => {
    setEditingPreset(preset);
    setShowForm(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditingPreset(null);
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
            Discount Presets
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-fg)" }}>
            Configure quick-access discounts for the register
          </p>
        </div>
        <button
          onClick={() => {
            setEditingPreset(null);
            setShowForm(true);
          }}
          className="px-4 py-2.5 text-white text-sm font-medium rounded-xl transition-colors"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          + Add Preset
        </button>
      </div>

      {/* Preset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(presets ?? []).map((preset: Preset) => (
          <div
            key={preset._id}
            className="rounded-3xl shadow-lg p-5 flex flex-col justify-between"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border-color)",
              opacity: preset.status === "inactive" ? 0.5 : 1,
            }}
          >
            <div>
              {/* Name + badges row */}
              <div className="flex items-start justify-between mb-2">
                <h3
                  className="font-semibold text-sm"
                  style={{ color: "var(--fg)" }}
                >
                  {preset.name}
                </h3>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Type badge */}
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: preset.type === "percentage"
                        ? "rgba(59, 130, 246, 0.15)"
                        : "rgba(168, 85, 247, 0.15)",
                      color: preset.type === "percentage"
                        ? "rgb(59, 130, 246)"
                        : "rgb(168, 85, 247)",
                    }}
                  >
                    {preset.type === "percentage" ? "%" : "P"}
                  </span>
                </div>
              </div>

              {/* Value */}
              <div className="flex items-center gap-1 mb-2">
                <span
                  className="text-lg font-bold"
                  style={{ color: "var(--accent-color)" }}
                >
                  {preset.type === "percentage"
                    ? `${preset.value}%`
                    : `P${(preset.value / 100).toFixed(2)}`}
                </span>
              </div>

              {/* Reason */}
              <p className="text-xs mb-3" style={{ color: "var(--muted-fg)" }}>
                Reason: {preset.reason}
              </p>

              {/* Badges row */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {preset.requiresAuth && (
                  <span className="bg-red-500/10 text-red-400 rounded-full px-2 py-0.5 text-xs font-medium">
                    Auth Required
                  </span>
                )}
                {preset.status === "inactive" && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                      color: "rgb(239, 68, 68)",
                    }}
                  >
                    Inactive
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleEdit(preset)}
                className="text-xs font-medium px-3 py-1.5 rounded-xl transition-colors"
                style={{
                  backgroundColor: "var(--muted)",
                  color: "var(--fg)",
                }}
              >
                Edit
              </button>
              <button
                onClick={() => handleToggleStatus(preset)}
                className="text-xs font-medium px-3 py-1.5 rounded-xl transition-colors"
                style={{
                  backgroundColor: preset.status === "active"
                    ? "rgba(239, 68, 68, 0.1)"
                    : "rgba(34, 197, 94, 0.1)",
                  color: preset.status === "active"
                    ? "rgb(239, 68, 68)"
                    : "rgb(34, 197, 94)",
                }}
              >
                {preset.status === "active" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {(presets ?? []).length === 0 && (
        <div
          className="rounded-3xl shadow-lg p-12 text-center"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            No discount presets yet. Add your first preset to get started.
          </p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <PresetForm
          preset={editingPreset}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
