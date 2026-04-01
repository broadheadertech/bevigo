"use client";

import { useTheme } from "@/hooks/use-theme";

export function ThemeApplier() {
  // This hook applies the dark class to <html> via its subscribe function
  useTheme();
  return null;
}
