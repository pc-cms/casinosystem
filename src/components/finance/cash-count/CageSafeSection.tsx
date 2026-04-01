import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CASH_DENOMS, formatCashDenomLabel, formatCurrency, formatNumberSpaces } from "@/lib/currency";
import { Vault } from "lucide-react";

const TZS_DENOMS = CASH_DENOMS["TZS"] || [];

export interface CageSafeState {
  slot: Record<number, number>;
  table: Record<number, number>;
}

export const emptyCageSafe = (): CageSafeState => ({ slot: {}, table: {} });

export const getCageSlotTotal = (s: CageSafeState) =>
  TZS_DENOMS.reduce((sum, d) => sum + d * (s.slot[d] || 0), 0);

export const getCageTableTotal = (s: CageSafeState) =>
  TZS_DENOMS.reduce((sum, d) => sum + d * (s.table[d] || 0), 0);

export const CageSafeSection = ({
  state,
  onChange,
}: {
  state: CageSafeState;
  onChange: (next: CageSafeState) => void;
}) => {
  const slotTotal = getCageSlotTotal(state);
  const tableTotal = getCageTableTotal(state);
  const cageTotal = slotTotal + tableTotal;

  const handleChange = (sub: "slot" | "table", denom: number, raw: string) => {
    const val = raw === "" ? 0 : parseInt(raw, 10);
    if (isNaN(val) || val < 0) return;
    onChange({ ...state, [sub]: { ...state[sub], [denom]: val } });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Vault className="w-4 h-4" /> Cage Safe
          </CardTitle>
          <span className="font-mono text-xs font-semibold text-foreground">
            TZS {formatNumberSpaces(cageTotal)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DenomBlock label="Slot" values={state.slot} total={slotTotal} onChange={(d, r) => handleChange("slot", d, r)} />
          <DenomBlock label="Table" values={state.table} total={tableTotal} onChange={(d, r) => handleChange("table", d, r)} />
        </div>
      </CardContent>
    </Card>
  );
};

const DenomBlock = ({
  label, values, total, onChange,
}: {
  label: string;
  values: Record<number, number>;
  total: number;
  onChange: (denom: number, raw: string) => void;
}) => (
  <div className="border border-border rounded p-2 space-y-1">
    <span className="text-xs font-semibold text-foreground">{label}</span>
    {TZS_DENOMS.map(d => {
      const qty = values[d] || 0;
      return (
        <div key={d} className="grid grid-cols-[3rem_1fr_auto] items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground text-right">
            {formatCashDenomLabel(d, "TZS")}
          </span>
          <input
            type="number"
            className="no-spin font-mono text-xs h-6 w-full rounded border border-border bg-background px-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={qty || ""}
            onChange={e => onChange(d, e.target.value)}
            placeholder="0"
            inputMode="numeric"
          />
          {qty > 0 && (
            <span className="text-[8px] font-mono text-muted-foreground whitespace-nowrap">
              {formatCurrency(d * qty, "TZS")}
            </span>
          )}
        </div>
      );
    })}
    <div className="border-t border-border pt-1 mt-1 flex justify-between text-[10px]">
      <span className="text-muted-foreground">Total</span>
      <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(total)}</span>
    </div>
  </div>
);
