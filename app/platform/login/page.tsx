"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

/**
 * Separate login route for cross-tenant platform admins. The session
 * cookie they get is the same shape as a regular tenant session token —
 * `requireAuth` recognises both — but they land on /platform/tenants
 * to pick which shop to impersonate before entering the dashboard.
 */
export default function PlatformLoginPage() {
  const loginAction = useAction(api.platform.auth.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await loginAction({ email, password });
      // Same cookie name as the tenant flow — both are validated by the
      // same requireAuth helper on the server.
      document.cookie = `session_token=${r.token}; path=/; max-age=${4 * 60 * 60}; samesite=lax`;
      window.location.href = "/platform/tenants";
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: "var(--bg)", color: "var(--fg)" }}
    >
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
            Platform Console
          </p>
          <h1 className="text-2xl font-bold mt-1">IT Admin Sign-in</h1>
          <p className="text-sm mt-2" style={{ color: "var(--muted-fg)" }}>
            For cross-tenant operators only. Tenant owners use{" "}
            <a href="/login" className="underline" style={{ color: "var(--accent-color)" }}>
              the regular login
            </a>
            .
          </p>
        </div>
        <div
          className="rounded-3xl p-8 shadow-2xl"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
        >
          {err && (
            <div className="mb-5 px-4 py-3 rounded-2xl text-sm font-medium" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {err}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="ops@yourcompany.com" autoFocus />
            <Field label="Password" type="password" value={password} onChange={setPassword} />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 text-sm font-bold rounded-2xl shadow-lg active:scale-[0.99] transition-all disabled:opacity-50"
              style={{ backgroundColor: "var(--accent-color)", color: "white" }}
            >
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
        <p className="text-center text-[10px] mt-6 opacity-50" style={{ color: "var(--muted-fg)" }}>
          Sessions on this console are short-lived (4 hours). Every action you take while
          impersonating a tenant is logged.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
        {label}
      </label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
      />
    </div>
  );
}
