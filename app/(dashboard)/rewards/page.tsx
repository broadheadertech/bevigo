"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useCallback } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { RewardForm } from "@/components/rewards/reward-form";

type Reward = {
  _id: Id<"rewards">;
  name: string;
  description?: string;
  pointsCost: number;
  category: "drink" | "food" | "merch" | "discount";
  discountAmount?: number;
  maxValue?: number;
  status: "active" | "inactive";
  sortOrder: number;
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  drink: { bg: "rgba(59, 130, 246, 0.15)", text: "rgb(59, 130, 246)" },
  food: { bg: "rgba(234, 179, 8, 0.15)", text: "rgb(180, 140, 10)" },
  merch: { bg: "rgba(168, 85, 247, 0.15)", text: "rgb(168, 85, 247)" },
  discount: { bg: "rgba(34, 197, 94, 0.15)", text: "rgb(34, 197, 94)" },
};

export default function RewardsPage() {
  const { token } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);

  const rewards = useQuery(
    api.rewards.queries.listAllRewards,
    token ? { token } : "skip"
  ) as Reward[] | undefined;

  const settings = useQuery(
    api.settings.queries.getSettings,
    token ? { token } : "skip"
  );

  const updateReward = useMutation(api.rewards.mutations.updateReward);
  const updateEarnRate = useMutation(api.settings.mutations.updatePointsEarnRate);

  const [earnRateInput, setEarnRateInput] = useState("");

  // Sync earn rate input with fetched settings
  const currentEarnRate = (settings as Record<string, unknown> | undefined)?.pointsEarnRate as number | undefined;
  const earnRateDisplay = earnRateInput || (currentEarnRate ? String(currentEarnRate / 100) : "10");

  const handleSaveEarnRate = useCallback(async () => {
    if (!token) return;
    const valueInPesos = parseFloat(earnRateInput || earnRateDisplay);
    if (isNaN(valueInPesos) || valueInPesos < 1) {
      alert("Enter a valid amount (minimum 1)");
      return;
    }
    try {
      await updateEarnRate({ token, pointsEarnRate: Math.round(valueInPesos * 100) });
      setEarnRateInput("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    }
  }, [token, earnRateInput, earnRateDisplay, updateEarnRate]);

  const handleToggleStatus = useCallback(
    async (reward: Reward) => {
      if (!token) return;
      try {
        await updateReward({
          token,
          rewardId: reward._id,
          status: reward.status === "active" ? "inactive" : "active",
        });
      } catch (err) {
        console.error("Failed to toggle reward:", err);
      }
    },
    [token, updateReward]
  );

  const handleEdit = useCallback((reward: Reward) => {
    setEditingReward(reward);
    setShowForm(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditingReward(null);
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
            Rewards
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-fg)" }}>
            Manage your points rewards catalog
          </p>
        </div>
        <button
          onClick={() => {
            setEditingReward(null);
            setShowForm(true);
          }}
          className="px-4 py-2.5 text-white text-sm font-medium rounded-xl transition-colors"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          + Add Reward
        </button>
      </div>

      {/* Points Settings */}
      <div
        className="rounded-2xl shadow-lg p-5 mb-6"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>
          Points Settings
        </h2>
        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label
              className="block text-xs font-medium mb-1"
              style={{ color: "var(--muted-fg)" }}
            >
              Earn Rate: 1 point per
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: "var(--fg)" }}>
                P
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={earnRateInput || earnRateDisplay}
                onChange={(e) => setEarnRateInput(e.target.value)}
                className="w-24 px-3 py-2 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: "var(--muted)",
                  color: "var(--fg)",
                  border: "1px solid var(--border-color)",
                }}
              />
              <span className="text-sm" style={{ color: "var(--muted-fg)" }}>
                spent
              </span>
            </div>
          </div>
          <button
            onClick={handleSaveEarnRate}
            className="px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Rewards Catalog */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(rewards ?? []).map((reward: Reward) => {
          const catColor = CATEGORY_COLORS[reward.category] ?? CATEGORY_COLORS.drink;
          return (
            <div
              key={reward._id}
              className="rounded-2xl shadow-lg p-5 flex flex-col justify-between"
              style={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border-color)",
                opacity: reward.status === "inactive" ? 0.5 : 1,
              }}
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3
                    className="font-semibold text-sm"
                    style={{ color: "var(--fg)" }}
                  >
                    {reward.name}
                  </h3>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: catColor.bg,
                      color: catColor.text,
                    }}
                  >
                    {reward.category}
                  </span>
                </div>
                {reward.description && (
                  <p
                    className="text-xs mb-3"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    {reward.description}
                  </p>
                )}
                <div className="flex items-center gap-1 mb-3">
                  <span
                    className="text-lg font-bold"
                    style={{ color: "var(--accent-color)" }}
                  >
                    {reward.pointsCost}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--muted-fg)" }}
                  >
                    pts
                  </span>
                </div>
                {reward.status === "inactive" && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full mb-2 inline-block"
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                      color: "rgb(239, 68, 68)",
                    }}
                  >
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleEdit(reward)}
                  className="text-xs font-medium px-3 py-1.5 rounded-xl transition-colors"
                  style={{
                    backgroundColor: "var(--muted)",
                    color: "var(--fg)",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggleStatus(reward)}
                  className="text-xs font-medium px-3 py-1.5 rounded-xl transition-colors"
                  style={{
                    backgroundColor: reward.status === "active"
                      ? "rgba(239, 68, 68, 0.1)"
                      : "rgba(34, 197, 94, 0.1)",
                    color: reward.status === "active"
                      ? "rgb(239, 68, 68)"
                      : "rgb(34, 197, 94)",
                  }}
                >
                  {reward.status === "active" ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {(rewards ?? []).length === 0 && (
        <div
          className="rounded-2xl shadow-lg p-12 text-center"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            No rewards yet. Add your first reward to get started.
          </p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <RewardForm
          reward={editingReward}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
