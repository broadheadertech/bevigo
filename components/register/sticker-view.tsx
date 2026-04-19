"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { receiptPrinter } from "@/lib/receipt-printer";
import { bluetoothPrinter } from "@/lib/bluetooth-thermal-printer";
import { niimbotPrinter } from "@/lib/niimbot-printer";
import { useState } from "react";

type StickerData = {
  orderNumber: string;
  completedAt: number;
  locationName: string;
  baristaName: string;
  tableName?: string;
  customerName?: string;
  customerLabel?: string; // order-level universal name
  items: Array<{
    name: string;
    quantity: number;
    customerLabel?: string;
    modifiers: Array<{ name: string; priceAdj: number }>;
  }>;
};

type StickerViewProps = {
  orderId: Id<"orders">;
  token: string;
  onClose: () => void;
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Expand each item by its quantity → one sticker per cup.
// Priority: line override → order universal label → linked customer name → table.
function expandStickers(data: StickerData) {
  const out: Array<{
    orderNumber: string;
    completedAt: number;
    customerLabel?: string;
    orderLabel?: string;
    customerName?: string;
    tableName?: string;
    name: string;
    indexLabel: string;
    modifiers: Array<{ name: string }>;
  }> = [];
  let totalCups = 0;
  for (const item of data.items) totalCups += item.quantity;
  let counter = 0;
  for (const item of data.items) {
    for (let i = 0; i < item.quantity; i++) {
      counter++;
      out.push({
        orderNumber: data.orderNumber,
        completedAt: data.completedAt,
        customerLabel: item.customerLabel,
        orderLabel: data.customerLabel,
        customerName: data.customerName,
        tableName: data.tableName,
        name: item.name,
        indexLabel: `${counter}/${totalCups}`,
        modifiers: item.modifiers.map((m) => ({ name: m.name })),
      });
    }
  }
  return out;
}

function pickName(s: {
  customerLabel?: string;
  orderLabel?: string;
  customerName?: string;
  tableName?: string;
}): string | undefined {
  return s.customerLabel ?? s.orderLabel ?? s.customerName ?? s.tableName ?? undefined;
}

export function StickerView({ orderId, token, onClose }: StickerViewProps) {
  const data = useQuery(api.orders.queries.getReceipt, { token, orderId }) as
    | StickerData
    | null
    | undefined;

  const [thermalStatus, setThermalStatus] = useState<string | null>(null);
  const [thermalError, setThermalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (data === undefined) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div
          className="rounded-2xl p-8 text-center"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
        >
          <p style={{ color: "var(--muted-fg)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div
          className="rounded-2xl p-8 text-center"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
        >
          <p className="text-red-400 text-sm">Order not found</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 text-sm font-medium"
            style={{ color: "var(--fg)" }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const stickers = expandStickers(data);

  const handlePrintBrowser = () => {
    window.print();
  };

  const handlePrintThermal = async () => {
    setBusy(true);
    setThermalError(null);
    setThermalStatus("Sending via USB serial…");
    try {
      if (!receiptPrinter.isConnected()) {
        const ok = await receiptPrinter.connect();
        if (!ok) throw new Error("Could not connect to printer");
      }
      await receiptPrinter.printStickers(
        stickers.map((s) => ({
          orderNumber: s.orderNumber,
          name: s.name,
          indexLabel: s.indexLabel,
          customerName: pickName(s),
          tableName: s.tableName,
          modifiers: s.modifiers,
          time: new Date(s.completedAt).toLocaleString(),
        }))
      );
      setThermalStatus(`Sent ${stickers.length} sticker${stickers.length === 1 ? "" : "s"}`);
    } catch (err) {
      setThermalError(err instanceof Error ? err.message : "Print failed");
      setThermalStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const handlePrintVozy = async () => {
    setBusy(true);
    setThermalError(null);
    setThermalStatus("Sending to Vozy (Bluetooth)…");
    try {
      if (!bluetoothPrinter.isConnected()) {
        await bluetoothPrinter.connect();
      }
      await bluetoothPrinter.printStickers(
        stickers.map((s) => ({
          orderNumber: s.orderNumber,
          name: s.name,
          indexLabel: s.indexLabel,
          customerName: pickName(s),
          tableName: s.tableName,
          modifiers: s.modifiers,
          time: new Date(s.completedAt).toLocaleString(),
        }))
      );
      setThermalStatus(`Sent ${stickers.length} sticker${stickers.length === 1 ? "" : "s"} to Vozy`);
    } catch (err) {
      setThermalError(err instanceof Error ? err.message : "Vozy print failed");
      setThermalStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const handlePrintNiimbot = async () => {
    setBusy(true);
    setThermalError(null);
    setThermalStatus("Sending to Niimbot…");
    try {
      if (!niimbotPrinter.isConnected()) {
        await niimbotPrinter.connect();
      }
      // Read label config saved on the Bluetooth Printers settings page
      let labelConfig: { labelWidthMm?: number; labelHeightMm?: number; density?: number } = {};
      try {
        const raw = localStorage.getItem("bevigo:niimbot:label");
        if (raw) {
          const parsed = JSON.parse(raw);
          labelConfig = {
            labelWidthMm: parsed.widthMm,
            labelHeightMm: parsed.heightMm,
            density: parsed.density,
          };
        }
      } catch {
        // ignore
      }
      await niimbotPrinter.printStickers(
        stickers.map((s) => ({
          orderNumber: s.orderNumber,
          itemName: s.name,
          indexLabel: s.indexLabel,
          modifiers: s.modifiers.map((m) => m.name),
          customerOrTable: pickName(s) ?? "",
          time: new Date(s.completedAt).toLocaleString(),
        })),
        labelConfig
      );
      setThermalStatus(`Sent ${stickers.length} sticker${stickers.length === 1 ? "" : "s"} to Niimbot`);
    } catch (err) {
      setThermalError(err instanceof Error ? err.message : "Niimbot print failed");
      setThermalStatus(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:p-0 print:bg-white print:block print:items-start">
      <div
        className="print-sticker-host rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden print:max-h-none print:block"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        {/* Header (hidden in print) */}
        <div
          className="px-6 py-4 flex items-center justify-between shrink-0 print:hidden"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--fg)" }}>
              Stickers
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
              {stickers.length} sticker{stickers.length === 1 ? "" : "s"} · {data.orderNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ color: "var(--muted-fg)" }}
          >
            &#10005;
          </button>
        </div>

        {/* Sticker preview list (also what prints) — scrolls inside modal */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 print:p-0 space-y-2 print:space-y-0 print:overflow-visible">
          {stickers.map((s, i) => {
            const name = pickName(s);
            return (
              <div
                key={i}
                className="print-sticker rounded-xl px-4 py-3 print:rounded-none print:m-0"
                style={{
                  backgroundColor: "white",
                  color: "black",
                  border: "1px dashed #ccc",
                }}
              >
                {/* Name dominant — Starbucks-style. Falls back to order# when no name. */}
                {name ? (
                  <>
                    <div className="text-3xl font-extrabold leading-none uppercase">
                      {name}
                    </div>
                    <div className="text-base font-semibold leading-tight mt-1">
                      {s.name}
                    </div>
                  </>
                ) : (
                  <div className="text-base font-bold leading-tight">
                    {s.name}
                  </div>
                )}
                {s.modifiers.length > 0 && (
                  <div className="text-[11px] mt-1 leading-snug">
                    {s.modifiers.map((m, mi) => (
                      <div key={mi}>+ {m.name}</div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] mt-2 opacity-60">
                  <span>
                    {s.orderNumber} &middot; {s.indexLabel}
                  </span>
                  <span>{formatTime(data.completedAt)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status (hidden in print) */}
        {(thermalStatus || thermalError) && (
          <div className="px-6 pb-2 print:hidden">
            {thermalStatus && (
              <p className="text-xs text-center p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                {thermalStatus}
              </p>
            )}
            {thermalError && (
              <p className="text-xs text-center p-2 rounded-xl bg-red-500/10 text-red-400">
                {thermalError}
              </p>
            )}
          </div>
        )}

        {/* Actions (hidden in print) */}
        <div
          className="px-6 py-4 flex flex-wrap gap-2 print:hidden"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-2xl text-sm font-medium"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            Close
          </button>
          <button
            onClick={handlePrintBrowser}
            disabled={busy}
            className="px-4 py-2.5 rounded-2xl text-sm font-medium"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            Browser
          </button>
          <button
            onClick={handlePrintThermal}
            disabled={busy}
            className="px-4 py-2.5 rounded-2xl text-sm font-medium"
            style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
          >
            USB Thermal
          </button>
          <button
            onClick={handlePrintVozy}
            disabled={busy}
            className="px-4 py-2.5 rounded-2xl text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            Vozy (BT)
          </button>
          <button
            onClick={handlePrintNiimbot}
            disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-bold text-white"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            Niimbot (BT)
          </button>
        </div>
      </div>
    </div>
  );
}
