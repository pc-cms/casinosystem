import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useChipConservation } from "@/hooks/use-chip-conservation";
import { useChipConservationMode } from "@/hooks/use-chip-conservation-mode";
import { formatNumberSpaces, formatChipLabel } from "@/lib/currency";
import ChipToken from "@/components/ChipToken";
import { CheckCircle2, AlertTriangle, Coins, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Live статус закона сохранения фишек.
 * Initial = In Locations + Live Floor + Archived Miss
 */
export const ChipConservationCard = ({ compact = false }: { compact?: boolean }) => {
  const { data: rows = [], isLoading } = useChipConservation();
  const { data: mode = "strict" } = useChipConservationMode();
  const isObservation = mode === "observation";

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Coins className="h-4 w-4" /> Chip Conservation
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  if (!rows.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Coins className="h-4 w-4" /> Chip Conservation
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Initial baseline not set. Configure in Chip Inventory.
        </CardContent>
      </Card>
    );
  }

  const totalInitial = rows.reduce((s, r) => s + r.initial_quantity * r.denomination, 0);
  const totalInLocations = rows.reduce((s, r) => s + r.in_locations * r.denomination, 0);
  const totalMiss = rows.reduce((s, r) => s + r.archived_miss * r.denomination, 0);
  const totalFloor = rows.reduce((s, r) => s + r.live_floor * r.denomination, 0);
  const delta = totalInitial - totalInLocations - totalFloor - totalMiss;
  const ok = delta === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Coins className="h-4 w-4" /> Chip Conservation
          </span>
          <Badge variant={isObservation ? "secondary" : ok ? "default" : "destructive"} className="gap-1">
            {isObservation ? <Eye className="h-3 w-3" /> : ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {isObservation ? "Observation" : ok ? "Balanced" : "Mismatch"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!compact && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-1">Denom</th>
                  <th className="text-right py-1">Initial</th>
                  <th className="text-right py-1">Locations</th>
                  <th className="text-right py-1">Floor</th>
                  <th className="text-right py-1">Miss</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.denomination} className="border-b border-border/40">
                    <td className="py-1">{formatChipLabel(r.denomination)}</td>
                    <td className="text-right py-1">{formatNumberSpaces(r.initial_quantity)}</td>
                    <td className="text-right py-1">{formatNumberSpaces(r.in_locations)}</td>
                    <td className={cn("text-right py-1", r.live_floor > 0 && "text-amber-500", r.live_floor < 0 && "text-cms-amount-negative")}>
                      {formatNumberSpaces(r.live_floor)}
                    </td>
                    <td className="text-right py-1 text-muted-foreground">{formatNumberSpaces(r.archived_miss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Initial:</span>
            <span>{formatNumberSpaces(totalInitial)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Locations:</span>
            <span>{formatNumberSpaces(totalInLocations)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Floor (live):</span>
            <span className={cn(totalFloor > 0 && "text-amber-500", totalFloor < 0 && "text-cms-amount-negative")}>
              {formatNumberSpaces(totalFloor)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Miss (archive):</span>
            <span>{formatNumberSpaces(totalMiss)}</span>
          </div>
          <div className="col-span-2 flex justify-between pt-1 border-t border-border/60">
            <span className="font-semibold">Delta:</span>
            <span className={cn(
              "font-semibold",
              isObservation ? "text-muted-foreground" : ok ? "text-cms-amount-positive" : "text-cms-amount-negative"
            )}>
              {formatNumberSpaces(delta)} TZS
            </span>
          </div>
          {isObservation && (
            <div className="col-span-2 text-[10px] text-muted-foreground italic pt-1">
              Observation mode — anomalies tracked in monthly Miss Chips report.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
