import { useRef } from "react";
import { formatCashDenomLabel, CURRENCY_SYMBOLS, formatNumberSpaces } from "@/lib/currency";

const cashSum = (cash: Record<number, number>) =>
  Object.entries(cash).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);

const CashDenomInput = ({ values, onChange, denoms, currency, onSubmit }: {
  values: Record<number, number>;
  onChange: (v: Record<number, number>) => void;
  denoms: number[];
  currency: string;
  onSubmit?: () => void;
}) => {
  const refs = useRef<Record<number, HTMLInputElement | null>>({});
  const total = cashSum(values);

  return (
    <div>
      <div className="space-y-1">
      {denoms.map((d, idx) => (
        <div key={d} className="flex items-center justify-between gap-2">
          <span className="cms-chip text-[10px] bg-muted text-foreground h-7 w-16 shrink-0 justify-center">
            {formatCashDenomLabel(d, currency)}
          </span>
          <input
            ref={el => { refs.current[d] = el; }}
            type="number"
            className="no-spin font-mono text-sm h-9 w-24 rounded border border-border bg-background px-2 text-right text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={values[d] || ""}
            onChange={e => onChange({ ...values, [d]: Number(e.target.value) || 0 })}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                const next = denoms[idx + 1];
                if (next !== undefined) refs.current[next]?.focus();
                else onSubmit?.();
              }
            }}
            placeholder="0"
            inputMode="numeric"
          />
        </div>
      ))}
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-border">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total</span>
        <span className="font-mono text-base font-bold text-card-foreground whitespace-nowrap">
          {currency === "TZS" ? `TZS ${formatNumberSpaces(total)}` : `${CURRENCY_SYMBOLS[currency] || currency}${formatNumberSpaces(total)}`}
        </span>
      </div>
    </div>
  );
};

export { cashSum };
export default CashDenomInput;
