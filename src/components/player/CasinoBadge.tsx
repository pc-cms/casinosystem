import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CasinoBadgeProps {
  casinoId: string;
  className?: string;
}

/** Cache of all casino codes — shared across all badge instances */
const useCasinoCodes = () => {
  return useQuery({
    queryKey: ["casino-codes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("casinos")
        .select("id, code, name");
      return data ?? [];
    },
    staleTime: 1000 * 60 * 30, // 30 min cache
  });
};

/**
 * Shows a small badge with the casino code (ARU, DOD, MBY, MWZ)
 * indicating where the player was registered.
 */
const CasinoBadge = ({ casinoId, className }: CasinoBadgeProps) => {
  const { data: casinos = [] } = useCasinoCodes();
  const casino = casinos.find(c => c.id === casinoId);
  
  if (!casino) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold",
        "bg-accent/50 text-accent-foreground/70 border border-border/50",
        className
      )}
      title={`Registered at ${casino.name}`}
    >
      {casino.code}
    </span>
  );
};

export default CasinoBadge;
