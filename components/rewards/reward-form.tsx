"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useCallback } from "react";
import { Id } from "../../convex/_generated/dataModel";

type RewardData = {
  _id: Id<"rewards">;
  name: string;
  description?: string;
  pointsCost: number;
  category: "drink" | "food" | "merch" | "discount";
  discountAmount?: number;
  maxValue?: number;
  sortOrder: number;
};

type RewardFormProps = {
  reward: RewardData | null;
  onClose: () => void;
};

export function RewardForm({ reward, onClose }: RewardFormProps) {
  const { token } = useAuth();
  const createReward = useMutation(api.rewards.mutations.createReward);
  const updateReward = useMutation(api.rewards.mutations.updateReward);

  const [name, setName] = useState(reward?.name ?? "");
  const [description, setDescription] = useState(reward?.description ?? "");
  const [pointsCost, setPointsCost] = useState(String(reward?.pointsCost ?? ""));
  const [category, setCategory] = useState<"drink" | "food" | "merch" | "discount">(
    reward?.category ?? "drink"
  );
  const [discountAmount, setDiscountAmount] = useState(
    reward?.discountAmount ? String(reward.discountAmount / 100) : ""
  );
  const [maxValue, setMaxValue] = useState(
    reward?.maxValue ? String(reward.maxValue / 100) : ""
  );
  const [sortOrder, setSortOrder] = useState(String(reward?.sortOrder ?? 0));
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!token || !name.trim() || !pointsCost) return;
    setSaving(true);

    try {
      const cost = parseInt(pointsCost, 10);
      const order = parseInt(sortOrder, 10) || 0;

      if (reward) {
        await updateReward({
          token,
          rewardId: reward._id,
          name: name.trim(),
          description: description.trim() || undefined,
          pointsCost: cost,
          category,
          discountAmount: discountAmount ? Math.round(parseFloat(discountAmount) * 100) : undefined,
          maxValue: maxValue ? Math.round(parseFloat(maxValue) * 100) : undefined,
          sortOrder: order,
        });
      } else {
        await createReward({
          token,
          name: name.trim(),
          description: description.trim() || undefined,
          pointsCost: cost,
          category,
          discountAmount: discountAmount ? Math.round(parseFloat(discountAmount) * 100) : undefined,
          maxValue: maxValue ? Math.round(parseFloat(maxValue) * 100) : undefined,
          sortOrder: order,
        });
      }
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save reward");
    } finally {
      setSaving(false);
    }
  }, [
    token, name, description, pointsCost, category,
    discountAmount, maxValue, sortOrder, reward,
    createReward, updateReward, onClose,
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
        className="relative rounded-3xl shadow-lg p-6 w-full max-w-md mx-4"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>
          {reward ? "Edit Reward" : "Add Reward"}
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
              placeholder="Free Latte"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-fg)" }}>
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            />
          </div>

          {/* Points Cost */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-fg)" }}>
              Points Cost *
            </label>
            <input
              type="number"
              min="1"
              value={pointsCost}
              onChange={(e) => setPointsCost(e.target.value)}
              placeholder="100"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-fg)" }}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            >
              <option value="drink">Drink</option>
              <option value="food">Food</option>
              <option value="merch">Merch</option>
              <option value="discount">Discount</option>
            </select>
          </div>

          {/* Conditional fields */}
          {category === "discount" && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-fg)" }}>
                Discount Amount (P)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="50.00"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: "var(--muted)",
                  color: "var(--fg)",
                  border: "1px solid var(--border-color)",
                }}
              />
            </div>
          )}

          {(category === "drink" || category === "food") && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-fg)" }}>
                Max Value (P) - for free item rewards
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                placeholder="200.00"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: "var(--muted)",
                  color: "var(--fg)",
                  border: "1px solid var(--border-color)",
                }}
              />
            </div>
          )}

          {/* Sort Order */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-fg)" }}>
              Sort Order
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !pointsCost}
            className="flex-1 px-4 py-2.5 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            {saving ? "Saving..." : reward ? "Save Changes" : "Add Reward"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium rounded-xl transition-colors"
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
