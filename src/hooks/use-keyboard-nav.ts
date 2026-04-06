import { useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Global keyboard navigation.
 * Single letter (no modifier) → navigate to section (unique first letters)
 * Alt+letter → navigate to section (when first letter conflicts)
 * Escape → close modals (handled by Radix)
 */

// Single-key shortcuts (first letter, no conflicts)
const SINGLE_SHORTCUTS: Record<string, string> = {
  b: "/blacklist",
  c: "/cage",
  d: "/",
  e: "/expenses",
  f: "/finance",
  g: "/groups",
  l: "/pit",
  p: "/players",
  r: "/reception",
  s: "/stats",
  t: "/tables",
};

// Alt+key shortcuts (conflicting first letters)
const ALT_SHORTCUTS: Record<string, string> = {
  b: "/pit?tab=breaklist",
  f: "/staff",
  g: "/in-casino",
  l: "/logs",
  r: "/reports",
  a: "/admin",
};

export const useKeyboardNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handler = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toLowerCase();

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const path = ALT_SHORTCUTS[key];
        if (path) {
          e.preventDefault();
          navigate(path);
        }
      } else if (!e.altKey && !e.ctrlKey && !e.metaKey) {
        const path = SINGLE_SHORTCUTS[key];
        if (path && path !== location.pathname) {
          e.preventDefault();
          navigate(path);
        }
      }
    },
    [navigate, location.pathname]
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
};