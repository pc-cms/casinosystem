import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { prefetchPitData } from "@/lib/pit-prefetch";
import { InstallPWAButton } from "@/components/InstallPWAButton";

/**
 * Wraps Pit module pages: warms the cache on mount and surfaces
 * the install button + network indicator in the corner.
 */
export const PitShell = ({ children }: { children: React.ReactNode }) => {
  const { casinoId } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!casinoId) return;
    prefetchPitData(qc, casinoId).catch(() => { /* offline / ignore */ });
  }, [casinoId, qc]);

  return (
    <>
      <div className="fixed top-2 right-2 z-40 flex items-center gap-1.5 no-print">
        <InstallPWAButton label="Install Pit" />
      </div>
      {children}
    </>
  );
};
