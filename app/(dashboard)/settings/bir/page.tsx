"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { Id } from "../../../../convex/_generated/dataModel";

type BirSettings = {
  tenant: {
    businessName: string | null;
    tradeName: string | null;
    businessAddress: string | null;
    tin: string | null;
    vatStatus: "vat" | "non_vat" | "vat_exempt" | null;
    accreditedSupplierName: string | null;
    accreditedSupplierAccreditation: string | null;
    accreditedSupplierDateIssued: number | null;
    accreditedSupplierDateValid: number | null;
  };
  locations: Array<{
    _id: Id<"locations">;
    name: string;
    slug: string;
    birPermitNumber: string | null;
    birMin: string | null;
    birAtpNumber: string | null;
    birSerialPrefix: string | null;
    birSerialStart: number | null;
    birMachineSerial: string | null;
    storeCode: string | null;
    terminalNo: number | null;
    zCounter: number;
    grandTotalAccumulated: number;
  }>;
};

function dateInputValue(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BirSettingsPage() {
  const { token, session } = useAuth();
  const data = useQuery(
    api.settings.bir.getBirSettings,
    token ? { token } : "skip"
  ) as BirSettings | null | undefined;
  const updateTenant = useMutation(api.settings.bir.updateTenantBir);
  const updateLocation = useMutation(api.settings.bir.updateLocationBir);

  const [tenantForm, setTenantForm] = useState<BirSettings["tenant"] | null>(
    null
  );
  const [savingTenant, setSavingTenant] = useState(false);
  const [tenantErr, setTenantErr] = useState<string | null>(null);
  const [tenantMsg, setTenantMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data && !tenantForm) setTenantForm(data.tenant);
  }, [data, tenantForm]);

  if (!session || session.role !== "owner") {
    return (
      <div className="p-8 text-center" style={{ color: "var(--muted-fg)" }}>
        Owner-only page.
      </div>
    );
  }
  if (!data || !tenantForm) {
    return (
      <div className="p-8 text-center" style={{ color: "var(--muted-fg)" }}>
        Loading…
      </div>
    );
  }

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingTenant(true);
    setTenantErr(null);
    setTenantMsg(null);
    try {
      await updateTenant({
        token,
        businessName: tenantForm.businessName ?? undefined,
        tradeName: tenantForm.tradeName ?? undefined,
        businessAddress: tenantForm.businessAddress ?? undefined,
        tin: tenantForm.tin ?? undefined,
        vatStatus: tenantForm.vatStatus ?? undefined,
        accreditedSupplierName: tenantForm.accreditedSupplierName ?? undefined,
        accreditedSupplierAccreditation:
          tenantForm.accreditedSupplierAccreditation ?? undefined,
        accreditedSupplierDateIssued:
          tenantForm.accreditedSupplierDateIssued ?? undefined,
        accreditedSupplierDateValid:
          tenantForm.accreditedSupplierDateValid ?? undefined,
      });
      setTenantMsg("Saved.");
      setTimeout(() => setTenantMsg(null), 2500);
    } catch (err) {
      setTenantErr(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingTenant(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
          BIR Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted-fg)" }}>
          Bureau of Internal Revenue identity and per-machine identifiers.
          These print on every Official Receipt. The values themselves come
          from your BIR registration / PTU paperwork — the POS just renders
          them.
        </p>
      </div>

      {/* Tenant identity */}
      <section
        className="rounded-3xl p-6"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--muted-fg)" }}
        >
          Business identity (whole tenant)
        </h2>
        {tenantErr && (
          <div className="mb-4 p-3 rounded-2xl text-sm bg-red-500/10 text-red-400 border border-red-500/20">
            {tenantErr}
          </div>
        )}
        {tenantMsg && (
          <div className="mb-4 p-3 rounded-2xl text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {tenantMsg}
          </div>
        )}
        <form onSubmit={handleSaveTenant} className="grid gap-4">
          <Field
            label="Registered Business Name *"
            value={tenantForm.businessName ?? ""}
            onChange={(v) => setTenantForm({ ...tenantForm, businessName: v })}
            placeholder="As registered with BIR, e.g. BEVIGO COFFEE CO."
          />
          <Field
            label="Trade Name / DBA"
            value={tenantForm.tradeName ?? ""}
            onChange={(v) => setTenantForm({ ...tenantForm, tradeName: v })}
            placeholder="e.g. bevi&go"
          />
          <Field
            label="Complete Business Address *"
            value={tenantForm.businessAddress ?? ""}
            onChange={(v) =>
              setTenantForm({ ...tenantForm, businessAddress: v })
            }
            placeholder="Unit 5, 123 Sample St., Brgy. Whatever, Manila"
            textarea
          />
          <Field
            label="TIN *"
            value={tenantForm.tin ?? ""}
            onChange={(v) => setTenantForm({ ...tenantForm, tin: v })}
            placeholder="123-456-789-00001"
            hint="12 digits, optionally followed by a 5-digit branch code"
          />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
              VAT Status *
            </label>
            <select
              value={tenantForm.vatStatus ?? ""}
              onChange={(e) =>
                setTenantForm({
                  ...tenantForm,
                  vatStatus: (e.target.value || null) as
                    | "vat"
                    | "non_vat"
                    | "vat_exempt"
                    | null,
                })
              }
              className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            >
              <option value="">Select…</option>
              <option value="vat">VAT Registered (12%)</option>
              <option value="non_vat">Non-VAT (3% percentage tax)</option>
              <option value="vat_exempt">VAT Exempt</option>
            </select>
          </div>

          <div
            className="rounded-2xl p-4"
            style={{
              backgroundColor: "var(--muted)",
              border: "1px solid var(--border-color)",
            }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-3"
              style={{ color: "var(--muted-fg)" }}
            >
              Accredited supplier (for backup manual OR pad — optional)
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <Field
                label="Supplier Name"
                compact
                value={tenantForm.accreditedSupplierName ?? ""}
                onChange={(v) =>
                  setTenantForm({ ...tenantForm, accreditedSupplierName: v })
                }
              />
              <Field
                label="Accreditation #"
                compact
                value={tenantForm.accreditedSupplierAccreditation ?? ""}
                onChange={(v) =>
                  setTenantForm({
                    ...tenantForm,
                    accreditedSupplierAccreditation: v,
                  })
                }
              />
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted-fg)" }}>
                  Date Issued
                </label>
                <input
                  type="date"
                  value={dateInputValue(tenantForm.accreditedSupplierDateIssued)}
                  onChange={(e) =>
                    setTenantForm({
                      ...tenantForm,
                      accreditedSupplierDateIssued: e.target.value
                        ? new Date(e.target.value).getTime()
                        : null,
                    })
                  }
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{
                    backgroundColor: "var(--card)",
                    color: "var(--fg)",
                    border: "1px solid var(--border-color)",
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted-fg)" }}>
                  Valid Until
                </label>
                <input
                  type="date"
                  value={dateInputValue(tenantForm.accreditedSupplierDateValid)}
                  onChange={(e) =>
                    setTenantForm({
                      ...tenantForm,
                      accreditedSupplierDateValid: e.target.value
                        ? new Date(e.target.value).getTime()
                        : null,
                    })
                  }
                  className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{
                    backgroundColor: "var(--card)",
                    color: "var(--fg)",
                    border: "1px solid var(--border-color)",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingTenant}
              className="px-4 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              {savingTenant ? "Saving…" : "Save business identity"}
            </button>
          </div>
        </form>
      </section>

      {/* Per-location BIR */}
      <section
        className="rounded-3xl p-6"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--muted-fg)" }}
        >
          Per-location identifiers
        </h2>
        <p className="text-xs mb-5" style={{ color: "var(--muted-fg)" }}>
          Each POS machine needs its own Permit to Use (PTU) and Machine
          Identification Number (MIN) issued by your RDO. The serial prefix
          + start determines the OR/SI number sequence (gap-less, never
          reused — even voided orders consume a serial).
        </p>
        <div className="space-y-4">
          {data.locations.map((loc) => (
            <LocationBirCard
              key={loc._id}
              location={loc}
              token={token!}
              onSave={updateLocation}
            />
          ))}
        </div>
      </section>

      <OfflineReservationsPanel token={token!} />
    </div>
  );
}

