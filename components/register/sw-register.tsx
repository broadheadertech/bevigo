"use client";

import { useServiceWorker } from "@/hooks/use-service-worker";

export function SWRegister() {
  useServiceWorker();
  return null;
}
