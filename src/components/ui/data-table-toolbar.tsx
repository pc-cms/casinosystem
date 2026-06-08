import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type MoneyDisplayMode,
  formatMoneyCompact,
  formatMoneyFull,
  readMoneyMode,
  writeMoneyMode,
} from "@/lib/format-money";

/**
 * MoneyModeContext — lets nested report tables read the active Full/Compact
 * mode chosen at the parent toolbar without prop-drilling.
 */
const MoneyModeContext = React.createContext<MoneyDisplayMode>("full");

export const MoneyModeProvider = MoneyModeContext.Provider;

export const useMoneyDisplayMode = () => React.useContext(MoneyModeContext);

/** Format a number using the active money mode (full = "1 250 000", compact = "1.3M"). */
export const useFormatMoney = () => {
  const mode = useMoneyDisplayMode();
  return React.useCallback(
    (n: number | null | undefined) =>
      mode === "compact" ? formatMoneyCompact(n) : formatMoneyFull(n),
    [mode],
  );
};


/**
 * useMoneyMode — wires a table's money display toggle to localStorage
 * so each table remembers Full vs Compact independently.
 *
 *   const [mode, MoneyToggle] = useMoneyMode("cage-transactions");
 *   <DataTableToolbar><MoneyToggle /></DataTableToolbar>
 *   <MoneyCell value={n} mode={mode} />
 */
export function useMoneyMode(tableId: string): [MoneyDisplayMode, () => JSX.Element] {
  const [mode, setMode] = React.useState<MoneyDisplayMode>(() => readMoneyMode(tableId));
  const toggle = React.useCallback(() => {
    setMode((m) => {
      const next: MoneyDisplayMode = m === "full" ? "compact" : "full";
      writeMoneyMode(tableId, next);
      return next;
    });
  }, [tableId]);

  const Toggle = React.useCallback(
    () => (
      <div className="inline-flex rounded-md border border-border overflow-hidden">
        <Button
          type="button"
          size="sm"
          variant={mode === "full" ? "secondary" : "ghost"}
          className="rounded-none h-7 px-2 text-xs"
          onClick={() => mode !== "full" && toggle()}
        >
          Full
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "compact" ? "secondary" : "ghost"}
          className="rounded-none h-7 px-2 text-xs"
          onClick={() => mode !== "compact" && toggle()}
        >
          Compact
        </Button>
      </div>
    ),
    [mode, toggle],
  );

  return [mode, Toggle];
}

/**
 * DataTableToolbar — slim horizontal bar above a DataTable for filters,
 * search and the Full/Compact toggle. Use with `useMoneyMode`.
 */
export const DataTableToolbar = ({
  className,
  left,
  right,
  children,
}: {
  className?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <div className={cn("flex items-center justify-between gap-2 pb-2", className)}>
    <div className="flex items-center gap-2 flex-wrap">{left ?? children}</div>
    <div className="flex items-center gap-2">{right}</div>
  </div>
);
