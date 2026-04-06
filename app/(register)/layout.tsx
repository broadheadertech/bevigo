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
  const { isLocked, lock, unlock } = useIdleLock();
  const token = useMemo(() => getCookie("session_token"), []);

  useEffect(() => {
    if (!token) {
      router.push("/login");
    }
  }, [token, router]);

  // Check for PIN unlock signal — runs every time isLocked or pathname changes
  useEffect(() => {
    const unlockSignal = sessionStorage.getItem("pin-unlock");
    if (unlockSignal) {
      sessionStorage.removeItem("pin-unlock");
      unlock();
      return; // Don't redirect — we just unlocked
    }
    if (isLocked && pathname !== "/pin-lock") {
      router.push("/pin-lock");
    }
  }, [isLocked, pathname, router, unlock]);

  return (
    <AuthProvider token={token}>
      <div className="relative h-screen w-screen overflow-hidden bg-stone-100 dark:bg-stone-950">
        <ConnectionStatus />
        {children}
        <InstallPrompt />
      </div>
    </AuthProvider>
  );
}
