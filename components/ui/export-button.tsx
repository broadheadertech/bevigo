"use client";

import { useState } from "react";
import { useConvex } from "convex/react";
import { useAuth } from "@/lib/auth-context";
import { downloadCsv } from "@/lib/csv-export";

type AnyQueryRef = Parameters<ReturnType<typeof useConvex>["query"]>[0];

type ExportButtonProps = {
  /** A reference to the Convex query that returns the export rows. */
  queryRef: AnyQueryRef;
  /** Becomes "<filenameBase>-YYYY-MM-DD-HH-MM-SS.csv". */
  filenameBase: string;
  label?: string;
};

/**
 * Fires the export query on demand (not subscribed) so we don't pull every
 * row into the page for users who never click the button. Disabled while
 * fetching or when not signed in.
 */
export function ExportButton({
  queryRef,
  filenameBase,
  label = "Export CSV",
}: ExportButtonProps) {
  const { token } = useAuth();
  const convex = useConvex();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const rows = (await convex.query(queryRef, { token })) as Array<
        Record<string, string | number | boolean | null | undefined>
      > | null;
      if (!rows || rows.length === 0) {
        setError("Nothing to export yet.");
        setTimeout(() => setError(null), 3000);
        return;
      }
      downloadCsv(rows, filenameBase);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      setTimeout(() => setError(null), 4000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={busy || !token}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold transition-colors active:scale-95 disabled:opacity-50"
        style={{
          backgroundColor: "var(--muted)",
          color: "var(--fg)",
          border: "1px solid var(--border-color)",
        }}
        title={`Download ${filenameBase}.csv`}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
          />
        </svg>
        {busy ? "Preparing…" : label}
      </button>
      {error && (
        <span className="text-[11px] text-red-400">{error}</span>
      )}
    </div>
  );
}
