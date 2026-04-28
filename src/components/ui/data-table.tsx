import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * DataTable shell — unified density and look for tables across the system.
 * Wraps a native <table> but enforces:
 *   - sticky header with muted-uppercase styling
 *   - body rows h-10, hover bg-muted/50
 *   - numeric columns: text-right font-mono tabular-nums (apply `data-numeric`
 *     to <th>/<td> or pass `align="right"` to <DTCell>).
 *
 *   <DataTable>
 *     <DTHead>
 *       <DTRow>
 *         <DTHeader>Name</DTHeader>
 *         <DTHeader align="right">Amount</DTHeader>
 *       </DTRow>
 *     </DTHead>
 *     <DTBody>
 *       <DTRow><DTCell>Acme</DTCell><DTCell align="right">120,000</DTCell></DTRow>
 *     </DTBody>
 *   </DataTable>
 */
export const DataTable = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto rounded-md border border-border">
    <table
      ref={ref}
      className={cn("w-full text-sm border-collapse", className)}
      {...props}
    />
  </div>
));
DataTable.displayName = "DataTable";

export const DTHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("bg-muted/40 [&_tr]:border-b border-border", className)}
    {...props}
  />
));
DTHead.displayName = "DTHead";

export const DTBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
DTBody.displayName = "DTBody";

export const DTRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn("border-b border-border transition-colors hover:bg-muted/40", className)}
    {...props}
  />
));
DTRow.displayName = "DTRow";

interface CellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right" | "center";
  numeric?: boolean;
}

export const DTHeader = React.forwardRef<HTMLTableCellElement, CellProps>(
  ({ className, align, numeric, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-9 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        !align && "text-left",
        numeric && "font-mono tabular-nums",
        className,
      )}
      {...props}
    />
  ),
);
DTHeader.displayName = "DTHeader";

export const DTCell = React.forwardRef<HTMLTableCellElement, CellProps>(
  ({ className, align, numeric, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "h-10 px-3 align-middle text-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        numeric && "font-mono tabular-nums text-right",
        className,
      )}
      {...props}
    />
  ),
);
DTCell.displayName = "DTCell";
