"use client";

import { useState, useCallback } from "react";
import { useSyncExternalStore } from "react";
import { receiptPrinter } from "@/lib/receipt-printer";

// External store for printer connection status
let printerConnected = false;
const statusListeners = new Set<() => void>();

function getConnectionSnapshot(): boolean {
  return printerConnected;
}

function getServerConnectionSnapshot(): boolean {
  return false;
}

function setPrinterConnected(val: boolean): void {
  printerConnected = val;
  for (const listener of statusListeners) {
    listener();
  }
}

function subscribeConnection(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

// External store for auto-print setting
let autoPrintEnabled = false;
const autoPrintListeners = new Set<() => void>();

function getAutoPrintSnapshot(): boolean {
  return autoPrintEnabled;
}

function getServerAutoPrintSnapshot(): boolean {
  return false;
}

export function setAutoPrint(val: boolean): void {
  autoPrintEnabled = val;
  for (const listener of autoPrintListeners) {
    listener();
  }
}

function subscribeAutoPrint(listener: () => void): () => void {
  autoPrintListeners.add(listener);
  return () => {
    autoPrintListeners.delete(listener);
  };
}

export function useAutoPrint(): boolean {
  return useSyncExternalStore(subscribeAutoPrint, getAutoPrintSnapshot, getServerAutoPrintSnapshot);
}

export function usePrinterConnected(): boolean {
  return useSyncExternalStore(subscribeConnection, getConnectionSnapshot, getServerConnectionSnapshot);
}

export function PrinterSettings() {
  const connected = usePrinterConnected();
  const autoPrint = useAutoPrint();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const ok = await receiptPrinter.connect();
      setPrinterConnected(ok);
      if (!ok) {
        setError("Failed to connect to printer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setPrinterConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    await receiptPrinter.disconnect();
    setPrinterConnected(false);
  }, []);

  const handleTestPrint = useCallback(async () => {
    setIsTesting(true);
    setError(null);
    try {
      await receiptPrinter.printTest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test print failed");
      setPrinterConnected(receiptPrinter.isConnected());
    } finally {
      setIsTesting(false);
    }
  }, []);

  const handleToggleAutoPrint = useCallback(() => {
    setAutoPrint(!autoPrint);
  }, [autoPrint]);

  if (!showPanel) {
    return (
      <button
        type="button"
        onClick={() => setShowPanel(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
        title="Printer settings"
      >
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            connected ? "bg-green-500" : "bg-stone-300"
          }`}
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-stone-600"
        >
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute top-12 right-4 z-40 w-72 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700/60 shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Printer</h3>
        <button
          type="button"
          onClick={() => setShowPanel(false)}
          className="text-stone-400 hover:text-stone-600 text-lg leading-none"
        >
          &#10005;
        </button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            connected ? "bg-green-500" : "bg-stone-300"
          }`}
        />
        <span className="text-sm text-stone-600 dark:text-stone-400">
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* Connect / Disconnect */}
      <div className="flex gap-2 mb-3">
        {connected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            className="flex-1 px-3 py-2 text-xs font-medium border border-stone-200 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-stone-700"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex-1 px-3 py-2 text-xs font-medium bg-stone-900 text-white rounded-xl hover:bg-stone-800 disabled:opacity-50 transition-colors"
          >
            {isConnecting ? "Connecting..." : "Connect Printer"}
          </button>
        )}
      </div>

      {/* Test Print */}
      {connected && (
        <button
          type="button"
          onClick={handleTestPrint}
          disabled={isTesting}
          className="w-full mb-3 px-3 py-2 text-xs font-medium border border-stone-200 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50 transition-colors text-stone-700"
        >
          {isTesting ? "Printing..." : "Test Print"}
        </button>
      )}

      {/* Auto-print toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="autoPrint"
          checked={autoPrint}
          onChange={handleToggleAutoPrint}
          className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500/20"
        />
        <label htmlFor="autoPrint" className="text-xs text-stone-700">
          Auto-print on order completion
        </label>
      </div>
    </div>
  );
}
