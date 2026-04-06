"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { useState, useCallback } from "react";
import { Id } from "../../convex/_generated/dataModel";

type Reward = {
  _id: Id<"rewards">;
  name: string;
  description?: string;
  pointsCost: number;
  category: "drink" | "food" | "merch" | "discount";
};

type RedeemPointsDialogProps = {
  customerId: Id<"customers">;
  customerName: string;
  pointsBalance: number;
  onClose: () => void;
  onRedeemed: (rewardName: string) => void;
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  drink: { bg: "rgba(59, 130, 246, 0.15)", text: "rgb(59, 130, 246)" },
  food: { bg: "rgba(234, 179, 8, 0.15)", text: "rgb(180, 140, 10)" },
  merch: { bg: "rgba(168, 85, 247, 0.15)", text: "rgb(168, 85, 247)" },
  discount: { bg: "rgba(34, 197, 94, 0.15)", text: "rgb(34, 197, 94)" },
};

export function RedeemPointsDialog({
  customerId,
  customerName,
  pointsBalance,
  onClose,
  onRedeemed,
}: RedeemPointsDialogProps) {
  const { token } = useAuth();
  const [redeeming, setRedeeming] = useState(false);
  const [confirmReward, setConfirmReward] = useState<Reward | null>(null);

  const rewards = useQuery(
    api.rewards.queries.listRewards,
    token ? { token } : "skip"
  ) as Reward[] | undefined;

  const redeemReward = useMutation(api.points.mutations.redeemReward);

  const handleRedeem = useCallback(async () => {
    if (!token || !confirmReward) return;
    setRedeeming(true);
    try {
      const result = await redeemReward({
        token,
        customerId,
        rewardId: confirmReward._id,
      });
      onRedeemed((result as { rewardName: string }).rewardName);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to redeem");
    } finally {
      setRedeeming(false);
      setConfirmReward(null);
    }
  }, [token, confirmReward, customerId, redeemReward, onRedeemed]);

  const affordableRewards = (rewards ?? []).filter(
    (r: Reward) => r.pointsCost <= pointsBalance
  );

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
        className="relative rounded-3xl shadow-lg w-full max-w-sm mx-4 max-h-[80vh] flex flex-col"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold" style={{ color: "var(--fg)" }}>
              Redeem Points
            </h2>
            <button onClick={onClose} className="p-1" style={{ color: "var(--muted-fg)" }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--muted-fg)" }}>
            {customerName}
          </p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold" style={{ color: "var(--accent-color)" }}>
              {pointsBalance}
            </span>
            <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
              pts available
            </span>
          </div>
        </div>

        {/* Confirmation overlay */}
        {confirmReward ? (
          <div className="p-5 flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium mb-1" style={{ color: "var(--fg)" }}>
              Redeem {confirmReward.name}?
            </p>
            <p className="text-xs mb-4" style={{ color: "var(--muted-fg)" }}>
              This will deduct {confirmReward.pointsCost} points from {customerName}.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRedeem}
                disabled={redeeming}
                className="px-5 py-2 text-white text-sm font-medium rounded-xl disabled:opacity-50"
                style={{ backgroundColor: "var(--accent-color)" }}
              >
                {redeeming ? "Redeeming..." : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmReward(null)}
                className="px-5 py-2 text-sm font-medium rounded-xl"
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3">
            {affordableRewards.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
                  {(rewards ?? []).length === 0
                    ? "No rewards available yet."
                    : "Not enough points for any reward."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {affordableRewards.map((reward: Reward) => {
                  const catColor = CATEGORY_COLORS[reward.category] ?? CATEGORY_COLORS.drink;
                  return (
                    <button
                      key={reward._id}
                      onClick={() => setConfirmReward(reward)}
                      className="w-full text-left rounded-2xl p-3 transition-colors"
                      style={{
                        backgroundColor: "var(--muted)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: "var(--fg)" }}>
                              {reward.name}
                            </span>
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: catColor.bg, color: catColor.text }}
                            >
                              {reward.category}
                            </span>
                          </div>
                          {reward.description && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted-fg)" }}>
                              {reward.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-3">
                          <span className="text-sm font-bold" style={{ color: "var(--accent-color)" }}>
                            {reward.pointsCost}
                          </span>
                          <span className="text-[10px] ml-0.5" style={{ color: "var(--muted-fg)" }}>
                            pts
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Show unaffordable rewards greyed out */}
            {(rewards ?? []).filter((r: Reward) => r.pointsCost > pointsBalance).length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-wide font-medium mb-2 px-1" style={{ color: "var(--muted-fg)" }}>
                  Need more points
                </p>
                {(rewards ?? [])
                  .filter((r: Reward) => r.pointsCost > pointsBalance)
                  .map((reward: Reward) => (
                    <div
                      key={reward._id}
                      className="w-full text-left rounded-2xl p-3 mb-2 opacity-40"
                      style={{
                        backgroundColor: "var(--muted)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm" style={{ color: "var(--fg)" }}>
                          {reward.name}
                        </span>
                        <span className="text-sm font-bold" style={{ color: "var(--muted-fg)" }}>
                          {reward.pointsCost} pts
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
