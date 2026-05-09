/**
 * DateNavigator — unified single-date control across the app.
 *
 * Style: square outlined chip with white (foreground) text in `dd.MM.yyyy` format.
 * Always shows prev/next arrows; clicking the date opens a calendar popover.
 * No leading calendar icon (per design system decision).
 */
import * as React from "react";
import { format, addDays, subDays, parseISO, isValid } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DateLike = string | Date;

const toDate = (v: DateLike): Date => {
  if (v instanceof Date) return v;
  const d = parseISO(v);
  return isValid(d) ? d : new Date();
};

export type DateNavigatorProps = {
  /** ISO yyyy-MM-dd string or Date. */
  value: DateLike;
  /** Receives an ISO yyyy-MM-dd string. */
  onChange: (iso: string) => void;
  /** Disable navigating past this date (inclusive). */
  minDate?: Date;
  /** Disable navigating after this date (inclusive). */
  maxDate?: Date;
  className?: string;
  size?: "sm" | "md";
  /** Visual format. Default dd.MM.yyyy */
  displayFormat?: string;
  disabled?: boolean;
};

const DateNavigator = React.forwardRef<HTMLDivElement, DateNavigatorProps>(
  (
    {
      value,
      onChange,
      minDate,
      maxDate,
      className,
      size = "md",
      displayFormat = "dd.MM.yyyy",
      disabled = false,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const date = toDate(value);

    const emit = (d: Date) => onChange(format(d, "yyyy-MM-dd"));

    const canPrev = !disabled && (!minDate || subDays(date, 1) >= startOfDay(minDate));
    const canNext = !disabled && (!maxDate || addDays(date, 1) <= startOfDay(maxDate));

    const heightCls = size === "sm" ? "h-8" : "h-9";
    const padCls = size === "sm" ? "px-3" : "px-4";
    const textCls = size === "sm" ? "text-xs" : "text-sm";
    const iconBtnSize = size === "sm" ? "h-8 w-8" : "h-9 w-9";

    return (
      <div ref={ref} className={cn("inline-flex items-center gap-1", className)}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(iconBtnSize, "rounded-md")}
          disabled={!canPrev}
          onClick={() => emit(subDays(date, 1))}
          aria-label="Previous day"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "rounded-md border border-border bg-background text-foreground",
                "font-mono font-semibold tabular-nums tracking-wider",
                "hover:bg-accent transition-colors focus:outline-none focus:ring-1 focus:ring-primary",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                heightCls,
                padCls,
                textCls,
              )}
            >
              {format(date, displayFormat)}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                if (d) {
                  emit(d);
                  setOpen(false);
                }
              }}
              disabled={(d) => {
                if (minDate && d < startOfDay(minDate)) return true;
                if (maxDate && d > startOfDay(maxDate)) return true;
                return false;
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(iconBtnSize, "rounded-md")}
          disabled={!canNext}
          onClick={() => emit(addDays(date, 1))}
          aria-label="Next day"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    );
  },
);
DateNavigator.displayName = "DateNavigator";

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export default DateNavigator;
export { DateNavigator };
