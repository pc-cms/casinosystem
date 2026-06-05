/**
 * Per-page casino selector for Finance pages.
 * Renders only for FM/super_admin on `premier` subdomain or with multi-casino access.
 * Allows drilling into a single casino from network view, or back to Network (null).
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCasino } from "@/lib/casino-context";
import { useAuth } from "@/lib/auth-context";

export default function FinanceCasinoSwitcher({ allowNetwork = true }: { allowNetwork?: boolean }) {
  const { accessibleCasinos, activeCasinoId, switchCasino, isSummaryMode, detectedSlug } = useCasino();
  const { roles } = useAuth();
  const isFmOrAdmin = roles.includes("super_admin") || roles.includes("finance_manager");

  // Only show on premier (network mode) for FM/super_admin, or if user has multiple casinos
  const showOnPremier = detectedSlug === "__premier__" && isFmOrAdmin;
  const showMulti = accessibleCasinos.length > 1 && isFmOrAdmin;
  if (!showOnPremier && !showMulti) return null;

  const value = isSummaryMode || !activeCasinoId ? "__all__" : activeCasinoId;

  return (
    <Select
      value={value}
      onValueChange={(v) => switchCasino(v === "__all__" ? null : v)}
    >
      <SelectTrigger className="w-44 h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowNetwork && <SelectItem value="__all__">All casinos (Network)</SelectItem>}
        {accessibleCasinos.map((c) => (
          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