type ReservationRow = {
  _id: Id<"orderSerialReservations">;
  deviceId: string;
  prefix: string;
  fromSerial: number;
  toSerial: number;
  usedThrough: number;
  unusedTail: number;
  status: "active" | "exhausted" | "expired";
  expiresAt: number;
  createdAt: number;
};

type ReservationLocationGroup = {
  locationId: Id<"locations">;
  locationName: string;
  reservations: ReservationRow[];
  totals: {
    active: number;
    exhausted: number;
    expired: number;
    unusedToReport: number;
  };
};

function OfflineReservationsPanel({ token }: { token: string }) {
  const rollup = useQuery(
    api.settings.birReservations.tenantReservationRollup,
    { token }
  ) as ReservationLocationGroup[] | undefined;

  return (
    <section
      className="rounded-3xl p-6"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border-color)",
      }}
    >
      <h2
        className="text-xs font-semibold uppercase tracking-widest mb-2"
        style={{ color: "var(--muted-fg)" }}
      >
        Offline serial reservations
      </h2>
      <p className="text-xs mb-5" style={{ color: "var(--muted-fg)" }}>
        Pre-allocated blocks each device claims so it can print BIR-
        compliant Official Receipts during a network outage. Unused serials
        in an expired block must be filed as VOID/CANCELLED with the BIR —
        the count below is what your auditor will ask for.
      </p>

      {rollup === undefined ? (
        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
          Loading…
        </p>
      ) : rollup.every((g) => g.reservations.length === 0) ? (
        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
          No reservations have been issued yet. The first will appear here
          the next time a register opens with BIR settings configured.
        </p>
      ) : (
        <div className="space-y-5">
          {rollup.map((g) =>
            g.reservations.length === 0 ? null : (
              <LocationReservations key={g.locationId} group={g} />
            )
          )}
        </div>
      )}
    </section>
  );
}

