/**
 * BrandingProvider — applies per-casino primary + accent HSL overrides.
 *
 * Reads `brand_primary_hsl`, `brand_accent_hsl`, `logo_url` from the active casino
 * (joined by activeCasinoId via CasinoContext) and patches CSS vars on <html>.
 *
 * HSL format expected: "H S% L%" (e.g. "38 55% 72%") to match index.css tokens.
 * If invalid or null, falls back to the default theme — no crash.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCasino } from "@/lib/casino-context";

type BrandingState = {
  logoUrl: string | null;
  primaryHsl: string | null;
  accentHsl: string | null;
};

const BrandingContext = createContext<BrandingState>({ logoUrl: null, primaryHsl: null, accentHsl: null });
export const useBranding = () => useContext(BrandingContext);

const HSL_RE = /^\s*\d{1,3}\s+\d{1,3}%\s+\d{1,3}%\s*$/;
const isValidHsl = (v: string | null | undefined): v is string => !!v && HSL_RE.test(v);

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const { activeCasinoId } = useCasino();
  const [state, setState] = useState<BrandingState>({ logoUrl: null, primaryHsl: null, accentHsl: null });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!activeCasinoId) {
        setState({ logoUrl: null, primaryHsl: null, accentHsl: null });
        return;
      }
      const { data } = await supabase
        .from("casinos")
        .select("brand_primary_hsl, brand_accent_hsl, logo_url")
        .eq("id", activeCasinoId)
        .maybeSingle();
      if (cancelled) return;
      const row = (data ?? {}) as { brand_primary_hsl?: string | null; brand_accent_hsl?: string | null; logo_url?: string | null };
      setState({
        logoUrl: row.logo_url ?? null,
        primaryHsl: isValidHsl(row.brand_primary_hsl) ? row.brand_primary_hsl! : null,
        accentHsl: isValidHsl(row.brand_accent_hsl) ? row.brand_accent_hsl! : null,
      });
    };
    load();
    return () => { cancelled = true; };
  }, [activeCasinoId]);

  // Apply CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const apply = (name: string, val: string | null) => {
      if (val) root.style.setProperty(name, val);
      else root.style.removeProperty(name);
    };
    apply("--primary", state.primaryHsl);
    apply("--ring", state.primaryHsl);
    apply("--sidebar-primary", state.primaryHsl);
    apply("--sidebar-ring", state.primaryHsl);
    apply("--accent", state.accentHsl);
    return () => {
      // On unmount restore defaults
      ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring", "--accent"].forEach(v => root.style.removeProperty(v));
    };
  }, [state.primaryHsl, state.accentHsl]);

  const value = useMemo(() => state, [state]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};
