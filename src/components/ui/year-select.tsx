import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface YearSelectProps {
  value: number;
  onChange: (year: number) => void;
  /** Years before current year to include. Default 5. */
  past?: number;
  /** Years after current year to include. Default 1. */
  future?: number;
  className?: string;
}

/** Dropdown year picker — replaces `<Input type="number">` for year fields. */
export const YearSelect = ({ value, onChange, past = 5, future = 1, className }: YearSelectProps) => {
  const now = new Date().getFullYear();
  const years: number[] = [];
  for (let y = now + future; y >= now - past; y--) years.push(y);
  // Ensure current value is always present even if outside default range.
  if (!years.includes(value)) {
    years.push(value);
    years.sort((a, b) => b - a);
  }
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className={cn("w-24 font-mono tabular-nums", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)} className="font-mono tabular-nums">
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
