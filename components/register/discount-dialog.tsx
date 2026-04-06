"use client";

import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";

const DISCOUNT_REASONS = [
  "Senior/PWD",
  "Employee",
  "Manager Override",
  "Promo",
  "Custom",
];

type DiscountPreset = {
  _id: Id<"discountPresets">;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  reason: string;
  requiresAuth: boolean;
};

type DiscountDialogProps = {
  orderId: Id<"orders">;
  orderSubtotal: number;
  onClose: () => void;
  onApplied: () => void;
};

export function DiscountDialog({
  orderId,
  orderSubtotal,
  onClose,
  onApplied,
}: DiscountDialogProps) {
  const { token, session } = useAuth();
  const applyDiscount = useMutation(api.orders.mutations.applyDiscount);

  const presets = useQuery(
    api.discounts.queries.listPresets,
    token ? { token } : "skip"
  ) as DiscountPreset[] | undefined;

  const [selectedPresetId, setSelectedPresetId] = useState<Id<"discountPresets"> | null>(null);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("Senior/PWD");
  const [customReason, setCustomReason] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericValue = parseFloat(value) || 0;

  const discountAmount = useMemo(() => {
    if (discountType === "percentage") {
      return Math.round(orderSubtotal * numericValue / 100);
    }
    // For fixed, user enters in pesos -- convert to centavos
    return Math.round(numericValue * 100);
  }, [discountType, numericValue, orderSubtotal]);

  const cappedAmount = Math.min(discountAmount, orderSubtotal);

  const discountPercent = orderSubtotal > 0
    ? (cappedAmount / orderSubtotal) * 100
    : 0;

  const needsAuth = discountPercent > 20 || cappedAmount > 20000;

  const userRole = session?.role as string | undefined;

  const handleSelectPreset = (preset: DiscountPreset) => {
    if (selectedPresetId === preset._id) {
      // Deselect
      setSelectedPresetId(null);
      setDiscountType("percentage");
      setValue("");
      setReason("Senior/PWD");
      setError(null);
      return;
    }

    // Check auth requirement
    if (preset.requiresAuth && userRole === "barista") {
      setError("Manager authorization required for this discount");
      return;
    }

    setSelectedPresetId(preset._id);
    setDiscountType(preset.type);
    // For fixed, convert centavos to pesos for display
    setValue(
      preset.type === "fixed"
        ? String(preset.value / 100)
        : String(preset.value)
    );
    setReason(preset.reason);
    setCustomReason("");
    setError(null);
  };

  const handleApply = async () => {
    if (!token || numericValue <= 0) return;
    setError(null);
    setIsApplying(true);

    try {
      const finalReason = reason === "Custom" ? customReason.trim() || "Custom" : reason;
      const discountValue = discountType === "fixed"
        ? Math.round(numericValue * 100) // convert pesos to centavos
        : numericValue;

      await applyDiscount({
        token,
        orderId,
        discountType,
        discountValue,
        discountReason: finalReason,
      });
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply discount");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>Add Discount</h2>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-300 text-xl leading-none p-1"
            >
              &#10005;
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Quick Select Presets */}
          {presets && presets.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-fg)' }}>
                Quick Select
              </label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => {
                  const isSelected = selectedPresetId === preset._id;
                  const displayValue = preset.type === "percentage"
                    ? `${preset.value}%`
                    : `P${(preset.value / 100).toFixed(0)}`;
                  return (
                    <button
                      key={preset._id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="rounded-2xl px-4 py-3 text-left transition-all relative"
                      style={{
                        backgroundColor: isSelected ? 'var(--accent-color)' : 'var(--muted)',
                        border: isSelected
                          ? '2px solid var(--accent-color)'
                          : '1px solid var(--border-color)',
                        color: isSelected ? 'white' : 'var(--fg)',
                      }}
                    >
                      <span className="text-sm font-semibold block">
                        {preset.name}
                      </span>
                      <span
                        className="text-xs block mt-0.5"
                        style={{ opacity: isSelected ? 0.85 : 0.6 }}
                      >
                        {displayValue}
                      </span>
                      {preset.requiresAuth && (
                        <span
                          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                          style={{ backgroundColor: 'rgb(239, 68, 68)' }}
                          title="Auth required"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Divider */}
          {presets && presets.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
              <span className="text-xs" style={{ color: 'var(--muted-fg)' }}>or enter manually</span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
            </div>
          )}

          {/* Type toggle */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-fg)' }}>
              Discount Type
            </label>
            <div className="flex rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
              <button
                className="flex-1 py-2.5 text-sm font-semibold transition-colors"
                style={
                  discountType === "percentage"
                    ? { backgroundColor: 'var(--accent-color)', color: 'white' }
                    : { color: 'var(--muted-fg)' }
                }
                onClick={() => { setDiscountType("percentage"); setSelectedPresetId(null); }}
              >
                Percentage (%)
              </button>
              <button
                className="flex-1 py-2.5 text-sm font-semibold transition-colors"
                style={
                  discountType === "fixed"
                    ? { backgroundColor: 'var(--accent-color)', color: 'white' }
                    : { color: 'var(--muted-fg)' }
                }
                onClick={() => { setDiscountType("fixed"); setSelectedPresetId(null); }}
              >
                Fixed Amount
              </button>
            </div>
          </div>

          {/* Value input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-fg)' }}>
              {discountType === "percentage" ? "Percentage" : "Amount (in pesos)"}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max={discountType === "percentage" ? 100 : undefined}
                step={discountType === "percentage" ? 1 : 0.01}
                value={value}
                onChange={(e) => { setValue(e.target.value); setSelectedPresetId(null); }}
                placeholder={discountType === "percentage" ? "e.g. 10" : "e.g. 50"}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--muted)',
                  color: 'var(--fg)',
                  border: '1px solid var(--border-color)',
                }}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted-fg)' }}>
                {discountType === "percentage" ? "%" : "PHP"}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-fg)' }}>
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => { setReason(e.target.value); setSelectedPresetId(null); }}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-colors appearance-none"
              style={{
                backgroundColor: 'var(--muted)',
                color: 'var(--fg)',
                border: '1px solid var(--border-color)',
              }}
            >
              {DISCOUNT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {reason === "Custom" && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter custom reason"
                className="w-full mt-2 px-4 py-3 rounded-2xl text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--muted)',
                  color: 'var(--fg)',
                  border: '1px solid var(--border-color)',
                }}
              />
            )}
          </div>

          {/* Live preview */}
          {numericValue > 0 && (
            <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border-color)' }}>
              <div className="flex justify-between text-sm" style={{ color: 'var(--fg)' }}>
                <span>Discount</span>
                <span className="text-red-400 font-semibold">
                  -{formatCurrency(cappedAmount)}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-fg)' }}>
                {discountType === "percentage"
                  ? `${numericValue}% off ${formatCurrency(orderSubtotal)}`
                  : `${formatCurrency(cappedAmount)} off ${formatCurrency(orderSubtotal)}`}
              </p>
            </div>
          )}

          {/* Warning for large discounts */}
          {needsAuth && (
            <div className="rounded-2xl px-4 py-3 bg-amber-500/10 border border-amber-500/30">
              <p className="text-xs text-amber-400 font-medium">
                Manager authorization may be required for discounts over 20% or over {formatCurrency(20000)}.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl px-4 py-3 bg-red-500/10 border border-red-500/30">
              <p className="text-xs text-red-400 font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3 shrink-0" style={{ borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 text-sm font-semibold rounded-2xl transition-colors"
            style={{ border: '1px solid var(--border-color)', color: 'var(--muted-fg)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isApplying || numericValue <= 0}
            className="flex-1 py-3 text-sm font-semibold rounded-2xl transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
          >
            {isApplying ? "Applying..." : "Apply Discount"}
          </button>
        </div>
      </div>
    </div>
  );
}
