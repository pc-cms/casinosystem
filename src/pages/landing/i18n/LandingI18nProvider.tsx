import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en, type Dict } from "./en";
import { es } from "./es";
import { ru } from "./ru";

export type Lang = "en" | "es" | "ru";

const DICTS: Record<Lang, Dict> = { en, es, ru };

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}

const LandingI18nCtx = createContext<Ctx | null>(null);

const STORAGE_KEY = "landing.lang.manual";

/**
 * Default language is ALWAYS English. We never auto-detect from the browser
 * locale. We only restore a language if the user manually picked one in a
 * previous session (persisted under "landing.lang.manual").
 */
function detectInitial(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && saved in DICTS) return saved;
  } catch {
    /* ignore */
  }
  return "en";
}

export function LandingI18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitial);

  // Only mirror to document.lang. We do NOT persist here — persistence
  // happens exclusively when the user manually invokes `setLang` below.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    setLangState(l);
  };

  const value = useMemo<Ctx>(
    () => ({ lang, setLang, t: DICTS[lang] }),
    [lang],
  );

  return <LandingI18nCtx.Provider value={value}>{children}</LandingI18nCtx.Provider>;
}

export function useLandingI18n(): Ctx {
  const v = useContext(LandingI18nCtx);
  if (!v) throw new Error("useLandingI18n must be used inside LandingI18nProvider");
  return v;
}
