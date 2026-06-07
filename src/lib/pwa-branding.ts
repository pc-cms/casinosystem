/**
 * Typed wrapper around the global branding config defined in `public/branding.js`.
 *
 * `public/branding.js` is the single source of truth — it loads synchronously
 * in index.html BEFORE the React bundle so iOS/Android see the correct
 * PWA manifest on first parse. Do NOT duplicate the BRANCHES map here.
 */

export type BranchConfig = {
  name: string;
  manifest: string;
  favicon?: string;
  appleTouchIcon?: string;
  themeColor?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
};

export type BrandingInfo =
  | { kind: "landing" }
  | { kind: "default" }
  | {
      kind: "branch";
      label: string;
      canonical: string;
      isOnPrem: boolean;
      branch: BranchConfig;
      manifest: string;
      favicon: string;
      appleTouchIcon: string;
      displayName: string;
      themeColor?: string;
      description?: string;
      ogTitle?: string;
      ogDescription?: string;
    };

type BrandingGlobal = {
  ALIAS: Record<string, string>;
  BRANCHES: Record<string, BranchConfig>;
  ONPREM_MANIFEST: Record<string, string>;
  LANDING_HOSTS: string[];
  resolve: (hostname: string) => BrandingInfo;
};

declare global {
  interface Window {
    __cmsBranding?: BrandingGlobal;
    __cmsApplyBranding?: () => void;
  }
}

const empty: BrandingGlobal = {
  ALIAS: {},
  BRANCHES: {},
  ONPREM_MANIFEST: [] as unknown as Record<string, string>,
  LANDING_HOSTS: [],
  resolve: () => ({ kind: "default" }),
};

/** Access the global branding config. Falls back to empty in SSR/tests. */
export function getBrandingConfig(): BrandingGlobal {
  if (typeof window !== "undefined" && window.__cmsBranding) return window.__cmsBranding;
  return empty;
}

/** Resolve branding for an arbitrary hostname (defaults to current host). */
export function resolveBranding(hostname?: string): BrandingInfo {
  const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  return getBrandingConfig().resolve(host);
}

/** Re-apply branding to document.head (useful after dynamic host changes in tests). */
export function applyBranding(): void {
  if (typeof window !== "undefined" && window.__cmsApplyBranding) window.__cmsApplyBranding();
}
