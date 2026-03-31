import { cookies } from "next/headers";
import { ReactNode } from "react";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value ?? null;

  return <DashboardShell token={token}>{children}</DashboardShell>;
}
