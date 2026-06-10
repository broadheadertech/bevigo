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

type Entitlements = {
  planSlug: string | null;
  planName: string;
  hidePoweredBy: boolean;
  customDomain: boolean;
  brandedEmails: boolean;
};

type BrandingValues = {
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  entitlements: Entitlements;
};

const DEFAULT_ENTITLEMENTS: Entitlements = {
  planSlug: null,
  planName: "No Plan",
  hidePoweredBy: false,
  customDomain: false,
  brandedEmails: false,
};

const DEFAULT_BRANDING: BrandingValues = {
  brandName: "",
  logoUrl: "",
  primaryColor: "#7C3A12",
  accentColor: "#D97706",
  entitlements: DEFAULT_ENTITLEMENTS,
};

const BrandingContext = createContext<BrandingValues>(DEFAULT_BRANDING);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const branding = useQuery(
    api.settings.queries.getBranding,
    token ? { token } : "skip"
  );
  const entitlements = useQuery(
    api.billing.queries.getEntitlements,
    token ? { token } : "skip"
  ) as Entitlements | undefined;

  const cssAppliedRef = useRef(false);

  const values: BrandingValues = branding
    ? {
        brandName: branding.brandName,
        logoUrl: branding.brandLogoUrl,
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
        entitlements: entitlements ?? DEFAULT_ENTITLEMENTS,
      }
    : { ...DEFAULT_BRANDING, entitlements: entitlements ?? DEFAULT_ENTITLEMENTS };

  useEffect(() => {
    const root = document.documentElement;
    // Expose the brand colors as explicit vars too, for any future code
    // that wants to differentiate "brand color" from "current accent."
    root.style.setProperty("--brand-primary", values.primaryColor);
    root.style.setProperty("--brand-accent", values.accentColor);
    // The dashboard's themed components all read --accent-color (and
    // --ring-color for focus outlines). Setting them on documentElement
    // beats both the :root and .dark rules in globals.css, so tenants
    // get their accent in both light and dark mode without a separate
    // dark-mode override. --accent-fg stays at the theme default —
    // computing contrast-aware fg from an arbitrary HSL is a deeper
    // change; if a tenant picks neon yellow, white text on it is on
    // them.
    root.style.setProperty("--accent-color", values.accentColor);
    root.style.setProperty("--ring-color", values.accentColor);
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
