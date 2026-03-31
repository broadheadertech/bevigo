"use client";

import { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

type Role = "owner" | "manager" | "barista";

interface RoleGateProps {
  allowedRoles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on the current user's role.
 * This is cosmetic only — server-side guards in Convex functions
 * remain the source of truth for authorization (NFR11).
 */
export function RoleGate({
  allowedRoles,
  children,
  fallback = null,
}: RoleGateProps) {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;
  if (!session) return null;
  if (!allowedRoles.includes(session.role as Role)) return <>{fallback}</>;

  return <>{children}</>;
}
