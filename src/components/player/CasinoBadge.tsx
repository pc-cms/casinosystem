import { cn } from "@/lib/utils";
import { useCasino } from "@/lib/casino-context";

interface CasinoBadgeProps {
  casinoId: string;
  className?: string;
}

/**
 * Shows a small badge with the casino code (ARU, DOD, MBY, MWZ)
 * indicating where the player was registered.
 */
const CasinoBadge = ({ casinoId, className }: CasinoBadgeProps) => {
  const { accessibleCasinos } = useCasino();
  const casino = accessibleCasinos.find(c => c.id === casinoId);
  
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
