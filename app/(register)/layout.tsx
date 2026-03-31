"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useIdleLock } from "@/hooks/use-idle-lock";
import { ConnectionStatus } from "@/components/register/connection-status";
import { InstallPrompt } from "@/components/register/install-prompt";
import { AuthProvider } from "@/lib/auth-context";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLocked, lock } = useIdleLock();
  const token = useMemo(() => getCookie("session_token"), []);

  useEffect(() => {
    if (!token) {
      router.push("/login");
    }
  }, [token, router]);

  useEffect(() => {
    if (isLocked && pathname !== "/pin-lock") {
      router.push("/pin-lock");
    }
  }, [isLocked, pathname, router]);

  return (
    <AuthProvider token={token}>
      <div className="relative h-screen w-screen overflow-hidden bg-stone-100">
        <ConnectionStatus />
        <button
          onClick={() => lock()}
          className="absolute top-3 right-3 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-200 text-stone-600 hover:bg-stone-300 transition-colors"
          aria-label="Lock register"
          title="Lock register"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </button>
        {children}
        <InstallPrompt />
      </div>
    </AuthProvider>
  );
}
