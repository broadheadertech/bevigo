"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/currency";

type CashTenderModalProps = {
  totalDue: number; // in cents
  onConfirm: (tenderedCents: number) => void;
  onCancel: () => void;
  isProcessing?: boolean;
};

const QUICK_BILLS = [10000, 20000, 50000, 100000]; // ₱100, 200, 500, 1000

function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export function CashTenderModal({
  totalDue,
  onConfirm,
  onCancel,
  isProcessing = false,
}: CashTenderModalProps) {
  const [input, setInput] = useState("");

  const tenderedCents = useMemo(() => {
    if (!input) return 0;
    const n = parseFloat(input);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }, [input]);

  const change = tenderedCents - totalDue;
  const isShort = tenderedCents > 0 && tenderedCents < totalDue;
  const canConfirm = tenderedCents >= totalDue && !isProcessing;

  const setTendered = (cents: number) => {
    setInput((cents / 100).toFixed(2));
  };

  // Build round-up suggestions: next 50, next 100 above total (skip duplicates)
  const roundUps = useMemo(() => {
    const out: number[] = [];
    const next50 = roundUpTo(totalDue, 5000);
    const next100 = roundUpTo(totalDue, 10000);
    if (next50 > totalDue) out.push(next50);
    if (next100 > totalDue && next100 !== next50) out.push(next100);
    return out;
  }, [totalDue]);

  // Filter QUICK_BILLS to only those >= totalDue
  const validBills = QUICK_BILLS.filter((b) => b >= totalDue);

  const numpadKey = (key: string) => {
    if (isProcessing) return;
    if (key === "C") {
      setInput("");
      return;
    }
    if (key === "←") {
      setInput((prev) => prev.slice(0, -1));
      return;
    }
    if (key === ".") {
      if (input.includes(".")) return;
      setInput((prev) => (prev === "" ? "0." : prev + "."));
      return;
    }
    setInput((prev) => {
      // Limit decimal places to 2
      if (prev.includes(".") && prev.split(".")[1]?.length >= 2) return prev;
      return prev + key;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
            Cash Tender
          </h2>
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ color: "var(--muted-fg)" }}
          >
            &#10005;
          </button>
        </div>

        {/* Total due */}
        <div className="px-6 py-5 text-center" style={{ backgroundColor: "var(--muted)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
            Total Due
          </p>
          <p className="text-3xl font-bold mt-1 font-mono" style={{ color: "var(--fg)" }}>
            {formatCurrency(totalDue)}
          </p>
        </div>

        {/* Tendered + change */}
        <div className="px-6 pt-5 pb-3">
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-2xl p-4 text-center"
              style={{ backgroundColor: "var(--muted)", border: "1px solid var(--border-color)" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                Tendered
              </p>
              <p className="text-2xl font-bold mt-1 font-mono" style={{ color: "var(--fg)" }}>
                {tenderedCents > 0 ? formatCurrency(tenderedCents) : "—"}
              </p>
            </div>
            <div
              className="rounded-2xl p-4 text-center"
              style={{
                backgroundColor: change >= 0 && tenderedCents > 0 ? "var(--accent-color)" : "var(--muted)",
                border: "1px solid var(--border-color)",
                color: change >= 0 && tenderedCents > 0 ? "white" : "var(--fg)",
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70">
                {isShort ? "Short by" : "Change"}
              </p>
              <p className="text-2xl font-bold mt-1 font-mono">
                {tenderedCents === 0
                  ? "—"
                  : isShort
                  ? formatCurrency(totalDue - tenderedCents)
                  : formatCurrency(change)}
              </p>
            </div>
          </div>
        </div>

        {/* Quick-tender buttons */}
        <div className="px-6 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
            Quick Tender
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setTendered(totalDue)}
              disabled={isProcessing}
              className="py-2.5 rounded-xl text-sm font-semibold"
              style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
            >
              Exact
            </button>
            {validBills.map((b) => (
              <button
                key={b}
                onClick={() => setTendered(b)}
                disabled={isProcessing}
                className="py-2.5 rounded-xl text-sm font-mono font-semibold"
                style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
              >
                {formatCurrency(b)}
              </button>
            ))}
            {roundUps.map((r) => (
              <button
                key={r}
                onClick={() => setTendered(r)}
                disabled={isProcessing}
                className="py-2.5 rounded-xl text-sm font-mono font-semibold"
                style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
              >
                {formatCurrency(r)}
              </button>
            ))}
          </div>
        </div>

        {/* Numpad */}
        <div className="px-6 pb-3">
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "←"].map((key) => (
              <button
                key={key}
                onClick={() => numpadKey(key)}
                disabled={isProcessing}
                className="py-3 rounded-xl text-lg font-semibold font-mono"
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)" }}
              >
                {key}
              </button>
            ))}
          </div>
          <button
            onClick={() => numpadKey("C")}
            disabled={isProcessing}
            className="w-full mt-2 py-2 rounded-xl text-xs font-medium"
            style={{ color: "var(--muted-fg)" }}
          >
            Clear
          </button>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex justify-end gap-3"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-5 py-3 rounded-2xl text-sm font-medium"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            Back
          </button>
          <button
            onClick={() => onConfirm(tenderedCents)}
            disabled={!canConfirm}
            className="flex-1 px-5 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            {isProcessing ? "Processing..." : "Complete Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
