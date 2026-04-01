"use client";

import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";

type Mode = "login" | "register";

export default function LoginContent() {
  const loginAction = useAction(api.auth.login.login);
  const registerAction = useAction(api.auth.login.register);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let result: { token: string; role: string };

      if (mode === "login") {
        result = await loginAction({ email, password });
      } else {
        result = await registerAction({ email, password, name, shopName });
      }

      document.cookie = `session_token=${result.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
      window.location.href = "/staff";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all placeholder:opacity-40";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-auto"
      style={{ backgroundColor: "var(--bg)", color: "var(--fg)" }}
    >
      {/* Subtle background glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] blur-3xl pointer-events-none"
        style={{ backgroundColor: "var(--accent-color)" }}
      />

      <div className="w-full max-w-md px-6 relative z-10">
        {/* Logo */}
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="bevi&go"
            className="h-20 mx-auto mb-2 object-contain drop-shadow-lg"
          />
          <p className="text-base font-light tracking-wide" style={{ color: "var(--muted-fg)" }}>
            {mode === "login" ? "Welcome back" : "Create your coffee shop"}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-8 backdrop-blur-sm shadow-2xl"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border-color)",
          }}
        >
          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-2xl text-sm font-medium"
              style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {mode === "register" && (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                    placeholder="Juan Dela Cruz"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                    Shop Name
                  </label>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className={inputClass}
                    style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                    placeholder="My Coffee Shop"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                placeholder="owner@coffeeshop.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--muted-fg)" }}>
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                style={{ backgroundColor: "var(--muted)", color: "var(--fg)", border: "1px solid var(--border-color)" }}
                placeholder={mode === "register" ? "Min 6 characters" : "••••••••"}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 text-sm font-bold rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] mt-1"
              style={{
                backgroundColor: "var(--accent-color)",
                color: "white",
              }}
            >
              {isLoading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>
        </div>

        {/* Toggle */}
        <div className="mt-6 text-center">
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  onClick={() => { setMode("register"); setError(null); }}
                  className="font-semibold hover:underline transition-colors"
                  style={{ color: "var(--accent-color)" }}
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => { setMode("login"); setError(null); }}
                  className="font-semibold hover:underline transition-colors"
                  style={{ color: "var(--accent-color)" }}
                >
                  Sign In
                </button>
              </>
            )}
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-8 opacity-30">
          Powered by bevi&amp;go
        </p>
      </div>
    </div>
  );
}
