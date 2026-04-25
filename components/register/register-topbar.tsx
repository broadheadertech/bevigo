"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export function RegisterTopBar() {
  const { session, logout, isAuthenticated } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (!isAuthenticated) return null;

  const canSeeDashboard =
    session?.role === "owner" || session?.role === "manager";

  return (
    <>
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{
          backgroundColor: "var(--card)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        {/* Left: brand + back-to-dashboard for owner/manager */}
        <div className="flex items-center gap-3 min-w-0">
          {canSeeDashboard ? (
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-bold transition-all active:scale-95 shrink-0"
              style={{
                backgroundColor: "var(--accent-color)",
                color: "white",
              }}
              title="Back to dashboard"
              aria-label="Back to dashboard"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span>Dashboard</span>
            </Link>
          ) : (
            <span
              className="text-base font-semibold italic shrink-0"
              style={{ color: "var(--fg)" }}
            >
              bevi&amp;go
            </span>
          )}
          <span
            className="text-xs uppercase tracking-widest font-semibold hidden md:inline"
            style={{ color: "var(--muted-fg)" }}
          >
            Register
          </span>
        </div>

        {/* Right: user identity + sign out */}
        <div className="flex items-center gap-2">
          {session && (
            <span
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-medium"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--fg)",
                border: "1px solid var(--border-color)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "var(--accent-color)" }}
              />
              <span className="capitalize" style={{ color: "var(--muted-fg)" }}>
                {session.role}
              </span>
              <span>·</span>
              <span>{session.userName}</span>
            </span>
          )}
          <button
            onClick={() => setConfirmLogout(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-semibold transition-all active:scale-95"
            style={{
              backgroundColor: "var(--muted)",
              color: "var(--fg)",
              border: "1px solid var(--border-color)",
            }}
            title="Sign out"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {confirmLogout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmLogout(false);
          }}
        >
          <div
            className="rounded-3xl shadow-2xl w-full max-w-sm p-6"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <h3 className="text-lg font-bold mb-1" style={{ color: "var(--fg)" }}>
              Sign out?
            </h3>
            <p className="text-sm mb-5" style={{ color: "var(--muted-fg)" }}>
              You&apos;ll be returned to the login screen. End your shift first
              if you have one open.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmLogout(false)}
                className="flex-1 py-3 rounded-2xl text-sm font-medium transition-colors"
                style={{
                  border: "1px solid var(--border-color)",
                  color: "var(--fg)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmLogout(false);
                  logout();
                }}
                className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-colors active:scale-[0.99]"
                style={{ backgroundColor: "#ef4444" }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
