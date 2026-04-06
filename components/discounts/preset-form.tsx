"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useCallback, useMemo } from "react";
import { Id } from "../../convex/_generated/dataModel";

type PresetData = {
  _id: Id<"discountPresets">;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  reason: string;
  requiresAuth: boolean;
  sortOrder: number;
};

type PresetFormProps = {
  preset: PresetData | null;
  onClose: () => void;
};

export function PresetForm({ preset, onClose }: PresetFormProps) {
  const { token } = useAuth();
  const createPreset = useMutation(api.discounts.mutations.createPreset);
  const updatePreset = useMutation(api.discounts.mutations.updatePreset);

  const [name, setName] = useState(preset?.name ?? "");
  const [type, setType] = useState<"percentage" | "fixed">(preset?.type ?? "percentage");
  const [value, setValue] = useState(
    preset ? (preset.type === "fixed" ? String(preset.value / 100) : String(preset.value)) : ""
  );
  const [reason, setReason] = useState(preset?.reason ?? "");
  const [requiresAuth, setRequiresAuth] = useState(preset?.requiresAuth ?? false);
  const [sortOrder, setSortOrder] = useState(String(preset?.sortOrder ?? 0));
  const [saving, setSaving] = useState(false);

  const numericValue = parseFloat(value) || 0;

  const previewText = useMemo(() => {
    if (!name.trim() || numericValue <= 0) return null;
    if (type === "percentage") {
      return `This will apply a ${numericValue}% discount with reason "${reason || "—"}"`;
    }
    return `This will apply a P${numericValue.toFixed(2)} discount with reason "${reason || "—"}"`;
  }, [name, type, numericValue, reason]);

  const handleSubmit = useCallback(async () => {
    if (!token || !name.trim() || numericValue <= 0) return;
    setSaving(true);

    try {
      const order = parseInt(sortOrder, 10) || 0;
      // For fixed type, store in centavos; for percentage, store as-is
      const storeValue = type === "fixed" ? Math.round(numericValue * 100) : numericValue;

      if (preset) {
        await updatePreset({
          token,
          presetId: preset._id,
          name: name.trim(),
          type,
          value: storeValue,
          reason: reason.trim(),
          requiresAuth,
          sortOrder: order,
        });
      } else {
        await createPreset({
          token,
          name: name.trim(),
          type,
          value: storeValue,
          reason: reason.trim(),
          requiresAuth,
          sortOrder: order,
        });
      }
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save preset");
    } finally {
      setSaving(false);
    }
  }, [
    token, name, type, numericValue, reason, requiresAuth,
    sortOrder, preset, createPreset, updatePreset, onClose,
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative rounded-3xl shadow-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>
          {preset ? "Edit Preset" : "Add Preset"}
        </h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-fg)" }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Senior/PWD"
              className="w-full px-3 py-2 rounded-2xl text-sm outline-none"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            />
          </div>

          {/* Type toggle */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-fg)" }}>
              Type
            </label>
            <div className="flex rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
              <button
                type="button"
                className="flex-1 py-2.5 text-sm font-semibold transition-colors"
                style={
                  type === "percentage"
                    ? { backgroundColor: "var(--accent-color)", color: "white" }
                    : { color: "var(--muted-fg)" }
                }
                onClick={() => setType("percentage")}
              >
                Percentage (%)
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 text-sm font-semibold transition-colors"
                style={
                  type === "fixed"
                    ? { backgroundColor: "var(--accent-color)", color: "white" }
                    : { color: "var(--muted-fg)" }
                }
                onClick={() => setType("fixed")}
              >
                Fixed Amount
              </button>
            </div>
          </div>

          {/* Value */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-fg)" }}>
              {type === "percentage" ? "Percentage *" : "Amount (in pesos) *"}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max={type === "percentage" ? 100 : undefined}
                step={type === "percentage" ? 1 : 0.01}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "percentage" ? "e.g. 20" : "e.g. 50"}
                className="w-full px-3 py-2 rounded-2xl text-sm outline-none"
                style={{
                  backgroundColor: "var(--muted)",
                  color: "var(--fg)",
                  border: "1px solid var(--border-color)",
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--muted-fg)" }}>
                {type === "percentage" ? "%" : "PHP"}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-fg)" }}>
              Reason *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Senior/PWD"
              className="w-full px-3 py-2 rounded-2xl text-sm outline-none"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            />
          </div>

          {/* Requires Auth */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRequiresAuth(!requiresAuth)}
              className="w-10 h-6 rounded-full transition-colors relative flex-shrink-0"
              style={{
                backgroundColor: requiresAuth ? "var(--accent-color)" : "var(--muted)",
                border: "1px solid var(--border-color)",
              }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                style={{
                  left: requiresAuth ? "calc(100% - 1.25rem)" : "0.15rem",
                }}
              />
            </button>
            <label className="text-sm" style={{ color: "var(--fg)" }}>
              Requires manager authorization
            </label>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-fg)" }}>
              Sort Order
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-3 py-2 rounded-2xl text-sm outline-none"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            />
          </div>

          {/* Preview */}
          {previewText && (
            <div
              className="rounded-2xl px-4 py-3"
              style={{
                backgroundColor: "var(--muted)",
                border: "1px solid var(--border-color)",
              }}
            >
              <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                {previewText}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || numericValue <= 0}
            className="flex-1 px-4 py-2.5 text-white text-sm font-medium rounded-2xl disabled:opacity-50 transition-colors"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            {saving ? "Saving..." : preset ? "Save Changes" : "Add Preset"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium rounded-2xl transition-colors"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
