"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { PinPad } from "@/components/register/pin-pad";

/**
 * PIN Lock Screen
 *
 * Displayed when a register session is locked (idle timeout or manual lock).
 * Uses the PinPad component for PIN entry. In a full integration, the
 * locationId, locationName, and sessionToken would come from session context
 * or URL search params.
 */
export default function PinLockPage() {
  const router = useRouter();

  // In production, these values come from session/device context.
  // For now, read from URL search params as a passthrough mechanism.
  const locationId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("locationId") ?? ""
      : "";
  const locationName =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("locationName") ??
        "Register"
      : "Register";
  const sessionToken =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token") ?? ""
      : "";

  const handleSuccess = useCallback(
    (result: { token: string; userName: string; role: string }) => {
      // Store the new session token (in production, set as httpOnly cookie via API)
      // For now, store in sessionStorage and redirect back to register
      if (typeof window !== "undefined") {
        sessionStorage.setItem("session_token", result.token);
        sessionStorage.setItem("active_user", result.userName);
        sessionStorage.setItem("active_role", result.role);
      }
      router.push("/");
    },
    [router]
  );

  const handleRequireFullLogin = useCallback(() => {
    router.push("/login");
  }, [router]);

  const handlePinSubmit = useCallback(
    async (args: { token: string; locationId: string; pin: string }) => {
      // In production, this calls the Convex action directly via useAction.
      // This page acts as a thin wrapper; the actual Convex call is wired
      // when the Convex provider is integrated at the layout level.
      //
      // For build compatibility without Convex _generated types, we use
      // a fetch-style call pattern that will be replaced with useAction
      // once the Convex provider is set up.
      const response = await fetch("/api/pin-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        throw new Error("PIN verification failed");
      }

      return response.json();
    },
    []
  );

  return (
    <PinPad
      locationId={locationId}
      locationName={locationName}
      sessionToken={sessionToken}
      onSuccess={handleSuccess}
      onRequireFullLogin={handleRequireFullLogin}
      onPinSubmit={handlePinSubmit}
    />
  );
}
