/**
 * MonthCarousel — universal month picker used across Payroll pages.
 * Persists the chosen month in URL ?y=YYYY&m=MM so deep-links work.
 */
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "react-router-dom";

export const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export const useMonthFromUrl = (): { year: number; month: number; setYM: (y: number, m: number) => void } => {
  const [params, setParams] = useSearchParams();
  const now = new Date();
  const year = Number(params.get("y") || now.getFullYear());
  const month = Number(params.get("m") || (now.getMonth() + 1));
  const setYM = (y: number, m: number) => {
    const p = new URLSearchParams(params);
    p.set("y", String(y)); p.set("m", String(m));
    setParams(p, { replace: true });
  };
  return { year, month, setYM };
};

export function MonthCarousel({ year, month, onChange }: {
  year: number; month: number; onChange: (y: number, m: number) => void;
}) {
  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  };
  const now = new Date();
  return (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" onClick={() => shift(-1)} aria-label="Previous month">
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="px-3 py-1 rounded-md bg-muted/50 font-semibold tabular-nums min-w-[160px] text-center">
        {MONTHS[month - 1]} {year}
      </div>
      <Button size="icon" variant="ghost" onClick={() => shift(1)} aria-label="Next month">
        <ChevronRight className="w-4 h-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onChange(now.getFullYear(), now.getMonth() + 1)}>
        <Calendar className="w-3.5 h-3.5 mr-1" /> This month
      </Button>
    </div>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", hr_approved: "Reviewed", locked: "Approved", paid: "Paid",
};
export const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  hr_approved: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  locked: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paid: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_TONE[status] || "bg-muted"}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}
