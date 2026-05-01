import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { nowEAT, getBusinessDate } from "@/lib/business-day";
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

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (dismissed) return null;

  const now = nowEAT();
  const minutes = now.getHours() * 60 + now.getMinutes();
  // 04:30 (270) … 05:30 (330)
  const inWindow = minutes >= 270 && minutes <= 330;
  if (!inWindow) return null;

  const beforeRollover = minutes < 300;
  const businessDate = getBusinessDate();

  return (
    <div
      className={cn(
        "no-print sticky top-0 z-40 flex items-center gap-2 px-3 py-2 text-sm border-b",
        beforeRollover
          ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
          : "bg-sky-500/10 border-sky-500/30 text-sky-900 dark:text-sky-200"
      )}
      role="alert"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <div className="flex-1 leading-tight">
        {beforeRollover ? (
          <>
            <strong>Скоро смена бизнес-дня (05:00 EAT).</strong>{" "}
            Текущий бизнес-день: <code className="font-mono">{businessDate}</code>.
            Закройте смену и кассу <em>до</em> 05:00, иначе операции уйдут в новый день.
          </>
        ) : (
          <>
            <strong>Бизнес-день переключился.</strong>{" "}
            Новый день: <code className="font-mono">{businessDate}</code>.
            Все новые транзакции уже относятся к новому дню.
          </>
        )}
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
