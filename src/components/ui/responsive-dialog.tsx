import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * ResponsiveDialog — Dialog on desktop, bottom Drawer on mobile.
 * Use this for ANY form/edit/confirm modal so behaviour is identical
 * everywhere and respects the mobile-first drawer rule from project memory.
 *
 *   <ResponsiveDialog open={open} onOpenChange={setOpen} title="Edit Player" size="2xl">
 *     <FormGrid> ... </FormGrid>
 *     <ResponsiveDialogFooter>
 *       <Button variant="outline" onClick={...}>Cancel</Button>
 *       <Button onClick={...}>Save</Button>
 *     </ResponsiveDialogFooter>
 *   </ResponsiveDialog>
 */

/**
 * Two canonical widths only:
 *   - "form"  → 560px  (simple forms: cancel tx, notes, quick grant, password)
 *   - "table" → 880px  (table-like forms: open/close table, slots, chip count,
 *                       cage tx, promo grant, AM grant, redeem, stock count)
 *
 * Legacy size names are kept as aliases so existing call-sites keep working,
 * but they collapse to one of the two canonical widths.
 */
export type ResponsiveDialogSize =
  | "form"
  | "table"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "full";

const FORM_W = "sm:max-w-[560px]";
const TABLE_W = "sm:max-w-[880px]";

const SIZE_CLASS: Record<ResponsiveDialogSize, string> = {
  form: FORM_W,
  table: TABLE_W,
  // legacy → form
  sm: FORM_W,
  md: FORM_W,
  // legacy → table
  lg: TABLE_W,
  xl: TABLE_W,
  "2xl": TABLE_W,
  "3xl": TABLE_W,
  "4xl": TABLE_W,
  full: "sm:max-w-[95vw]",
};

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  size?: ResponsiveDialogSize;
  className?: string;
  /** Disable the auto Drawer on mobile (keep as Dialog regardless). */
  alwaysDialog?: boolean;
  children: React.ReactNode;
}

export const ResponsiveDialog = ({
  open,
  onOpenChange,
  title,
  description,
  size = "form",
  className,
  alwaysDialog,
  children,
}: ResponsiveDialogProps) => {
  const isMobile = useIsMobile();

  // Auto-reset internal state on close: every fresh open remounts children,
  // so leftover form values / partial edits never persist between sessions.
  // Increment a key each time the dialog transitions from closed → opened.
  const [mountKey, setMountKey] = React.useState(0);
  const wasOpen = React.useRef(open);
  React.useEffect(() => {
    if (open && !wasOpen.current) setMountKey((k) => k + 1);
    wasOpen.current = open;
  }, [open]);

  if (isMobile && !alwaysDialog) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn("max-h-[92vh]", className)}>
          {(title || description) && (
            <DrawerHeader className="text-left">
              {title && <DrawerTitle>{title}</DrawerTitle>}
              {description && <DrawerDescription>{description}</DrawerDescription>}
            </DrawerHeader>
          )}
          <div key={mountKey} className="px-4 pb-4 overflow-y-auto">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(SIZE_CLASS[size], "max-h-[90vh] overflow-y-auto", className)}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        <div key={mountKey}>{children}</div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Footer that picks Drawer or Dialog footer based on viewport.
 * Standard order: secondary action(s) on the left, primary on the right.
 */
export const ResponsiveDialogFooter = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <DrawerFooter className={cn("px-0 pt-3", className)}>{children}</DrawerFooter>;
  }
  return <DialogFooter className={className}>{children}</DialogFooter>;
};
