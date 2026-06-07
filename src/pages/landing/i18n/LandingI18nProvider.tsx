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

const STORAGE_KEY = "landing.lang";

function detectInitial(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (saved && saved in DICTS) return saved;
  const nav = window.navigator.language?.slice(0, 2).toLowerCase();
  if (nav === "es" || nav === "ru") return nav;
  return "en";
}

export function LandingI18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<Ctx>(
    () => ({ lang, setLang: setLangState, t: DICTS[lang] }),
    [lang],
  );

  return <LandingI18nCtx.Provider value={value}>{children}</LandingI18nCtx.Provider>;
}

export function useLandingI18n(): Ctx {
  const v = useContext(LandingI18nCtx);
  if (!v) throw new Error("useLandingI18n must be used inside LandingI18nProvider");
  return v;
}
