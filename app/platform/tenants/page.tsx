"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type Tenant = {
  _id: Id<"tenants">;
  name: string;
  slug: string;
  status: string;
  userCount: number;
  locationCount: number;
};

type Me = {
  email: string;
  name: string;
  expiresAt: number;
  currentTenantId: Id<"tenants"> | null;
  currentTenantName: string | null;
};

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? m[2] : null;
}

export default function TenantsPage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => setToken(getCookie("session_token")), []);

  const me = useQuery(api.platform.session.me, token ? { token } : "skip") as
    | Me
    | null
    | undefined;
  const tenants = useQuery(
    api.platform.session.listTenants,
    token ? { token } : "skip"
  ) as Tenant[] | undefined;

  const switchTenant = useMutation(api.platform.session.switchTenant);
  const exitTenant = useMutation(api.platform.session.exitTenant);
  const logout = useMutation(api.platform.session.logout);

  // If a session was loaded and the cookie is missing or expired, bounce back.
  useEffect(() => {
    if (token === null) return;
    if (me === null) {
      window.location.replace("/platform/login");
    }
  }, [token, me]);

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!tenants) return [];
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
    );
  }, [tenants, search]);

  const handlePick = async (tenantId: Id<"tenants">) => {
    if (!token) return;
    await switchTenant({ token, tenantId });
    window.location.href = "/";
  };

  const handleSignOut = async () => {
    if (token) await logout({ token });
    document.cookie = "session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    window.location.href = "/platform/login";
  };

  const handleExit = async () => {
    if (!token) return;
    await exitTenant({ token });
  };

  if (!token || me === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg)", color: "var(--muted-fg)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ backgroundColor: "var(--bg)", color: "var(--fg)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--muted-fg)" }}>
              Platform Console
            </p>
            <h1 className="text-2xl font-bold mt-1">Choose a tenant</h1>
            {me && (
              <p className="text-sm mt-1" style={{ color: "var(--muted-fg)" }}>
                Signed in as <strong>{me.name}</strong> · session expires{" "}
                {new Date(me.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-2xl text-sm font-semibold"
            style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
          >
            Sign out
          </button>
        </div>

        {me?.currentTenantId && me.currentTenantName && (
          <div
            className="rounded-3xl p-4 mb-6 flex items-center justify-between"
            style={{ backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            <div className="text-sm">
              Currently impersonating <strong>{me.currentTenantName}</strong>.{" "}
              <a href="/" className="underline" style={{ color: "var(--accent-color)" }}>
                Open dashboard →
              </a>
            </div>
            <button
              onClick={handleExit}
              className="text-xs font-semibold underline"
              style={{ color: "var(--muted-fg)" }}
            >
              Stop impersonating
            </button>
          </div>
        )}

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter tenants…"
          className="w-full rounded-2xl px-4 py-3 text-sm mb-4 focus:outline-none"
          style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
        />

        <div
          className="rounded-3xl shadow-lg overflow-hidden"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border-color)" }}
        >
          {tenants === undefined ? (
            <p className="p-8 text-center text-sm" style={{ color: "var(--muted-fg)" }}>Loading tenants…</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm" style={{ color: "var(--muted-fg)" }}>
              {search.trim() ? "No tenants match." : "No tenants exist yet."}
            </p>
          ) : (
            filtered.map((t, i) => (
              <button
                key={t._id}
                onClick={() => handlePick(t._id)}
                className="w-full text-left px-5 py-4 transition-colors hover:opacity-80"
                style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border-color)" : "none" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold" style={{ color: "var(--fg)" }}>
                      {t.name}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                      {t.slug} · {t.locationCount} location{t.locationCount === 1 ? "" : "s"} · {t.userCount} user{t.userCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-2.5 py-1 rounded-full uppercase tracking-widest ${
                      t.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-stone-500/10 text-stone-500"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
