import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Bento grid for dashboards.
 *
 * Layout: 12-column responsive grid. Tiles declare their span (`col` × `row`).
 * Standard sizes: 1×1 (kpi), 2×1 (wide kpi / chart strip), 1×2 (tall list),
 * 2×2 (chart / table block), 3×2 (wide chart), 4×2 (hero strip).
 *
 *   <BentoGrid>
 *     <BentoTile title="Revenue" col={2} row={1}>...</BentoTile>
 *     <BentoTile title="Active" col={1} row={1}>...</BentoTile>
 *     <BentoTile title="Recent" col={2} row={2}>...</BentoTile>
 *   </BentoGrid>
 */

interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tile gap in pixels. Default 16. */
  gap?: number;
  /** Base column count at the largest breakpoint. Default 12. */
  columns?: number;
}

export const BentoGrid = React.forwardRef<HTMLDivElement, BentoGridProps>(
  ({ className, gap = 16, columns = 12, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "grid w-full",
        "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12",
        "auto-rows-[minmax(140px,auto)]",
        className,
      )}
      style={{ gap, ...style }}
      {...props}
    />
  ),
);
BentoGrid.displayName = "BentoGrid";

const COL_CLASS: Record<number, string> = {
  1: "xl:col-span-1 lg:col-span-1 md:col-span-1 sm:col-span-1",
  2: "xl:col-span-2 lg:col-span-2 md:col-span-2 sm:col-span-2",
  3: "xl:col-span-3 lg:col-span-3 md:col-span-3 sm:col-span-2",
  4: "xl:col-span-4 lg:col-span-4 md:col-span-4 sm:col-span-2",
  5: "xl:col-span-5 lg:col-span-5 md:col-span-4 sm:col-span-2",
  6: "xl:col-span-6 lg:col-span-6 md:col-span-4 sm:col-span-2",
  8: "xl:col-span-8 lg:col-span-6 md:col-span-4 sm:col-span-2",
  12: "xl:col-span-12 lg:col-span-6 md:col-span-4 sm:col-span-2",
};

const ROW_CLASS: Record<number, string> = {
  1: "row-span-1",
  2: "row-span-2",
  3: "row-span-3",
  4: "row-span-4",
};

interface BentoTileProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Column span (1, 2, 3, 4, 6, 8, 12). Default 2. */
  col?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 12;
  /** Row span (1, 2, 3, 4). Default 1. */
  row?: 1 | 2 | 3 | 4;
  /** Remove inner padding (for tables/charts that paint to edge). */
  bare?: boolean;
  /** Highlight tile (for primary KPIs). */
  accent?: boolean;
}

export const BentoTile = React.forwardRef<HTMLDivElement, BentoTileProps>(
  (
    {
      className,
      title,
      subtitle,
      actions,
      col = 2,
      row = 1,
      bare,
      accent,
      children,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "relative flex min-w-0 flex-col rounded-xl border bg-card text-card-foreground shadow-sm transition-colors",
        COL_CLASS[col] ?? COL_CLASS[2],
        ROW_CLASS[row] ?? ROW_CLASS[1],
        accent
          ? "border-primary/40 bg-gradient-to-br from-card to-primary/5"
          : "border-border hover:border-border/80",
        className,
      )}
      {...props}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-2 px-4 pt-3 pb-1">
          <div className="min-w-0">
            {title && (
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {title}
              </div>
            )}
            {subtitle && (
              <div className="text-xs text-muted-foreground/80 truncate mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
          {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn("flex-1 min-w-0 min-h-0", !bare && "px-4 pb-3", bare && "p-0")}>
        {children}
      </div>
    </div>
  ),
);
BentoTile.displayName = "BentoTile";

/** KPI value display — large tabular numeric. */
export const BentoKpi = ({
  value,
  delta,
  hint,
  className,
}: {
  value: React.ReactNode;
  delta?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col justify-center h-full", className)}>
    <div className="font-mono tabular-nums text-2xl font-semibold leading-tight">
      {value}
    </div>
    {(delta || hint) && (
      <div className="mt-1 flex items-baseline gap-2 text-xs text-muted-foreground">
        {delta && <span className="font-mono tabular-nums">{delta}</span>}
        {hint && <span className="truncate">{hint}</span>}
      </div>
    )}
  </div>
);
