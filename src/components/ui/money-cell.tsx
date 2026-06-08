import * as React from "react";
import { cn } from "@/lib/utils";
import {
  formatMoneyFull,
  formatMoneyCompact,
  type MoneyDisplayMode,
} from "@/lib/format-money";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

/**
 * MoneyCell — unified money display for tables.
 * - Right-aligned, mono tabular numerals.
 * - Compact mode collapses to K/M/B.
 * - Tooltip always shows full value with thousand separators.
 * - Auto colors positive/negative when `signed` is set.
 *
 *   <MoneyCell value={1250000} mode="compact" />
 */
export interface MoneyCellProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number | null | undefined;
  mode?: MoneyDisplayMode;
  signed?: boolean;
  /** Override the rendered text (useful for "—" placeholders) */
  empty?: React.ReactNode;
}

export const MoneyCell = React.forwardRef<HTMLSpanElement, MoneyCellProps>(
  ({ value, mode = "full", signed, empty, className, ...rest }, ref) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return (
        <span
          ref={ref}
          className={cn("font-mono tabular-nums text-muted-foreground", className)}
          {...rest}
        >
          {empty ?? "·"}
        </span>
      );
    }
    const full = formatMoneyFull(value);
    const display = mode === "compact" ? formatMoneyCompact(value) : full;
    const color = signed
      ? value > 0
        ? "cms-amount-positive"
        : value < 0
          ? "cms-amount-negative"
          : ""
      : "";
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              ref={ref}
              className={cn("font-mono tabular-nums whitespace-nowrap", color, className)}
              {...rest}
            >
              {display}
            </span>
          </TooltipTrigger>
          {mode === "compact" && (
            <TooltipContent side="top" className="font-mono">
              {full}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  },
);
MoneyCell.displayName = "MoneyCell";
