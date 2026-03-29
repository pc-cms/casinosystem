import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Number input with live space-separated formatting (e.g. "5 000").
 * Returns raw numeric value via onChange.
 */
interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string | number;
  onChange: (value: string) => void;
}

const formatWithSpaces = (val: string): string => {
  const clean = val.replace(/[^0-9]/g, "");
  if (!clean) return "";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const stripSpaces = (val: string): string => {
  return val.replace(/\s/g, "");
};

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, placeholder, ...props }, ref) => {
    const [display, setDisplay] = React.useState(() =>
      formatWithSpaces(String(value ?? ""))
    );

    // Sync from external value changes
    React.useEffect(() => {
      const raw = String(value ?? "");
      const currentRaw = stripSpaces(display);
      if (raw !== currentRaw) {
        setDisplay(formatWithSpaces(raw));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const cursorPos = input.selectionStart ?? 0;
      const prevLen = display.length;

      const rawInput = input.value;
      const cleaned = rawInput.replace(/[^0-9]/g, "");
      const formatted = formatWithSpaces(cleaned);

      setDisplay(formatted);
      onChange(cleaned);

      // Adjust cursor position after formatting
      requestAnimationFrame(() => {
        const diff = formatted.length - prevLen;
        const newPos = Math.max(0, cursorPos + diff);
        input.setSelectionRange(newPos, newPos);
      });
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono",
          className
        )}
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        {...props}
      />
    );
  }
);
NumberInput.displayName = "NumberInput";

export { NumberInput };
