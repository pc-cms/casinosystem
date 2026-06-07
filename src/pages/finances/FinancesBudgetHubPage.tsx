import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BudgetPlanTab = lazy(() => import("./FinancesBudgetPage"));
const BudgetVsActualTab = lazy(() => import("./FinancesBudgetVsActualPage"));
const BudgetDifferenceTab = lazy(() => import("./FinancesBudgetDifferencePage"));

const TABS = [
  { value: "budget", label: "Budget" },
  { value: "actual", label: "Actual" },
  { value: "difference", label: "Difference" },
] as const;
type TabValue = (typeof TABS)[number]["value"];
const DEFAULT_TAB: TabValue = "budget";

export default function FinancesBudgetHubPage() {
  const [params, setParams] = useSearchParams();
  const raw = (params.get("tab") || DEFAULT_TAB) as TabValue;
  const tab: TabValue = TABS.some((t) => t.value === raw) ? raw : DEFAULT_TAB;
  const onChange = (v: string) => {
    const n = new URLSearchParams(params);
    n.set("tab", v);
    setParams(n, { replace: true });
  };
  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={onChange}>
        <TabsList className="h-9">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Suspense fallback={<div className="text-sm text-muted-foreground p-4">Loading…</div>}>
        {tab === "budget" && <BudgetPlanTab />}
        {tab === "actual" && <BudgetVsActualTab />}
        {tab === "difference" && <BudgetDifferenceTab />}
      </Suspense>
    </div>
  );
}
