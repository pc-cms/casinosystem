/**
 * ChipDenomInput — chip denomination input list with configurable columns and size.
 * Supports per-casino color overrides via use-chip-colors hook.
 */
import { useRef, useCallback } from "react";
import { CHIP_DENOMS, formatChipLabel, formatNumberSpaces } from "@/lib/currency";
import { useChipColors, resolveChipColor } from "@/hooks/use-chip-colors";

type Size = "sm" | "md" | "lg";

type Props = {
  values: Record<number, number>;
  onChange: (values: Record<number, number>) => void;
  denoms?: readonly number[];
  showValue?: boolean;
  placeholder?: Record<number, number>;
  onSubmit?: () => void;
  /** Number of columns (1, 2 or 3). Default 1. */
  columns?: 1 | 2 | 3;
  /** Visual size of chip + input. Default "sm". */
  size?: Size;
};

const SIZE_TOKENS: Record<Size, { chipH: string; chipW: string; inputH: string; chipText: string; inputText: string }> = {
  sm: { chipH: "h-6",  chipW: "w-14", inputH: "h-6",  chipText: "text-[8px]",  inputText: "text-xs"  },
  md: { chipH: "h-8",  chipW: "w-16", inputH: "h-8",  chipText: "text-[10px]", inputText: "text-sm"  },
  lg: { chipH: "h-10", chipW: "w-20", inputH: "h-10", chipText: "text-xs",     inputText: "text-base" },
};

const ChipDenomInput = ({
  values,
  onChange,
  denoms = CHIP_DENOMS,
  showValue = true,
  placeholder,
  onSubmit,
  columns = 1,
  size = "sm",
}: Props) => {
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const { data: colorOverrides } = useChipColors();
  const tokens = SIZE_TOKENS[size];

  const handleChange = useCallback((denom: number, raw: string) => {
    const val = raw === "" ? 0 : parseInt(raw, 10);
    if (isNaN(val) || val < 0) return;
    onChange({ ...values, [denom]: val });
  }, [values, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextDenom = denoms[idx + 1];
      if (nextDenom !== undefined) inputRefs.current[nextDenom]?.focus();
      else onSubmit?.();
    }
  }, [denoms, onSubmit]);

  const total = Object.entries(values).reduce((s, [d, c]) => s + Number(d) * (c || 0), 0);

  const gridColsClass = columns === 3 ? "grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div>
      <div className={`grid gap-x-3 gap-y-1 ${gridColsClass}`}>
        {denoms.map((d, idx) => {
          const val = values[d] || 0;
          const chipValue = val * d;
          const color = resolveChipColor(d, colorOverrides);
          return (
            <div key={d} className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 ring-1 ring-black/10 ${tokens.chipH} ${tokens.chipW} ${tokens.chipText}`}
                style={{ backgroundColor: color.bg, color: color.text }}
              >
                {formatChipLabel(d)}
              </span>
              <input
                ref={el => { inputRefs.current[d] = el; }}
                type="number"
                className={`no-spin font-mono w-full min-w-0 rounded border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${tokens.inputH} ${tokens.inputText}`}
                value={values[d] || ""}
                onChange={e => handleChange(d, e.target.value)}
                onKeyDown={e => handleKeyDown(e, idx)}
                placeholder={placeholder?.[d] !== undefined ? String(placeholder[d]) : "0"}
                inputMode="numeric"
              />
              {showValue && val > 0 && size !== "sm" && (
                <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  ={formatNumberSpaces(chipValue)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-border">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total</span>
        <span className="font-mono text-sm font-bold text-card-foreground">TZS {formatNumberSpaces(total)}</span>
      </div>
    </div>
  );
};

export default ChipDenomInput;
