"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { bluetoothPrinter } from "@/lib/bluetooth-thermal-printer";
import { niimbotPrinter } from "@/lib/niimbot-printer";

const NIIMBOT_KEY = "bevigo:niimbot:label";

type LabelDims = {
  widthMm: number;
  heightMm: number;
  density: number;
  textScale: number;
  gapMm: number;
};

const DEFAULT_LABEL: LabelDims = {
  widthMm: 30,
  heightMm: 15,
  density: 3,
  textScale: 1,
  gapMm: 2,
};

export default function BluetoothPrintersPage() {
  const { session, token } = useAuth();

  const [vozyName, setVozyName] = useState<string | null>(null);
  const [vozyMsg, setVozyMsg] = useState<string | null>(null);
  const [vozyErr, setVozyErr] = useState<string | null>(null);
  const [vozyBusy, setVozyBusy] = useState(false);

  const [niimName, setNiimName] = useState<string | null>(null);
  const [niimMsg, setNiimMsg] = useState<string | null>(null);
  const [niimErr, setNiimErr] = useState<string | null>(null);
  const [niimBusy, setNiimBusy] = useState(false);

  const [label, setLabel] = useState<LabelDims>(DEFAULT_LABEL);
  const [browserSupported, setBrowserSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setBrowserSupported(
      typeof navigator !== "undefined" && "bluetooth" in navigator
    );
    setVozyName(bluetoothPrinter.getDeviceName());
    setNiimName(niimbotPrinter.getDeviceName());

    const raw = localStorage.getItem(NIIMBOT_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed.widthMm === "number" &&
          typeof parsed.heightMm === "number" &&
          typeof parsed.density === "number"
        ) {
          setLabel({
            widthMm: parsed.widthMm,
            heightMm: parsed.heightMm,
            density: parsed.density,
            textScale: typeof parsed.textScale === "number" ? parsed.textScale : 1,
            gapMm: typeof parsed.gapMm === "number" ? parsed.gapMm : 2,
          });
        }
      } catch {
        // ignore parse error
      }
    }
  }, []);

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>Loading...</p>
      </div>
    );
  }

  const saveLabel = (next: LabelDims) => {
    setLabel(next);
    localStorage.setItem(NIIMBOT_KEY, JSON.stringify(next));
  };

  const handleVozyPair = async () => {
    setVozyBusy(true);
    setVozyErr(null);
    setVozyMsg(null);
    try {
      const info = await bluetoothPrinter.connect();
      setVozyName(info.name);
      setVozyMsg(`Paired with ${info.name}`);
    } catch (err) {
      setVozyErr(err instanceof Error ? err.message : "Pairing failed");
    } finally {
      setVozyBusy(false);
    }
  };

  const handleVozyTest = async () => {
    setVozyBusy(true);
    setVozyErr(null);
    setVozyMsg(null);
    try {
      if (!bluetoothPrinter.isConnected()) {
        const info = await bluetoothPrinter.connect();
        setVozyName(info.name);
      }
      await bluetoothPrinter.printTest();
      setVozyMsg("Test sent — check the printer");
    } catch (err) {
      setVozyErr(err instanceof Error ? err.message : "Test failed");
    } finally {
      setVozyBusy(false);
    }
  };

  const handleVozyDisconnect = async () => {
    await bluetoothPrinter.disconnect();
    setVozyName(null);
    setVozyMsg("Disconnected");
  };

  const handleNiimPair = async () => {
    setNiimBusy(true);
    setNiimErr(null);
    setNiimMsg(null);
    try {
      const info = await niimbotPrinter.connect();
      setNiimName(info.name);
      setNiimMsg(`Paired with ${info.name}`);
    } catch (err) {
      setNiimErr(err instanceof Error ? err.message : "Pairing failed");
    } finally {
      setNiimBusy(false);
    }
  };

  const handleNiimTest = async () => {
    setNiimBusy(true);
    setNiimErr(null);
    setNiimMsg(null);
    try {
      if (!niimbotPrinter.isConnected()) {
        const info = await niimbotPrinter.connect();
        setNiimName(info.name);
      }
      await niimbotPrinter.printTest({
        labelWidthMm: label.widthMm,
        labelHeightMm: label.heightMm,
        density: label.density,
        textScale: label.textScale,
        printTask: "B1",
      });
      setNiimMsg("Test sticker sent — check the printer");
    } catch (err) {
      setNiimErr(err instanceof Error ? err.message : "Test failed");
    } finally {
      setNiimBusy(false);
    }
  };

  const handleNiimDisconnect = async () => {
    await niimbotPrinter.disconnect();
    setNiimName(null);
    setNiimMsg("Disconnected");
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-lg md:text-xl font-bold" style={{ color: "var(--fg)" }}>
          Bluetooth Printers
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
          Pair Vozy and Niimbot printers over Bluetooth (Web Bluetooth)
        </p>
      </div>

      {browserSupported === false && (
        <div className="rounded-2xl p-4 mb-6 bg-red-500/10 text-red-400 text-sm">
          Web Bluetooth is not available in this browser. Use Chrome on Android (or
          desktop Chrome/Edge). It is not supported on iOS Safari.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
        {/* Vozy card */}
        <PrinterCard
          title="Vozy (Receipts / ESC/POS)"
          description="Receipt printer using ESC/POS over Bluetooth Low Energy. Used for receipts and basic text stickers."
          status={
            vozyName
              ? bluetoothPrinter.isConnected()
                ? `Connected: ${vozyName}`
                : `Last paired: ${vozyName}`
              : "Not paired"
          }
          isPaired={!!vozyName}
          isConnected={bluetoothPrinter.isConnected()}
          message={vozyMsg}
          error={vozyErr}
          busy={vozyBusy}
          onPair={handleVozyPair}
          onTest={handleVozyTest}
          onDisconnect={handleVozyDisconnect}
        />

        {/* Niimbot card */}
        <PrinterCard
          title="Niimbot B1 (Sticker labels)"
          description="Bluetooth label printer with proprietary protocol. Renders each sticker as an image and sends it via the B1 print task."
          status={
            niimName
              ? niimbotPrinter.isConnected()
                ? `Connected: ${niimName}`
                : `Last paired: ${niimName}`
              : "Not paired"
          }
          isPaired={!!niimName}
          isConnected={niimbotPrinter.isConnected()}
          message={niimMsg}
          error={niimErr}
          busy={niimBusy}
          onPair={handleNiimPair}
          onTest={handleNiimTest}
          onDisconnect={handleNiimDisconnect}
        >
          <div className="mt-4 pt-4 space-y-3" style={{ borderTop: "1px solid var(--border-color)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
              Label Settings
            </p>
            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label="Width (mm)"
                value={label.widthMm}
                onChange={(n) => saveLabel({ ...label, widthMm: n })}
                min={10}
                max={80}
              />
              <NumberField
                label="Height (mm)"
                value={label.heightMm}
                onChange={(n) => saveLabel({ ...label, heightMm: n })}
                min={6}
                max={80}
              />
              <NumberField
                label="Gap (mm)"
                value={label.gapMm}
                onChange={(n) => saveLabel({ ...label, gapMm: n })}
                min={0}
                max={10}
                step={0.5}
              />
              <NumberField
                label="Density (1-5)"
                value={label.density}
                onChange={(n) => saveLabel({ ...label, density: n })}
                min={1}
                max={5}
              />
              <NumberField
                label="Text scale"
                value={label.textScale}
                onChange={(n) => saveLabel({ ...label, textScale: n })}
                min={0.7}
                max={2}
                step={0.1}
              />
            </div>
            <div className="rounded-xl p-3 text-xs space-y-1.5" style={{ backgroundColor: "var(--muted)", color: "var(--muted-fg)" }}>
              <p>
                <strong style={{ color: "var(--fg)" }}>Height = sticker face only</strong> — measure the printable
                face of one label, NOT including the gap to the next sticker.
              </p>
              <p>
                <strong style={{ color: "var(--fg)" }}>Gap (mm)</strong> is informational. The B1 uses its
                gap sensor to advance between labels automatically. If your prints overlap the gap, your
                <em> Height</em> is too large; if there&apos;s a big blank area, it&apos;s too small.
              </p>
              <p>
                <strong style={{ color: "var(--fg)" }}>Text scale</strong> bumps every text size on the
                sticker. Try 1.2–1.5 if names look too small. Saved per device.
              </p>
            </div>
          </div>
        </PrinterCard>
      </div>

      <div className="mt-8 max-w-2xl text-sm" style={{ color: "var(--muted-fg)" }}>
        <p className="font-semibold mb-1" style={{ color: "var(--fg)" }}>
          How pairing works
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Click <strong>Pair</strong> — your tablet&apos;s native Bluetooth picker will open.</li>
          <li>Select your printer from the list.</li>
          <li>Click <strong>Test print</strong> to verify the connection.</li>
          <li>The browser remembers paired devices for next time, but you may have to reconnect after restarting the browser.</li>
        </ol>
      </div>
    </div>
  );
}

function PrinterCard({
  title,
  description,
  status,
  isPaired,
  isConnected,
  message,
  error,
  busy,
  onPair,
  onTest,
  onDisconnect,
  children,
}: {
  title: string;
  description: string;
  status: string;
  isPaired: boolean;
  isConnected: boolean;
  message: string | null;
  error: string | null;
  busy: boolean;
  onPair: () => void;
  onTest: () => void;
  onDisconnect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-5 shadow-lg"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
    >
      <h2 className="text-base font-bold" style={{ color: "var(--fg)" }}>
        {title}
      </h2>
      <p className="text-xs mt-1 mb-3" style={{ color: "var(--muted-fg)" }}>
        {description}
      </p>

      <div className="flex items-center gap-2 mb-4">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isConnected
              ? "bg-emerald-500/15 text-emerald-400"
              : isPaired
              ? "bg-amber-500/15 text-amber-400"
              : "bg-stone-500/15"
          }`}
          style={!isPaired ? { color: "var(--muted-fg)" } : undefined}
        >
          {status}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onPair}
          disabled={busy}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          {busy ? "Working..." : isPaired ? "Re-pair" : "Pair"}
        </button>
        <button
          onClick={onTest}
          disabled={busy}
          className="px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ border: "1px solid var(--border-color)", color: "var(--fg)" }}
        >
          Test print
        </button>
        {isPaired && (
          <button
            onClick={onDisconnect}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-400"
          >
            Disconnect
          </button>
        )}
      </div>

      {message && (
        <p className="mt-3 text-xs p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 text-xs p-2 rounded-xl bg-red-500/10 text-red-400">
          {error}
        </p>
      )}

      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted-fg)" }}>
        {label}
      </label>
      <input
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-full rounded-xl px-2 py-2 text-sm font-mono text-right"
        style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
      />
    </div>
  );
}
