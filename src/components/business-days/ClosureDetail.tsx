import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CashPanel, ExpensesPanel, CashlessPanel, TableCheckPanel,
  ChipCountPanel, BreaklistPanel, PlayerStatsPanel,
} from "./ReportPanels";
import type { BusinessDayClosure, SnapshotSection } from "@/hooks/use-business-day-history";

type TabDef = { key: SnapshotSection; label: string; render: (rows: any[], date: string, casinoId: string) => JSX.Element };

const TABS: TabDef[] = [
  { key: "cash_counts",    label: "Cash",        render: (rows, d, c) => <CashPanel        rows={rows} businessDate={d} casinoId={c} /> },
  { key: "expenses",       label: "Expenses",    render: (rows, d, c) => <ExpensesPanel    rows={rows} businessDate={d} casinoId={c} /> },
  { key: "cashless",       label: "Cashless",    render: (rows, d, c) => <CashlessPanel    rows={rows} businessDate={d} casinoId={c} /> },
  { key: "table_tracker",  label: "Table Check", render: (rows, d, c) => <TableCheckPanel  rows={rows} businessDate={d} casinoId={c} /> },
  { key: "chip_snapshots", label: "Chips Count", render: (rows, d, c) => <ChipCountPanel   rows={rows} businessDate={d} casinoId={c} /> },
  { key: "breaklist",      label: "Breaklist",   render: (rows, d, c) => <BreaklistPanel   rows={rows} businessDate={d} casinoId={c} /> },
  { key: "player_stats",   label: "Player Stats",render: (rows, d, c) => <PlayerStatsPanel rows={rows} businessDate={d} casinoId={c} /> },
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
          {t.render(Array.isArray(snap[t.key]) ? snap[t.key] : [], closure.business_date, closure.casino_id)}
        </TabsContent>
      ))}
    </Tabs>
  );
};
