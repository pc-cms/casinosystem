/**
 * Casino context — resolves current casino from subdomain or user profile.
 * 
 * Subdomain routing:
 *   arusha.casinosystem.app → slug = "arusha"
 *   dodoma.casinosystem.app → slug = "dodoma"
 *   localhost / IP → fallback to user's primary casino
 * 
 * For super_admin/finance_manager accessing summary.casinosystem.app → casinoId = null (all casinos)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type CasinoInfo = {
  id: string;
  name: string;
  slug: string | null;
  code: string;
};

type CasinoContextState = {
  /** Current active casino (null = summary/all-casinos mode) */
  activeCasinoId: string | null;
  activeCasino: CasinoInfo | null;
  /** All casinos the user has access to */
  accessibleCasinos: CasinoInfo[];
  /** Whether the user is in summary mode (FM/super_admin viewing all) */
  isSummaryMode: boolean;
  /** Switch to a different casino */
  switchCasino: (casinoId: string | null) => void;
  /** Detected slug from subdomain */
  detectedSlug: string | null;
  loading: boolean;
};

const CasinoContext = createContext<CasinoContextState | null>(null);

export const useCasino = () => {
  const ctx = useContext(CasinoContext);
  if (!ctx) throw new Error("useCasino must be within CasinoProvider");
  return ctx;
};

/** Extract casino slug from current hostname */
export const getSlugFromHostname = (): string | null => {
  const hostname = window.location.hostname;

  // Production: arusha.casinosystem.app
  const match = hostname.match(/^([a-z0-9-]+)\.(casinosystem\.app|casinosystem\.local)$/i);
  if (match) {
    const slug = match[1].toLowerCase();
    // Exclude known non-casino subdomains
    if (["www", "api", "admin"].includes(slug)) return null;
    if (slug === "premier") return "__premier__";
    return slug;
  }

  // Root domain casinosystem.app (no subdomain) → landing page
  if (/^(www\.)?casinosystem\.(app|local)$/i.test(hostname)) {
    return "__landing__";
  }

  // Preview/dev: check query param ?casino=arusha as fallback
  const params = new URLSearchParams(window.location.search);
  const casinoParam = params.get("casino");
  if (casinoParam) return casinoParam.toLowerCase();

  // Localhost / IP — no subdomain, use user's primary casino
  return null;
};

export const CasinoProvider = ({ children }: { children: ReactNode }) => {
  const { user, roles, casinoId: primaryCasinoId } = useAuth();
  const [accessibleCasinos, setAccessibleCasinos] = useState<CasinoInfo[]>([]);
  const [activeCasinoId, setActiveCasinoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detectedSlug] = useState<string | null>(() => getSlugFromHostname());

  const isSuperOrFM = roles.includes("super_admin") || roles.includes("finance_manager");
  const isSummaryMode = detectedSlug === "__premier__" && isSuperOrFM;

  // Fetch accessible casinos
  useEffect(() => {
    if (!user) {
      setAccessibleCasinos([]);
      setActiveCasinoId(null);
      setLoading(false);
      return;
    }

    const fetchCasinos = async () => {
      setLoading(true);

      if (isSuperOrFM) {
        // Super admin and FM see all casinos
        const { data } = await supabase
          .from("casinos")
          .select("id, name, slug, code")
          .order("name");
        setAccessibleCasinos((data as CasinoInfo[]) ?? []);
      } else {
        // Regular users: primary casino + granted access
        const { data: access } = await supabase
          .from("user_casino_access")
          .select("casino_id")
          .eq("user_id", user.id);

        const casinoIds = new Set<string>();
        if (primaryCasinoId) casinoIds.add(primaryCasinoId);
        access?.forEach(a => casinoIds.add(a.casino_id));

        if (casinoIds.size > 0) {
          const { data } = await supabase
            .from("casinos")
            .select("id, name, slug, code")
            .in("id", Array.from(casinoIds))
            .order("name");
          setAccessibleCasinos((data as CasinoInfo[]) ?? []);
        }
      }

      setLoading(false);
    };

    fetchCasinos();
  }, [user, primaryCasinoId, isSuperOrFM]);

  // Resolve active casino from slug or primary
  useEffect(() => {
    if (loading || accessibleCasinos.length === 0) return;

    if (isSummaryMode) {
      setActiveCasinoId(null);
      return;
    }

    if (detectedSlug && detectedSlug !== "__premier__" && detectedSlug !== "__landing__") {
      const matched = accessibleCasinos.find(c => c.slug === detectedSlug);
      if (matched) {
        setActiveCasinoId(matched.id);
        return;
      }
    }

    // Fallback to primary casino
    if (primaryCasinoId) {
      setActiveCasinoId(primaryCasinoId);
    } else if (accessibleCasinos.length > 0) {
      setActiveCasinoId(accessibleCasinos[0].id);
    }
  }, [loading, accessibleCasinos, detectedSlug, primaryCasinoId, isSummaryMode]);

  const switchCasino = useCallback((casinoId: string | null) => {
    setActiveCasinoId(casinoId);
  }, []);

  const activeCasino = accessibleCasinos.find(c => c.id === activeCasinoId) ?? null;

  return (
    <CasinoContext.Provider value={{
      activeCasinoId,
      activeCasino,
      accessibleCasinos,
      isSummaryMode,
      switchCasino,
      detectedSlug,
      loading,
    }}>
      {children}
    </CasinoContext.Provider>
  );
};
