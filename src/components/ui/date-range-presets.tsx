import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type DatePreset = "day" | "week" | "month" | "year" | "all" | "custom";

const todayMinus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

export const presetRange = (p: DatePreset): { from: string; to: string } => {
  const today = todayMinus(0);
  switch (p) {
    case "day": return { from: today, to: today };
    case "week": return { from: todayMinus(6), to: today };
    case "month": return { from: todayMinus(29), to: today };
    case "year": return { from: todayMinus(364), to: today };
    case "all": return { from: "1970-01-01", to: today };
    default: return { from: todayMinus(29), to: today };
  }
};

const PRESET_LABELS: Record<Exclude<DatePreset, "custom">, string> = {
  day: "Day", week: "Week", month: "Month", year: "Year", all: "All",
};

interface DateRangePresetsProps {
  preset: DatePreset;
  from: string;
  to: string;
  onChange: (next: { preset: DatePreset; from: string; to: string }) => void;
  className?: string;
}

export const DateRangePresets = ({ preset, from, to, onChange, className }: DateRangePresetsProps) => {
  const setPreset = (p: DatePreset) => {
    if (p === "custom") {
      onChange({ preset: p, from, to });
    } else {
      const r = presetRange(p);
      onChange({ preset: p, from: r.from, to: r.to });
    }
  };
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className ?? ""}`}>
      <div className="flex gap-1">
        {(Object.keys(PRESET_LABELS) as Array<keyof typeof PRESET_LABELS>).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={preset === p ? "default" : "outline"}
            onClick={() => setPreset(p)}
            className="h-9"
          >
            {PRESET_LABELS[p]}
          </Button>
        ))}
        <Button
          size="sm"
          variant={preset === "custom" ? "default" : "outline"}
          onClick={() => setPreset("custom")}
          className="h-9"
        >
          Custom
        </Button>
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => onChange({ preset: "custom", from: e.target.value, to })}
            className="h-9 w-[150px] font-mono text-xs"
          />
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => onChange({ preset: "custom", from, to: e.target.value })}
            className="h-9 w-[150px] font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
};
