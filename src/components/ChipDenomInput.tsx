/**
 * ChipDenomInput — single-column chip denomination input list.
 * Each row: [colored chip label] [input field]
 * Always shows total. Per-row values controlled by showValue.
 */
import { useRef, useCallback } from "react";
import { CHIP_DENOMS, CHIP_COLORS, formatChipLabel } from "@/lib/currency";

type Props = {
  values: Record<number, number>;
  onChange: (values: Record<number, number>) => void;
  denoms?: readonly number[];
  showValue?: boolean;
  placeholder?: Record<number, number>;
  onSubmit?: () => void;
};

const ChipDenomInput = ({ values, onChange, denoms = CHIP_DENOMS, showValue = true, placeholder, onSubmit }: Props) => {
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleChange = useCallback((denom: number, raw: string) => {
    const val = raw === "" ? 0 : parseInt(raw, 10);
    if (isNaN(val) || val < 0) return;
    onChange({ ...values, [denom]: val });
  }, [values, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextDenom = denoms[idx + 1];
      if (nextDenom !== undefined) {
        inputRefs.current[nextDenom]?.focus();
      } else {
        onSubmit?.();
      }
    }
  }, [denoms, onSubmit]);

  const total = Object.entries(values).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);

  return (
    <div>
      <div className="space-y-1">
        {denoms.map((d, idx) => {
          const val = values[d] || 0;
          const chipValue = val * d;
          return (
            <div key={d} className="flex items-center gap-1.5">
              <span className={`cms-chip text-[9px] shrink-0 ${CHIP_COLORS[d] || "bg-muted text-foreground"}`}>
                {formatChipLabel(d)}
              </span>
              <input
                ref={el => { inputRefs.current[d] = el; }}
                type="number"
                className="no-spin font-mono text-sm h-8 w-16 rounded border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={values[d] || ""}
                onChange={e => handleChange(d, e.target.value)}
                onKeyDown={e => handleKeyDown(e, idx)}
                placeholder={placeholder?.[d] !== undefined ? String(placeholder[d]) : "0"}
                inputMode="numeric"
              />
              {showValue && val > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                  ={`TZS ${chipValue.toLocaleString()}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 pt-1 mt-1 border-t border-border">
        <span className="text-xs font-medium text-muted-foreground">Total</span>
        <span className="font-mono text-sm font-bold text-card-foreground">TZS {total.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default ChipDenomInput;
