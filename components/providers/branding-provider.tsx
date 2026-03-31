"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useRef,
  useEffect,
} from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";

type BrandingValues = {
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
};

const DEFAULT_BRANDING: BrandingValues = {
  brandName: "",
  logoUrl: "",
  primaryColor: "#7C3A12",
  accentColor: "#D97706",
};

const BrandingContext = createContext<BrandingValues>(DEFAULT_BRANDING);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const branding = useQuery(
    api.settings.queries.getBranding,
    token ? { token } : "skip"
  );

  const cssAppliedRef = useRef(false);

  const values: BrandingValues = branding
    ? {
        brandName: branding.brandName,
        logoUrl: branding.brandLogoUrl,
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
      }
    : DEFAULT_BRANDING;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", values.primaryColor);
    root.style.setProperty("--brand-accent", values.accentColor);
    cssAppliedRef.current = true;
  }, [values.primaryColor, values.accentColor]);

  return (
    <BrandingContext.Provider value={values}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
