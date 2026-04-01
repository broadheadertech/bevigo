"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Lazy-load Convex hook usage to avoid SSR prerender failure
const LoginContent = dynamic(() => import("./login-content"), { ssr: false });

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)' }}>
          <div className="w-full max-w-sm p-8 rounded-2xl" style={{ backgroundColor: 'var(--card)', borderWidth: '1px', borderColor: 'var(--border-color)' }}>
            <h1 className="text-2xl font-semibold text-center mb-2" style={{ fontStyle: "italic", color: 'var(--fg)' }}>bevi&amp;go</h1>
            <p className="text-center mb-8" style={{ color: 'var(--muted-fg)' }}>Loading...</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
