import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * InlineEditor — expandable inline panel for tables/cards (M0 of modal redesign).
 *
 * Replaces tiny "edit/add" modals with a row that expands in-place. Pure
 * CSS transition (grid-rows-[0fr]→[1fr]) — no Radix, no portal, no animation lib.
 *
 * Usage:
 *   <InlineEditor open={editing}>
 *     <FormGrid>...</FormGrid>
 *     <div className="flex justify-end gap-2 pt-2">
 *       <Button variant="outline" onClick={cancel}>Cancel</Button>
 *       <Button onClick={save}>Save</Button>
 *     </div>
 *   </InlineEditor>
 */

interface InlineEditorProps {
  open: boolean;
  children: ReactNode;
  className?: string;
  /** Visual treatment. `card` adds border + bg, `flush` is bare. Default: card. */
  variant?: "card" | "flush";
}

export const InlineEditor = ({
  open,
  children,
  className,
  variant = "card",
}: InlineEditorProps) => (
  <div
    aria-hidden={!open}
    className={cn(
      "grid transition-[grid-template-rows] duration-200 ease-out",
      open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
    )}
  >
    <div className="overflow-hidden">
      <div
        className={cn(
          "mt-2",
          variant === "card" && "rounded-md border border-border bg-card p-4",
          className
        )}
      >
        {children}
      </div>
    </div>
  </div>
);
