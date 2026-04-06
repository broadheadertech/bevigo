"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PinPad } from "@/components/register/pin-pad";
import { useAuth } from "@/lib/auth-context";

export default function PinLockPage() {
  const router = useRouter();
  const { session, token } = useAuth();
  const pinSwitch = useAction(api.auth.pinSwitch.pinSwitch);

  // Get first assigned location
  const locationId = useMemo(() => {
    const ids = session?.locationIds as string[] | undefined;
    return ids?.[0] ?? "";
  }, [session]);

  const handleSuccess = useCallback(
    (result: { token: string; userName: string; role: string }) => {
      // Update session cookie with new token
      document.cookie = `session_token=${result.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
      // Signal to the register layout to unlock
      sessionStorage.setItem("pin-unlock", Date.now().toString());
      router.push("/order");
    },
    [router]
  );

  const handleRequireFullLogin = useCallback(() => {
    router.push("/login");
  }, [router]);

  const handlePinSubmit = useCallback(
    async (args: { token: string; locationId: string; pin: string }) => {
      try {
        const result = await pinSwitch({
          token: token ?? args.token,
          locationId: args.locationId || locationId,
          pin: args.pin,
        });
        return result;
      } catch (err) {
        return {
          success: false as const,
          locked: false as const,
          attemptsRemaining: 3,
        };
      }
    },
    [pinSwitch, token, locationId]
  );

  return (
    <PinPad
      locationId={locationId}
      locationName={session?.userName ? `Welcome back` : "Register"}
      sessionToken={token ?? ""}
      onSuccess={handleSuccess}
      onRequireFullLogin={handleRequireFullLogin}
      onPinSubmit={handlePinSubmit}
    />
  );
}
