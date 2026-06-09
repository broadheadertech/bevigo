"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

type StepId = "workspace" | "location" | "owner" | "review";

const STEPS: { id: StepId; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "location", label: "First Location" },
  { id: "owner", label: "Owner Account" },
  { id: "review", label: "Review & Create" },
];

const TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Asia/Bangkok",
  "Australia/Sydney",
  "America/Los_Angeles",
  "America/New_York",
  "UTC",
];

const CURRENCIES = ["PHP", "USD", "SGD", "JPY", "HKD", "THB", "AUD"];

const VAT_STATUSES: Array<{ value: "vat" | "non_vat" | "vat_exempt"; label: string }> = [
  { value: "vat", label: "VAT-registered (12%)" },
  { value: "non_vat", label: "Non-VAT (3% percentage tax)" },
  { value: "vat_exempt", label: "VAT-exempt" },
];

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? m[2] : null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export default function NewTenantPage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => setToken(getCookie("session_token")), []);

  const me = useQuery(api.platform.session.me, token ? { token } : "skip");
  useEffect(() => {
    if (token === null) return;
    if (me === null) window.location.replace("/platform/login");
  }, [token, me]);

  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx].id;

  // Workspace
  const [name, setName] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("Asia/Manila");
  const [currency, setCurrency] = useState("PHP");
  const [businessName, setBusinessName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [tin, setTin] = useState("");
  const [vatStatus, setVatStatus] = useState<"vat" | "non_vat" | "vat_exempt">("vat");

  // Location
  const [locationName, setLocationName] = useState("Main Branch");
  const [locationAddress, setLocationAddress] = useState("");
  const [taxRateBps, setTaxRateBps] = useState(1200);
  const [taxLabel, setTaxLabel] = useState("VAT");

  // Owner
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerPasswordConfirm, setOwnerPasswordConfirm] = useState("");

  // Review
  const [seedSampleData, setSeedSampleData] = useState(true);
  const [impersonateAfter, setImpersonateAfter] = useState(true);

  // Live availability
  const effectiveSlug = (slugDirty ? slug : slugify(name)).trim().toLowerCase();
  const slugCheck = useQuery(
    api.platform.onboardingHelpers.slugAvailable,
    token && effectiveSlug ? { token, slug: effectiveSlug } : "skip"
  );
  const emailCheck = useQuery(
    api.platform.onboardingHelpers.ownerEmailAvailable,
    token && ownerEmail.includes("@") ? { token, email: ownerEmail } : "skip"
  );

  const createTenant = useAction(api.platform.onboarding.createTenant);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceValid =
    name.trim().length >= 2 &&
    !!effectiveSlug &&
    (slugCheck?.available ?? false);
  const locationValid = locationName.trim().length >= 2 && taxRateBps >= 0;
  const ownerValid =
    ownerName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail) &&
    (emailCheck?.available ?? false) &&
    ownerPassword.length >= 8 &&
    ownerPassword === ownerPasswordConfirm;

  const canAdvance = useMemo(() => {
    if (step === "workspace") return workspaceValid;
    if (step === "location") return locationValid;
    if (step === "owner") return ownerValid;
    return true;
  }, [step, workspaceValid, locationValid, ownerValid]);

  const submit = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await createTenant({
        token,
        name: name.trim(),
        slug: effectiveSlug,
        currency,
        timezone,
        businessName: businessName.trim() || undefined,
        tradeName: tradeName.trim() || undefined,
        businessAddress: businessAddress.trim() || undefined,
        tin: tin.trim() || undefined,
        vatStatus,
        locationName: locationName.trim(),
        locationAddress: locationAddress.trim() || undefined,
        taxRate: taxRateBps,
        taxLabel,
        ownerEmail: ownerEmail.trim(),
        ownerName: ownerName.trim(),
        ownerPassword,
        seedSampleData,
        impersonateAfter,
      });
      window.location.href = impersonateAfter ? "/" : "/platform/tenants";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create tenant.");
      setSubmitting(false);
    }
  };

  if (!token || me === undefined) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg)", color: "var(--muted-fg)" }}
      >
        Loading…
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-6 md:p-10"
      style={{ backgroundColor: "var(--bg)", color: "var(--fg)" }}
    >
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: "var(--muted-fg)" }}
            >
              Platform Console
            </p>
            <h1 className="text-2xl font-bold mt-1">New tenant</h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted-fg)" }}>
              Provision a new workspace with its first location and owner.
            </p>
          </div>
          <a
            href="/platform/tenants"
            className="text-sm font-semibold underline"
            style={{ color: "var(--muted-fg)" }}
          >
            ← Back to tenants
          </a>
        </div>

        {/* Stepper */}
        <ol className="flex items-center gap-2 mb-6 flex-wrap">
          {STEPS.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (i <= stepIdx) setStepIdx(i);
                  }}
                  className="flex items-center gap-2"
                  disabled={i > stepIdx}
                >
                  <span
                    className="w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center"
                    style={{
                      backgroundColor: active
                        ? "var(--accent-color)"
                        : done
                          ? "rgba(16,185,129,0.15)"
                          : "var(--muted)",
                      color: active ? "white" : done ? "#059669" : "var(--muted-fg)",
                    }}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span
                    className="text-xs font-semibold whitespace-nowrap"
                    style={{
                      color: active ? "var(--fg)" : "var(--muted-fg)",
                    }}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span
                    className="w-6 h-px"
                    style={{ backgroundColor: "var(--border-color)" }}
                  />
                )}
              </li>
            );
          })}
        </ol>

        {/* Card */}
        <div
          className="rounded-3xl p-5 md:p-7"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
          }}
        >
          {step === "workspace" && (
            <div className="space-y-4">
              <Field label="Workspace name *">
                <Input
                  value={name}
                  onChange={(v) => {
                    setName(v);
                    if (!slugDirty) setSlug(slugify(v));
                  }}
                  placeholder="bevi&go Manila"
                />
              </Field>
              <Field
                label="Slug *"
                hint="Used in URLs and internal references. Lowercase letters, digits, hyphens."
                status={
                  effectiveSlug && slugCheck
                    ? slugCheck.available
                      ? { kind: "ok", text: "Available" }
                      : { kind: "err", text: slugCheck.reason ?? "Unavailable" }
                    : null
                }
              >
                <Input
                  value={slugDirty ? slug : slugify(name)}
                  onChange={(v) => {
                    setSlug(slugify(v));
                    setSlugDirty(true);
                  }}
                  placeholder="bevigo-manila"
                  mono
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Timezone">
                  <Select value={timezone} onChange={setTimezone} options={TIMEZONES} />
                </Field>
                <Field label="Currency">
                  <Select value={currency} onChange={setCurrency} options={CURRENCIES} />
                </Field>
              </div>

              <SectionTitle>BIR identity (optional)</SectionTitle>
              <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                Required before the first official receipt. Can be filled in
                later under <strong>Settings → BIR / Tax</strong>.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Registered business name">
                  <Input
                    value={businessName}
                    onChange={setBusinessName}
                    placeholder="bevi&go Coffee Trading Corp."
                  />
                </Field>
                <Field label="Trade name (DBA)">
                  <Input
                    value={tradeName}
                    onChange={setTradeName}
                    placeholder="bevi&go"
                  />
                </Field>
              </div>
              <Field label="Business address">
                <Input
                  value={businessAddress}
                  onChange={setBusinessAddress}
                  placeholder="Unit 12, ABC Bldg, Quezon Ave., QC"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="TIN" hint="12-digit + optional 5-digit branch code">
                  <Input
                    value={tin}
                    onChange={setTin}
                    placeholder="123-456-789-00000"
                    mono
                  />
                </Field>
                <Field label="VAT status">
                  <Select
                    value={vatStatus}
                    onChange={(v) =>
                      setVatStatus(v as "vat" | "non_vat" | "vat_exempt")
                    }
                    options={VAT_STATUSES.map((s) => s.value)}
                    labels={VAT_STATUSES.reduce<Record<string, string>>(
                      (acc, s) => {
                        acc[s.value] = s.label;
                        return acc;
                      },
                      {}
                    )}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === "location" && (
            <div className="space-y-4">
              <Field label="Location name *">
                <Input
                  value={locationName}
                  onChange={setLocationName}
                  placeholder="Main Branch"
                />
              </Field>
              <Field label="Street address">
                <Input
                  value={locationAddress}
                  onChange={setLocationAddress}
                  placeholder="123 Katipunan Ave., Quezon City"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Tax rate *"
                  hint="Basis points (1200 = 12% VAT, 300 = 3% PT, 0 = none)"
                >
                  <Input
                    value={String(taxRateBps)}
                    onChange={(v) => setTaxRateBps(Math.max(0, Number(v) || 0))}
                    placeholder="1200"
                    mono
                  />
                </Field>
                <Field label="Tax label">
                  <Input
                    value={taxLabel}
                    onChange={setTaxLabel}
                    placeholder="VAT"
                  />
                </Field>
              </div>
              <p
                className="text-xs px-3 py-2 rounded-2xl"
                style={{
                  backgroundColor: "var(--muted)",
                  color: "var(--muted-fg)",
                }}
              >
                Operating hours default to 7am–9pm weekdays, 8am–10pm weekends.
                The owner can adjust them under <strong>Settings → Locations</strong>.
              </p>
            </div>
          )}

          {step === "owner" && (
            <div className="space-y-4">
              <Field label="Owner full name *">
                <Input
                  value={ownerName}
                  onChange={setOwnerName}
                  placeholder="Juan Dela Cruz"
                />
              </Field>
              <Field
                label="Email *"
                status={
                  ownerEmail.includes("@") && emailCheck
                    ? emailCheck.available
                      ? { kind: "ok", text: "Available" }
                      : { kind: "err", text: emailCheck.reason ?? "Unavailable" }
                    : null
                }
              >
                <Input
                  value={ownerEmail}
                  onChange={setOwnerEmail}
                  placeholder="owner@cafe.com"
                  type="email"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Password *"
                  hint="At least 8 characters"
                  status={
                    ownerPassword.length > 0
                      ? ownerPassword.length >= 8
                        ? { kind: "ok", text: "Strong enough" }
                        : { kind: "err", text: "Too short" }
                      : null
                  }
                >
                  <Input
                    value={ownerPassword}
                    onChange={setOwnerPassword}
                    placeholder="•••••••••"
                    type="password"
                  />
                </Field>
                <Field
                  label="Confirm password *"
                  status={
                    ownerPasswordConfirm.length > 0
                      ? ownerPasswordConfirm === ownerPassword
                        ? { kind: "ok", text: "Matches" }
                        : { kind: "err", text: "Doesn't match" }
                      : null
                  }
                >
                  <Input
                    value={ownerPasswordConfirm}
                    onChange={setOwnerPasswordConfirm}
                    placeholder="•••••••••"
                    type="password"
                  />
                </Field>
              </div>
              <p
                className="text-xs px-3 py-2 rounded-2xl"
                style={{
                  backgroundColor: "rgba(245,158,11,0.1)",
                  color: "#b45309",
                  border: "1px solid rgba(245,158,11,0.2)",
                }}
              >
                The owner can change their password and invite managers/baristas
                from the regular dashboard after first login.
              </p>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <SectionTitle>Workspace</SectionTitle>
              <KvGrid>
                <Kv label="Name" value={name} />
                <Kv label="Slug" value={effectiveSlug} mono />
                <Kv label="Timezone" value={timezone} />
                <Kv label="Currency" value={currency} />
                {businessName && <Kv label="Business name" value={businessName} />}
                {tradeName && <Kv label="Trade name" value={tradeName} />}
                {tin && <Kv label="TIN" value={tin} mono />}
                <Kv
                  label="VAT status"
                  value={VAT_STATUSES.find((s) => s.value === vatStatus)?.label ?? vatStatus}
                />
              </KvGrid>

              <SectionTitle>First location</SectionTitle>
              <KvGrid>
                <Kv label="Name" value={locationName} />
                {locationAddress && <Kv label="Address" value={locationAddress} />}
                <Kv
                  label="Tax"
                  value={`${(taxRateBps / 100).toFixed(2)}% ${taxLabel}`}
                />
              </KvGrid>

              <SectionTitle>Owner</SectionTitle>
              <KvGrid>
                <Kv label="Name" value={ownerName} />
                <Kv label="Email" value={ownerEmail} mono />
              </KvGrid>

              <SectionTitle>Options</SectionTitle>
              <ToggleRow
                label="Seed sample categories & discount presets"
                hint="Coffee/Non-Coffee/Tea/Pastries/Merchandise + Senior-PWD, Staff 50%, Loyalty ₱20 off"
                value={seedSampleData}
                onChange={setSeedSampleData}
              />
              <ToggleRow
                label="Open this workspace immediately after creation"
                hint="Impersonate as owner and jump into the dashboard"
                value={impersonateAfter}
                onChange={setImpersonateAfter}
              />

              {error && (
                <div
                  className="text-sm px-3 py-2 rounded-2xl"
                  style={{
                    backgroundColor: "rgba(239,68,68,0.1)",
                    color: "#b91c1c",
                    border: "1px solid rgba(239,68,68,0.3)",
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0 || submitting}
            className="px-4 py-2 rounded-2xl text-sm font-semibold disabled:opacity-30"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
          >
            Back
          </button>
          {step !== "review" ? (
            <button
              onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
              disabled={!canAdvance}
              className="px-5 py-2 rounded-2xl text-sm font-semibold disabled:opacity-40"
              style={{
                backgroundColor: "var(--accent-color)",
                color: "white",
              }}
            >
              Continue
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting || !workspaceValid || !locationValid || !ownerValid}
              className="px-6 py-2.5 rounded-2xl text-sm font-bold disabled:opacity-40"
              style={{
                backgroundColor: "var(--accent-color)",
                color: "white",
              }}
            >
              {submitting ? "Creating…" : "Create workspace"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  status,
  children,
}: {
  label: string;
  hint?: string;
  status?: { kind: "ok" | "err"; text: string } | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--muted-fg)" }}
        >
          {label}
        </label>
        {status && (
          <span
            className="text-[10px] font-semibold"
            style={{ color: status.kind === "ok" ? "#10b981" : "#ef4444" }}
          >
            {status.text}
          </span>
        )}
      </div>
      {children}
      {hint && (
        <p
          className="text-[11px] mt-1"
          style={{ color: "var(--muted-fg)" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none ${
        mono ? "font-mono" : ""
      }`}
      style={{
        backgroundColor: "var(--muted)",
        color: "var(--fg)",
        border: "1px solid var(--border-color)",
      }}
    />
  );
}

function Select({
  value,
  onChange,
  options,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl px-4 py-2.5 text-sm focus:outline-none"
      style={{
        backgroundColor: "var(--muted)",
        color: "var(--fg)",
        border: "1px solid var(--border-color)",
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[11px] font-semibold uppercase tracking-widest pt-2"
      style={{ color: "var(--muted-fg)" }}
    >
      {children}
    </h3>
  );
}

function KvGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Kv({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      className="rounded-2xl px-3 py-2"
      style={{
        backgroundColor: "var(--muted)",
        border: "1px solid var(--border-color)",
      }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted-fg)" }}
      >
        {label}
      </p>
      <p
        className={`text-sm ${mono ? "font-mono" : ""} truncate`}
        style={{ color: "var(--fg)" }}
        title={value}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full text-left rounded-2xl p-3 flex items-start gap-3"
      style={{
        backgroundColor: "var(--muted)",
        border: "1px solid var(--border-color)",
      }}
    >
      <span
        className="w-9 h-5 rounded-full flex items-center mt-0.5 transition-colors flex-shrink-0"
        style={{
          backgroundColor: value ? "var(--accent-color)" : "var(--border-color)",
        }}
      >
        <span
          className="w-4 h-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: value ? "translateX(18px)" : "translateX(2px)" }}
        />
      </span>
      <span className="flex-1">
        <span className="text-sm font-semibold block" style={{ color: "var(--fg)" }}>
          {label}
        </span>
        {hint && (
          <span className="text-xs block" style={{ color: "var(--muted-fg)" }}>
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}
