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

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-4">
            <svg className="w-12 h-12" viewBox="0 0 100 100" fill="none">
              <ellipse cx="50" cy="50" rx="38" ry="30" fill="#7C3A12" transform="rotate(-30 50 50)" />
              <path d="M30 45 Q50 35 70 50" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100 tracking-tight" style={{ fontStyle: "italic" }}>bevi&amp;go</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            {mode === "login" ? "Welcome back" : "Create your shop"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "register" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-shadow"
                    placeholder="Juan Dela Cruz"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                    Shop Name
                  </label>
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-800 rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-shadow"
                    placeholder="My Coffee Shop"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-shadow"
                placeholder="owner@coffeeshop.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-shadow"
                placeholder={mode === "register" ? "Min 6 characters" : ""}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 active:bg-amber-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm mt-1"
            >
              {isLoading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>
        </div>

        <div className="mt-5 text-center">
          {mode === "login" ? (
            <p className="text-sm text-stone-500">
              Don&apos;t have an account?{" "}
              <button
                onClick={() => { setMode("register"); setError(null); }}
                className="text-amber-600 hover:text-amber-700 font-semibold"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p className="text-sm text-stone-500">
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(null); }}
                className="text-amber-600 hover:text-amber-700 font-semibold"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
