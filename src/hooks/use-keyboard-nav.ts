import { useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const SHORTCUTS: Record<string, string> = {
  d: "/",
  p: "/players",
  c: "/cage",
  t: "/tables",
  e: "/expenses",
  i: "/pit",
  g: "/groups",
  k: "/tracker",
  s: "/stats",
  l: "/logs",
};

/**
 * Global keyboard navigation.
 * Alt+key → navigate to section
 * Escape → close modals (handled by Radix)
 */
export const useKeyboardNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handler = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Alt+key navigation
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        const path = SHORTCUTS[key];
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
