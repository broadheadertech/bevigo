"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Lazy-load Convex hook usage to avoid SSR prerender failure
const LoginContent = dynamic(() => import("./login-content"), { ssr: false });

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-full max-w-[400px] p-8 bg-white rounded-lg shadow-md">
            <h1 className="text-2xl font-bold text-center mb-2">bevi&amp;go</h1>
            <p className="text-gray-500 text-center mb-8">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
