import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

export type DensityMode = "auto" | "comfort" | "compact" | "touch";
export type DensityEffective = "comfort" | "compact" | "touch";

type Ctx = {
  mode: DensityMode;
  effective: DensityEffective;
  setMode: (m: DensityMode) => void;
};

const DensityContext = createContext<Ctx>({
  mode: "auto",
  effective: "comfort",
  setMode: () => {},
});

export const useDensity = () => useContext(DensityContext);

const STORAGE_KEY = "cms.density";

const isCoarsePointer = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(pointer: coarse)").matches;

const roleDefault = (roles: string[]): DensityEffective => {
  if (isCoarsePointer()) return "touch";
  // Unified default: comfort for ALL roles (user decision, design tour).
  // Override per-user via Profile dialog.
  void roles;
  return "comfort";
};

export const DensityProvider = ({ children }: { children: ReactNode }) => {
  const { roles } = useAuth();

  const [mode, setModeState] = useState<DensityMode>(() => {
    if (typeof window === "undefined") return "auto";
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "comfort" || v === "compact" || v === "touch" || v === "auto" ? v : "auto";
  });

  const effective: DensityEffective = useMemo(
    () => (mode === "auto" ? roleDefault(roles) : mode),
    [mode, roles]
  );

  useEffect(() => {
    document.documentElement.dataset.density = effective;
  }, [effective]);

  const setMode = (m: DensityMode) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* ignore */ }
  };

  return (
    <DensityContext.Provider value={{ mode, effective, setMode }}>
      {children}
    </DensityContext.Provider>
  );
};
