"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

type BarcodeScannerOptions = {
  onScan: (barcode: string) => void;
  maxKeystrokeGap?: number;
  minLength?: number;
};

let lastScannedBarcode: string | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): string | null {
  return lastScannedBarcode;
}

function getServerSnapshot(): string | null {
  return null;
}

function setLastScannedBarcode(barcode: string | null): void {
  lastScannedBarcode = barcode;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useBarcodeScanner(options: BarcodeScannerOptions): {
  lastScannedBarcode: string | null;
  clearLastScan: () => void;
} {
  const { onScan, maxKeystrokeGap = 100, minLength = 3 } = options;
  const onScanRef = useRef(onScan);
  const maxGapRef = useRef(maxKeystrokeGap);
  const minLenRef = useRef(minLength);

  // Keep refs up to date via useEffect (not during render)
  useEffect(() => {
    onScanRef.current = onScan;
    maxGapRef.current = maxKeystrokeGap;
    minLenRef.current = minLength;
  });

  useEffect(() => {
    let buffer = "";
    let lastKeystroke = 0;

    const handleKeydown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const now = Date.now();
      if (now - lastKeystroke > maxGapRef.current && buffer.length > 0) {
        buffer = "";
      }
      lastKeystroke = now;

      if (e.key === "Enter") {
        const barcode = buffer.trim();
        buffer = "";
        if (barcode.length >= minLenRef.current) {
          e.preventDefault();
          setLastScannedBarcode(barcode);
          onScanRef.current(barcode);
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const scannedBarcode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const clearLastScan = useCallback(() => {
    setLastScannedBarcode(null);
  }, []);

  return { lastScannedBarcode: scannedBarcode, clearLastScan };
}
