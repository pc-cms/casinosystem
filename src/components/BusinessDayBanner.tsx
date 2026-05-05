import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { nowEAT, getBusinessDate } from "@/lib/business-day";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { cn } from "@/lib/utils";

/**
 * Warns operators that the business day rolls over at 05:00 EAT.
 * Visible from 04:30 until 05:30 EAT.
 * Dismissible per-session.
 */
export const BusinessDayBanner = () => {
  const [tick, setTick] = useState(0);
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== "undefined" && sessionStorage.getItem("cms.bd-banner.dismissed") === "1"
  );
  const { data: serverBusinessDate } = useEffectiveBusinessDate();

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (dismissed) return null;

  const now = nowEAT();
  const hour = now.getHours();
  // Show only in the late-morning window (09:00 … 11:00 EAT) as a reminder
  // before the automatic 11:00 fallback close kicks in.
  const inWindow = hour >= 9 && hour < 11;
  if (!inWindow) return null;

  const businessDate = serverBusinessDate || getBusinessDate();

  return (
    <div
      className={cn(
        "no-print sticky top-0 z-40 flex items-center gap-2 px-3 py-2 text-sm border-b",
        "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
      )}
      role="alert"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <div className="flex-1 leading-tight">
        <strong>Бизнес-день <code className="font-mono">{businessDate}</code> ещё открыт.</strong>{" "}
        Закройте его вручную (кнопка <em>Close Day</em> у Pit/Manager). Если забыть —
        авто-закрытие сработает в 11:00 EAT.
      </div>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem("cms.bd-banner.dismissed", "1");
          setDismissed(true);
        }}
        className="px-2 py-0.5 rounded text-xs hover:bg-foreground/10"
        aria-label="Скрыть"
      >
        ✕
      </button>
    </div>
  );
};
