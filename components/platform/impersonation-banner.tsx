"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

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

/**
 * Visible only when the current cookie belongs to a platform admin who has
 * picked a tenant to impersonate. Stays out of the way otherwise — regular
 * tenant users never see anything.
 */
export function ImpersonationBanner() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => setToken(getCookie("session_token")), []);

  const me = useQuery(api.platform.session.me, token ? { token } : "skip") as
    | Me
    | null
    | undefined;
  const exitTenant = useMutation(api.platform.session.exitTenant);

  if (!me || !me.currentTenantId) return null;

  const handleSwitch = () => {
    window.location.href = "/platform/tenants";
  };
  const handleExit = async () => {
    if (!token) return;
    await exitTenant({ token });
    window.location.href = "/platform/tenants";
  };

  return (
    <div
      className="px-4 py-2 text-xs flex items-center justify-between flex-wrap gap-2"
      style={{
        backgroundColor: "rgba(245,158,11,0.15)",
        borderBottom: "1px solid rgba(245,158,11,0.3)",
        color: "#b45309",
      }}
    >
      <span>
        <strong>IT Admin</strong> · impersonating{" "}
        <strong>{me.currentTenantName}</strong> as <strong>{me.name}</strong>.
        Every action you take is recorded.
      </span>
      <span className="flex items-center gap-2">
        <button
          onClick={handleSwitch}
          className="px-2.5 py-1 rounded-lg font-semibold"
          style={{ backgroundColor: "rgba(0,0,0,0.1)" }}
        >
          Switch tenant
        </button>
        <button
          onClick={handleExit}
          className="px-2.5 py-1 rounded-lg font-semibold"
          style={{ backgroundColor: "rgba(0,0,0,0.1)" }}
        >
          Exit
        </button>
      </span>
    </div>
  );
}
