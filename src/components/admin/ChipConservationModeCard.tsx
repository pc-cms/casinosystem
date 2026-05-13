import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Eye } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  useChipConservationMode,
  useUpdateChipConservationMode,
} from "@/hooks/use-chip-conservation-mode";

/**
 * Свитчер режима Chip Conservation Law (только для Manager / Super Admin).
 * - Strict: новое казино, жёсткий инвариант
 * - Observation: внедрение в работающее казино, аномалии видны в ежемесячном отчёте
 */
export const ChipConservationModeCard = () => {
  const { roles } = useAuth();
  const canEdit = roles.includes("manager") || roles.includes("super_admin");
  const { data: mode = "strict", isLoading } = useChipConservationMode();
  const update = useUpdateChipConservationMode();

  const isStrict = mode === "strict";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            {isStrict ? <Shield className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            Chip Conservation Mode
          </span>
          <Badge variant={isStrict ? "default" : "secondary"}>
            {isStrict ? "Strict" : "Observation"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="chip-cons-mode" className="text-sm font-medium">
              {isStrict ? "Strict mode" : "Observation mode"}
            </Label>
            <p className="text-xs text-muted-foreground max-w-md">
              {isStrict
                ? "New casino. Hard invariant: total chips must always equal initial baseline. Violations are blocked."
                : "Existing casino rollout. Player-held chips (Miss) are unknown at start. Anomalous returns are flagged in the monthly Miss Chips report — no operations are blocked."}
            </p>
          </div>
          <Switch
            id="chip-cons-mode"
            checked={isStrict}
            disabled={!canEdit || isLoading || update.isPending}
            onCheckedChange={(checked) =>
              update.mutate(checked ? "strict" : "observation")
            }
          />
        </div>

        {!canEdit && (
          <p className="text-xs text-muted-foreground italic">
            Only Manager can change this mode.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
