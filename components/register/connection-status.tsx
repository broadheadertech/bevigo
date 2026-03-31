"use client";

import { useConnectionStatus } from "@/hooks/use-connection-status";

export function ConnectionStatus() {
  const { isOnline } = useConnectionStatus();

  if (!isOnline) {
    return (
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-sm font-medium text-white">
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Offline — orders will sync when connected
      </div>
    );
  }

  return null;
}
