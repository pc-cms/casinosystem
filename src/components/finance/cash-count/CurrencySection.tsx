import { formatCashDenomLabel, formatCurrency, formatNumberSpaces } from "@/lib/currency";

type QtyState = Record<string, number>;
const qKey = (wallet: string, currency: string, denom: number) => `${wallet}__${currency}__${denom}`;

export { qKey };
export type { QtyState };

export const CurrencySection = ({
  wallet, currency, denoms, rate, quantities, total, totalTzs, onChange, onRateChange,
}: {
  wallet: string;
  currency: string;
  denoms: number[];
  rate: number;
  quantities: QtyState;
  total: number;
  totalTzs: number;
  onChange: (wallet: string, currency: string, denom: number, raw: string) => void;
  onRateChange?: (currency: string, rate: number) => void;
}) => (
  <div className="border border-border rounded p-2 space-y-1">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs font-semibold text-foreground">{currency}</span>
      {currency !== "TZS" && (
        onRateChange ? (
          <label className="flex items-center gap-1 text-[9px] text-muted-foreground">
            ×
            <input
              type="number"
              className="no-spin font-mono text-[10px] h-5 w-16 rounded border border-border bg-background px-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={rate || ""}
              onChange={e => onRateChange(currency, Number(e.target.value) || 0)}
              placeholder="rate"
              inputMode="decimal"
              min={0}
              step="0.01"
            />
          </label>
        ) : (
          <span className="text-[9px] text-muted-foreground">×{formatNumberSpaces(rate)}</span>
        )
      )}
    </div>
    {denoms.map(d => {
      const qty = quantities[qKey(wallet, currency, d)] || 0;
      return (
        <div key={d} className="grid grid-cols-[3rem_1fr_auto] items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground text-right">
            {formatCashDenomLabel(d, currency)}
          </span>
          <input
            type="number"
            className="no-spin font-mono text-xs h-6 w-full rounded border border-border bg-background px-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={qty || ""}
            onChange={e => onChange(wallet, currency, d, e.target.value)}
            placeholder="0"
            inputMode="numeric"
          />
          {qty > 0 && (
            <span className="text-[8px] font-mono text-muted-foreground whitespace-nowrap">
              {formatCurrency(d * qty, currency)}
            </span>
          )}
        </div>
      );
    })}
    <div className="border-t border-border pt-1 mt-1 flex justify-between text-[10px]">
      <span className="text-muted-foreground">Total</span>
      <span className="font-mono font-semibold text-foreground">
        {formatCurrency(total, currency)}
        {currency !== "TZS" && total > 0 && (
          <span className="text-muted-foreground ml-1">≈TZS {formatNumberSpaces(totalTzs)}</span>
        )}
      </span>
    </div>
  </div>
);
