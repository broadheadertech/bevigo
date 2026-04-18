"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/currency";
import { NewPeriodModal } from "@/components/payroll/new-period-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";

type PeriodRow = {
  _id: Id<"payPeriods">;
  label: string;
  startDate: number;
  endDate: number;
  status: "draft" | "finalized";
  finalizedAt?: number;
  staffCount: number;
  paidCount: number;
  totalGross: number;
  totalNet: number;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PayrollPage() {
  const router = useRouter();
  const { session, token } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Id<"payPeriods"> | null>(
    null
  );

  const periods = useQuery(
    api.payroll.queries.listPeriods,
    token ? { token } : "skip"
  ) as PeriodRow[] | undefined;

  const deletePeriod = useMutation(api.payroll.mutations.deletePeriod);

  if (!token || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>Loading...</p>
      </div>
    );
  }

  if (session.role !== "owner") {
    return (
      <div className="flex items-center justify-center h-64">
        <p style={{ color: "var(--muted-fg)" }}>
          Payroll is only available to owners.
        </p>
      </div>
    );
  }

  const list = periods ?? [];

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deletePeriod({ token, periodId: confirmDelete });
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
            Payroll
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
            Generate pay periods, review payslips, and record payouts
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2.5 text-white text-sm font-semibold rounded-xl shadow-lg"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          + New Pay Period
        </button>
      </div>

      <div
        className="rounded-3xl shadow-lg overflow-hidden overflow-x-auto"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
      >
        {periods === undefined && (
          <div className="flex items-center justify-center h-48">
            <p style={{ color: "var(--muted-fg)" }}>Loading...</p>
          </div>
        )}
        {periods !== undefined && list.length === 0 && (
          <div className="flex items-center justify-center h-48">
            <p style={{ color: "var(--muted-fg)" }}>
              No pay periods yet. Create one to get started.
            </p>
          </div>
        )}
        {list.length > 0 && (
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--muted)",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Period
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Range
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Staff
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Gross
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Net
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Status
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr
                  key={p._id}
                  className="hover:bg-stone-500/5 cursor-pointer"
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                  onClick={() => router.push(`/payroll/${p._id}`)}
                >
                  <td className="px-5 py-3.5 font-medium" style={{ color: "var(--fg)" }}>
                    {p.label}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: "var(--muted-fg)" }}>
                    {formatDate(p.startDate)} – {formatDate(p.endDate)}
                  </td>
                  <td className="px-5 py-3.5 text-right" style={{ color: "var(--muted-fg)" }}>
                    {p.paidCount}/{p.staffCount}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono" style={{ color: "var(--fg)" }}>
                    {formatCurrency(p.totalGross)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold" style={{ color: "var(--fg)" }}>
                    {formatCurrency(p.totalNet)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === "finalized"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {p.status === "finalized" ? "Finalized" : "Draft"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span
                      className="flex items-center justify-end gap-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => router.push(`/payroll/${p._id}`)}
                        className="text-xs text-amber-400 font-medium"
                      >
                        Open
                      </button>
                      {p.status === "draft" && (
                        <button
                          onClick={() => setConfirmDelete(p._id)}
                          className="text-xs text-red-400"
                        >
                          Delete
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <NewPeriodModal
          onClose={() => setShowNew(false)}
          onCreated={(periodId) => {
            setShowNew(false);
            router.push(`/payroll/${periodId}`);
          }}
        />
      )}

      <ConfirmModal
        open={confirmDelete !== null}
        title="Delete pay period?"
        message="This will delete all draft payslips in the period. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
