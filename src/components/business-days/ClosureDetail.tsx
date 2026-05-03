import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SnapshotTable } from "./SnapshotTable";
import type { BusinessDayClosure, SnapshotSection } from "@/hooks/use-business-day-history";

type TabDef = { key: SnapshotSection; label: string };

const TABS: TabDef[] = [
  { key: "cash_counts",    label: "Cash" },
  { key: "expenses",       label: "Expenses" },
  { key: "cashless",       label: "Cashless" },
  { key: "table_tracker",  label: "Table Check" },
  { key: "chip_snapshots", label: "Chips Count" },
  { key: "breaklist",      label: "Breaklist" },
  { key: "player_stats",   label: "Player Stats" },
];

export const ClosureDetail = ({ closure }: { closure: BusinessDayClosure }) => {
  const snap = closure.snapshot || {};
  return (
    <Tabs defaultValue="cash_counts" className="w-full">
      <TabsList className="flex flex-wrap h-auto">
        {TABS.map(t => (
          <TabsTrigger key={t.key} value={t.key} className="text-xs">
            {t.label}
            <span className="ml-1.5 text-[10px] text-muted-foreground">
              {Array.isArray(snap[t.key]) ? snap[t.key].length : 0}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map(t => (
        <TabsContent key={t.key} value={t.key} className="mt-3">
          <SnapshotTable
            closureId={closure.id}
            section={t.key}
            rows={Array.isArray(snap[t.key]) ? snap[t.key] : []}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
};
