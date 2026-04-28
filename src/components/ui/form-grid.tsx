import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 12-column form grid. All form fields in the project should sit on this grid
 * so columns line up vertically across rows (6+6, 4+4+4, 3+3+3+3, 8+4, etc.).
 *
 * Usage:
 *   <FormGrid>
 *     <FormField span={6} label="First Name"><Input /></FormField>
 *     <FormField span={6} label="Last Name"><Input /></FormField>
 *     <FormField span={4} label="ID"><Input /></FormField>
 *     <FormField span={4} label="Type"><Select/></FormField>
 *     <FormField span={4} label="Category"><Select/></FormField>
 *   </FormGrid>
 */
export const FormGrid = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("grid grid-cols-12 gap-x-3 gap-y-3", className)}
    {...props}
  />
));
FormGrid.displayName = "FormGrid";

type Span = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

const SPAN_CLASS: Record<Span, string> = {
  1: "col-span-12 sm:col-span-1",
  2: "col-span-12 sm:col-span-2",
  3: "col-span-12 sm:col-span-3",
  4: "col-span-12 sm:col-span-4",
  5: "col-span-12 sm:col-span-5",
  6: "col-span-12 sm:col-span-6",
  7: "col-span-12 sm:col-span-7",
  8: "col-span-12 sm:col-span-8",
  9: "col-span-12 sm:col-span-9",
  10: "col-span-12 sm:col-span-10",
  11: "col-span-12 sm:col-span-11",
  12: "col-span-12",
};

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  span?: Span;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
}

/**
 * Field cell on the 12-col grid. Renders a unified label above the control.
 * The child control is responsible for its own height — but the convention is
 * h-10 inputs/selects/buttons everywhere.
 */
export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ span = 6, label, hint, required, className, children, ...props }, ref) => (
    <div ref={ref} className={cn(SPAN_CLASS[span], "min-w-0 space-y-1.5", className)} {...props}>
      {label && (
        <label className="text-xs text-muted-foreground font-medium flex items-center gap-1 leading-none">
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  ),
);
FormField.displayName = "FormField";

/**
 * Section divider inside a form (full row).
 */
export const FormSection = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { title?: React.ReactNode }
>(({ className, title, children, ...props }, ref) => (
  <div ref={ref} className={cn("col-span-12 space-y-2", className)} {...props}>
    {title && (
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
        {title}
      </div>
    )}
    {children}
  </div>
));
FormSection.displayName = "FormSection";