function LocationReservations({ group }: { group: ReservationLocationGroup }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: "var(--muted)",
        border: "1px solid var(--border-color)",
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
          {group.locationName}
        </p>
        <div className="flex gap-2 flex-wrap text-[10px] font-semibold uppercase tracking-widest">
          <Stat label="Active" value={group.totals.active} tone="ok" />
          <Stat
            label="Exhausted"
            value={group.totals.exhausted}
            tone="neutral"
          />
          <Stat
            label="Expired"
            value={group.totals.expired}
            tone={group.totals.expired > 0 ? "warn" : "neutral"}
          />
          <Stat
            label="To Void"
            value={group.totals.unusedToReport}
            tone={group.totals.unusedToReport > 0 ? "error" : "neutral"}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
              <Th align="left">Range</Th>
              <Th align="left">Status</Th>
              <Th align="right">Used</Th>
              <Th align="right">Unused</Th>
              <Th align="left">Device</Th>
              <Th align="left">Expires</Th>
            </tr>
          </thead>
          <tbody>
            {group.reservations.map((r) => (
              <ReservationRowView key={r._id} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReservationRowView({ row }: { row: ReservationRow }) {
  const range = `${row.prefix}${String(row.fromSerial).padStart(8, "0")} → ${String(
    row.toSerial
  ).padStart(8, "0")}`;
  const used =
    row.usedThrough === 0
      ? 0
      : row.usedThrough - row.fromSerial + 1;
  const total = row.toSerial - row.fromSerial + 1;
  const usedPercent = Math.round((used / total) * 100);

  const statusColors = {
    active: { bg: "rgba(16,185,129,0.15)", fg: "#059669" },
    exhausted: { bg: "var(--card)", fg: "var(--muted-fg)" },
    expired: { bg: "rgba(239,68,68,0.15)", fg: "#b91c1c" },
  } as const;
  const s = statusColors[row.status];

  return (
    <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
      <td
        className="px-2 py-2 font-mono text-[11px]"
        style={{ color: "var(--fg)" }}
      >
        {range}
      </td>
      <td className="px-2 py-2">
        <span
          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
          style={{ backgroundColor: s.bg, color: s.fg }}
        >
          {row.status}
        </span>
      </td>
      <td
        className="px-2 py-2 text-right font-mono text-[11px]"
        style={{ color: "var(--fg)" }}
      >
        {used}/{total} ({usedPercent}%)
      </td>
      <td
        className="px-2 py-2 text-right font-mono text-[11px]"
        style={{
          color: row.unusedTail > 0 && row.status === "expired" ? "#b91c1c" : "var(--muted-fg)",
        }}
      >
        {row.unusedTail}
      </td>
      <td
        className="px-2 py-2 font-mono text-[10px] truncate max-w-32"
        style={{ color: "var(--muted-fg)" }}
        title={row.deviceId}
      >
        {row.deviceId.slice(0, 8)}…
      </td>
      <td
        className="px-2 py-2 text-[11px]"
        style={{ color: "var(--muted-fg)" }}
      >
        {new Date(row.expiresAt).toLocaleDateString()}
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "error" | "neutral";
}) {
  const palette = {
    ok: { bg: "rgba(16,185,129,0.15)", fg: "#059669" },
    warn: { bg: "rgba(245,158,11,0.15)", fg: "#b45309" },
    error: { bg: "rgba(239,68,68,0.15)", fg: "#b91c1c" },
    neutral: { bg: "var(--card)", fg: "var(--muted-fg)" },
  }[tone];
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      {label}: {value}
    </span>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "right";
}) {
  return (
    <th
      className={`px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${
        align === "right" ? "text-right" : "text-left"
      }`}
      style={{ color: "var(--muted-fg)" }}
    >
      {children}
    </th>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  textarea,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  textarea?: boolean;
  compact?: boolean;
}) {
  const baseInput =
    "w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30";
  const compactInput =
    "w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30";
  return (
    <div>
      <label
        className={`block ${compact ? "text-[10px] mb-1.5" : "text-xs mb-2"} font-semibold uppercase tracking-widest`}
        style={{ color: "var(--muted-fg)" }}
      >
        {label}
      </label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={baseInput}
          style={{
            backgroundColor: "var(--muted)",
            color: "var(--fg)",
            border: "1px solid var(--border-color)",
          }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={compact ? compactInput : baseInput}
          style={{
            backgroundColor: compact ? "var(--card)" : "var(--muted)",
            color: "var(--fg)",
            border: "1px solid var(--border-color)",
          }}
        />
      )}
      {hint && (
        <p className="text-[11px] mt-1" style={{ color: "var(--muted-fg)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function LocationBirCard({
  location,
  token,
  onSave,
}: {
  location: BirSettings["locations"][number];
  token: string;
  onSave: ReturnType<typeof useMutation<typeof api.settings.bir.updateLocationBir>>;
}) {
  const [form, setForm] = useState({
    birPermitNumber: location.birPermitNumber ?? "",
    birMin: location.birMin ?? "",
    birAtpNumber: location.birAtpNumber ?? "",
    birSerialPrefix: location.birSerialPrefix ?? `OR-${location.slug.toUpperCase()}-`,
    birSerialStart: location.birSerialStart ?? 1,
    birMachineSerial: location.birMachineSerial ?? "",
    storeCode: location.storeCode ?? "",
    terminalNo: location.terminalNo ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await onSave({
        token,
        locationId: location._id,
        birPermitNumber: form.birPermitNumber,
        birMin: form.birMin,
        birAtpNumber: form.birAtpNumber,
        birSerialPrefix: form.birSerialPrefix,
        birSerialStart: form.birSerialStart,
        birMachineSerial: form.birMachineSerial,
        storeCode: form.storeCode,
        terminalNo: form.terminalNo,
      });
      setMsg("Saved.");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        backgroundColor: "var(--muted)",
        border: "1px solid var(--border-color)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold" style={{ color: "var(--fg)" }}>
          {location.name}
        </h3>
        <span className="text-[10px]" style={{ color: "var(--muted-fg)" }}>
          {location.slug}
        </span>
      </div>
      {err && (
        <div className="mb-3 p-2 rounded-xl text-xs bg-red-500/10 text-red-400 border border-red-500/20">
          {err}
        </div>
      )}
      {msg && (
        <div className="mb-3 p-2 rounded-xl text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {msg}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        <Field
          label="PTU Number"
          compact
          value={form.birPermitNumber}
          onChange={(v) => setForm({ ...form, birPermitNumber: v })}
          placeholder="FP012023-XXXX"
        />
        <Field
          label="MIN"
          compact
          value={form.birMin}
          onChange={(v) => setForm({ ...form, birMin: v })}
          placeholder="XXXXXXXXXXXX"
        />
        <Field
          label="ATP Number (backup OR pad)"
          compact
          value={form.birAtpNumber}
          onChange={(v) => setForm({ ...form, birAtpNumber: v })}
        />
        <Field
          label="Serial Prefix"
          compact
          value={form.birSerialPrefix}
          onChange={(v) => setForm({ ...form, birSerialPrefix: v })}
        />
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted-fg)" }}>
            Serial Start
          </label>
          <input
            type="number"
            min={1}
            value={form.birSerialStart}
            onChange={(e) => setForm({ ...form, birSerialStart: Number(e.target.value) })}
            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
            style={{
              backgroundColor: "var(--card)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
          />
          <p className="text-[10px] mt-1" style={{ color: "var(--muted-fg)" }}>
            Next OR will be #{form.birSerialStart}. Saving resets the counter.
          </p>
        </div>
      </div>

      {/* Z-Read identity — printed on every X / Z reading */}
      <div
        className="rounded-xl mt-3 p-3"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-2"
          style={{ color: "var(--muted-fg)" }}
        >
          Z-Read identity
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          <Field
            label="POS Serial (SN)"
            compact
            value={form.birMachineSerial}
            onChange={(v) => setForm({ ...form, birMachineSerial: v })}
            placeholder="PC1132A9"
          />
          <Field
            label="Store Code"
            compact
            value={form.storeCode}
            onChange={(v) => setForm({ ...form, storeCode: v })}
            placeholder="001"
          />
          <div>
            <label
              className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: "var(--muted-fg)" }}
            >
              Terminal No.
            </label>
            <input
              type="number"
              min={1}
              value={form.terminalNo}
              onChange={(e) =>
                setForm({ ...form, terminalNo: Number(e.target.value) || 1 })
              }
              className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            />
          </div>
        </div>
        <p
          className="text-[10px] mt-2 grid grid-cols-2 gap-2"
          style={{ color: "var(--muted-fg)" }}
        >
          <span>
            Z-Counter:{" "}
            <strong style={{ color: "var(--fg)" }}>
              {String(location.zCounter).padStart(8, "0")}
            </strong>
          </span>
          <span>
            Accumulated:{" "}
            <strong style={{ color: "var(--fg)" }}>
              ₱{(location.grandTotalAccumulated / 100).toLocaleString()}
            </strong>
          </span>
        </p>
      </div>

      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2.5 rounded-2xl text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
