import { useState, useMemo } from "react";
import { usePlayers, useTransactions, useGamingTables, useExpenses, usePlayerEconomy, useTableTracker, usePlayerGroups } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Table2, Users, Receipt, Grid3X3, Landmark, UsersRound, FileBarChart, ArrowUp, ArrowDown, ArrowUpDown, Coins, CalendarDays } from "lucide-react";
import MissChips from "@/pages/MissChips";
import { businessDayHourUTC } from "@/lib/business-day";
import { PageHeader } from "@/components/layout/PageHeader";
import { fmtDate } from "@/lib/format-date";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// ----------- Sortable column helper -----------
type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir };

function useSorted<T extends Record<string, any>>(items: T[], initial: SortState): { sorted: T[]; sort: SortState; toggle: (k: string) => void } {
  const [sort, setSort] = useState<SortState>(initial);
  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return sort.dir === "asc" ? va - vb : vb - va;
      const sa = String(va);
      const sb = String(vb);
      return sort.dir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return arr;
  }, [items, sort]);
  const toggle = (key: string) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  return { sorted, sort, toggle };
}

const SortTh = ({
  label, k, sort, toggle, align = "left", className = "",
}: { label: string; k: string; sort: SortState; toggle: (k: string) => void; align?: "left" | "right" | "center"; className?: string }) => {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      onClick={() => toggle(k)}
      className={`text-xs font-medium uppercase px-3 py-2 cursor-pointer select-none hover:text-foreground ${active ? "text-foreground" : "text-muted-foreground"} ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {label}
        <Icon className="w-3 h-3 opacity-70" />
      </span>
    </th>
  );
};

// Hook: fetch all shifts
const useShifts = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["shifts", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase.from("shifts").select("*").eq("casino_id", casinoId).order("opened_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

const toIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const Reports = () => {
  const now = new Date();
  // Default: current month — from 1st of month to today.
  const monthStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const today = toIsoDate(now);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  return (
    <div>
      <PageHeader
        icon={FileBarChart}
        title="Reports"
        subtitle="Analytics & operational insights"
      >
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40 font-mono text-xs h-9" />
        <span className="text-muted-foreground text-xs">→</span>
        <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40 font-mono text-xs h-9" />
      </PageHeader>

      <Tabs defaultValue="daily" className="space-y-3">
        <TabsList className="flex-wrap">
          <TabsTrigger value="daily" className="gap-1 text-xs"><CalendarDays className="w-3.5 h-3.5" /> Daily</TabsTrigger>
          <TabsTrigger value="shifts" className="gap-1 text-xs"><Landmark className="w-3.5 h-3.5" /> Shifts</TabsTrigger>
          <TabsTrigger value="tables" className="gap-1 text-xs"><Table2 className="w-3.5 h-3.5" /> Tables</TabsTrigger>
          <TabsTrigger value="players" className="gap-1 text-xs"><Users className="w-3.5 h-3.5" /> Players</TabsTrigger>
          <TabsTrigger value="groups" className="gap-1 text-xs"><UsersRound className="w-3.5 h-3.5" /> Groups</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1 text-xs"><Receipt className="w-3.5 h-3.5" /> Expenses</TabsTrigger>
          <TabsTrigger value="tracker" className="gap-1 text-xs"><Grid3X3 className="w-3.5 h-3.5" /> Tracker</TabsTrigger>
          <TabsTrigger value="miss-chips" className="gap-1 text-xs"><Coins className="w-3.5 h-3.5" /> Miss Chips</TabsTrigger>
        </TabsList>

        <TabsContent value="daily"><DailyReport from={from} to={to} /></TabsContent>
        <TabsContent value="shifts"><ShiftReport from={from} to={to} /></TabsContent>
        <TabsContent value="tables"><TableReport from={from} to={to} /></TabsContent>
        <TabsContent value="players"><PlayerReport from={from} to={to} /></TabsContent>
        <TabsContent value="groups"><GroupReport from={from} to={to} /></TabsContent>
        <TabsContent value="expenses"><ExpenseReport from={from} to={to} /></TabsContent>
        <TabsContent value="tracker"><TrackerReport from={from} to={to} /></TabsContent>
        <TabsContent value="miss-chips"><MissChips /></TabsContent>
      </Tabs>
    </div>
  );
};

// =================== SHIFT REPORT ===================
const ShiftReport = ({ from, to }: { from: string; to: string }) => {
  const { data: shifts = [] } = useShifts();
  const { data: transactions = [] } = useTransactions();
  const { data: expenses = [] } = useExpenses();

  const filtered = useMemo(() => {
    return shifts.filter(s => {
      const d = s.opened_at.split("T")[0];
      return d >= from && d <= to;
    });
  }, [shifts, from, to]);

  const shiftData = useMemo(() => {
    return filtered.map(s => {
      const sExp = expenses.filter((e: any) => e.shift_id === s.id && e.approved);
      const expTotal = sExp.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

      const openTotals = (s.opening_float as any)?.totals || {};
      const closeTotals = (s.closing_count as any)?.totals || {};
      const openingCashOnly = Math.max(Number(openTotals.total_tzs || 0) - Number(openTotals.chips_tzs || 0), 0);
      const hasClosing = s.status === "closed" && (s.closing_count != null);
      const closingCashOnly = hasClosing
        ? Number(closeTotals.total_tzs || 0) - Number(closeTotals.chips_tzs || 0)
        : null;
      const cashChange = closingCashOnly != null ? closingCashOnly - openingCashOnly : null;

      const tablesResult = Number((s as any).shift_result || 0);
      const slotsResult = 0;
      const result = tablesResult + slotsResult;
      const missTotal = Number((s as any).miss_total || 0);
      // Total Cash = Result − Miss − Expenses (cash actually expected to enter the desk)
      const totalCash = result - missTotal - expTotal;
      // Balance = real cash change − expected cash change. 0 = perfect.
      const balance = cashChange != null ? cashChange - totalCash : null;

      return {
        ...s,
        opened_date: s.opened_at.split("T")[0],
        expTotal,
        tablesResult,
        slotsResult,
        result,
        missTotal,
        totalCash,
        balance: balance ?? 0,
        balanceRaw: balance,
      };
    });
  }, [filtered, expenses]);

  const { sorted: shiftSorted, sort, toggle } = useSorted(shiftData, { key: "opened_date", dir: "desc" });

  const totals = useMemo(() => ({
    tables: shiftData.reduce((s, d) => s + d.tablesResult, 0),
    slots: shiftData.reduce((s, d) => s + d.slotsResult, 0),
    result: shiftData.reduce((s, d) => s + d.result, 0),
    expenses: shiftData.reduce((s, d) => s + d.expTotal, 0),
    miss: shiftData.reduce((s, d) => s + d.missTotal, 0),
    totalCash: shiftData.reduce((s, d) => s + d.totalCash, 0),
  }), [shiftData]);

  const signCls = (n: number) => n > 0 ? "cms-amount-positive" : n < 0 ? "cms-amount-negative" : "text-card-foreground";

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {[
          { label: "Shifts", value: String(shiftData.length), cls: "text-card-foreground" },
          { label: "Tables", value: formatCurrency(totals.tables), cls: signCls(totals.tables) },
          { label: "Slots", value: formatCurrency(totals.slots), cls: signCls(totals.slots) },
          { label: "Result", value: formatCurrency(totals.result), cls: signCls(totals.result) },
          { label: "Miss Chips", value: formatCurrency(totals.miss), cls: "text-warning" },
          { label: "Total Cash", value: formatCurrency(totals.totalCash), cls: signCls(totals.totalCash) },
        ].map(c => (
          <div key={c.label} className="cms-panel p-2">
            <p className="uppercase text-muted-foreground tracking-wider text-lg">{c.label}</p>
            <p className={`font-mono text-sm font-bold ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="cms-panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <SortTh label="Date" k="opened_date" sort={sort} toggle={toggle} />
              <SortTh label="Status" k="status" sort={sort} toggle={toggle} />
              <SortTh label="Tables" k="tablesResult" sort={sort} toggle={toggle} align="right" />
              <SortTh label="Slots" k="slotsResult" sort={sort} toggle={toggle} align="right" />
              <SortTh label="Result" k="result" sort={sort} toggle={toggle} align="right" />
              <SortTh label="Expenses" k="expTotal" sort={sort} toggle={toggle} align="right" />
              <SortTh label="Miss Chips" k="missTotal" sort={sort} toggle={toggle} align="right" />
              <SortTh label="Total Cash" k="totalCash" sort={sort} toggle={toggle} align="right" />
              <SortTh label="Balance" k="balance" sort={sort} toggle={toggle} align="right" />
            </tr>
          </thead>
          <tbody>
            {shiftSorted.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-muted-foreground text-sm py-6">No shifts in range</td></tr>
            ) : shiftSorted.map(s => (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 text-xs font-mono text-card-foreground">{fmtDate(s.opened_at)}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${s.status === "open" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {s.status}
                  </span>
                </td>
                <td className={`px-3 py-2 text-right font-mono text-xs ${signCls(s.tablesResult)}`}>{formatCurrency(s.tablesResult)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{formatCurrency(s.slotsResult)}</td>
                <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${signCls(s.result)}`}>{formatCurrency(s.result)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-warning">{formatCurrency(s.expTotal)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-warning">{formatCurrency(s.missTotal)}</td>
                <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${signCls(s.totalCash)}`}>{formatCurrency(s.totalCash)}</td>
                <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${s.balanceRaw == null ? "text-muted-foreground" : s.balanceRaw === 0 ? "text-success" : "text-destructive"}`}>
                  {s.balanceRaw != null ? `${s.balanceRaw >= 0 ? "+" : ""}${formatCurrency(s.balanceRaw)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =================== TABLE REPORT ===================
const TableReport = ({ from, to }: { from: string; to: string }) => {
  const { data: tables = [] } = useGamingTables();
  const { data: transactions = [] } = useTransactions();

  const tableData = useMemo(() => {
    const filtered = transactions.filter(t => {
      const d = t.created_at.split("T")[0];
      return d >= from && d <= to;
    });
    return tables.map(table => {
      const tTx = filtered.filter(t => t.table_id === table.id);
      const drop = tTx.filter(t => (t.type === "buy" || t.type === "in")).reduce((s, t) => s + Number(t.amount), 0);
      const cashout = tTx.filter(t => (t.type === "cashout" || t.type === "out")).reduce((s, t) => s + Number(t.amount), 0);
      return { ...table, float_amount_num: Number(table.float_amount), drop, cashout, result: cashout - drop, txCount: tTx.length };
    }).filter(t => t.txCount > 0);
  }, [tables, transactions, from, to]);

  const { sorted, sort, toggle } = useSorted(tableData, { key: "drop", dir: "desc" });

  return (
    <div className="cms-panel overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <SortTh label="Table" k="name" sort={sort} toggle={toggle} />
            <SortTh label="Game" k="game" sort={sort} toggle={toggle} />
            <SortTh label="Float" k="float_amount_num" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Drop" k="drop" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Cashout" k="cashout" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Result" k="result" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Txns" k="txCount" sort={sort} toggle={toggle} align="right" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={7} className="text-center text-muted-foreground text-sm py-6">No table data</td></tr>
          ) : sorted.map(t => (
            <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-3 py-2 text-sm font-medium text-card-foreground">{t.name}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{t.game}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(t.float_amount_num)}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(t.drop)}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(t.cashout)}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${t.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {t.result >= 0 ? "+" : ""}{formatCurrency(t.result)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{t.txCount}</td>
            </tr>
          ))}
          {sorted.length > 0 && (
            <tr className="border-t-2 border-primary/30 bg-muted/30">
              <td colSpan={3} className="px-3 py-2 text-xs font-bold text-card-foreground uppercase">Totals</td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">{formatCurrency(sorted.reduce((s, t) => s + t.drop, 0))}</td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">{formatCurrency(sorted.reduce((s, t) => s + t.cashout, 0))}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${sorted.reduce((s, t) => s + t.result, 0) >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {formatCurrency(sorted.reduce((s, t) => s + t.result, 0))}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-muted-foreground">{sorted.reduce((s, t) => s + t.txCount, 0)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// =================== PLAYER REPORT ===================
const PlayerReport = ({ from, to }: { from: string; to: string }) => {
  const { data: players = [] } = usePlayers();
  const { data: transactions = [] } = useTransactions();
  const { data: expenses = [] } = useExpenses();

  const playerData = useMemo(() => {
    const filteredTx = transactions.filter(t => {
      const d = t.created_at.split("T")[0];
      return d >= from && d <= to;
    });
    const filteredExp = expenses.filter((e: any) => {
      const d = e.created_at.split("T")[0];
      return d >= from && d <= to && e.approved;
    });

    return players.filter(p => p.status === "active").map(p => {
      const pTx = filteredTx.filter(t => t.player_id === p.id);
      const pExp = filteredExp.filter((e: any) => e.player_id === p.id);
      const drop = pTx.filter(t => (t.type === "buy" || t.type === "in")).reduce((s, t) => s + Number(t.amount), 0);
      const cashout = pTx.filter(t => (t.type === "cashout" || t.type === "out")).reduce((s, t) => s + Number(t.amount), 0);
      const expTotal = pExp.reduce((s: number, e: any) => s + Number(e.amount), 0);
      const result = cashout - drop;
      const realResult = result - expTotal;
      return {
        ...p,
        player_name: `${p.first_name} ${p.last_name}`,
        drop, cashout, expTotal, result, realResult, txCount: pTx.length,
      };
    }).filter(p => p.txCount > 0);
  }, [players, transactions, expenses, from, to]);

  const { sorted, sort, toggle } = useSorted(playerData, { key: "drop", dir: "desc" });

  return (
    <div className="cms-panel overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <SortTh label="Player" k="player_name" sort={sort} toggle={toggle} />
            <SortTh label="Drop" k="drop" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Cashout" k="cashout" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Result" k="result" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Expenses" k="expTotal" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Real Result" k="realResult" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Txns" k="txCount" sort={sort} toggle={toggle} align="right" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={7} className="text-center text-muted-foreground text-sm py-6">No player data</td></tr>
          ) : sorted.map(p => (
            <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-3 py-2">
                <span className="text-sm font-medium text-card-foreground">{p.first_name} {p.last_name}</span>
                {p.nickname && <span className="text-xs text-muted-foreground ml-1">({p.nickname})</span>}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(p.drop)}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(p.cashout)}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${p.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {p.result >= 0 ? "+" : ""}{formatCurrency(p.result)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-warning">{formatCurrency(p.expTotal)}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${p.realResult >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {p.realResult >= 0 ? "+" : ""}{formatCurrency(p.realResult)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{p.txCount}</td>
            </tr>
          ))}
          {sorted.length > 0 && (
            <tr className="border-t-2 border-primary/30 bg-muted/30">
              <td className="px-3 py-2 text-xs font-bold text-card-foreground uppercase">Totals ({sorted.length} players)</td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">{formatCurrency(sorted.reduce((s, p) => s + p.drop, 0))}</td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">{formatCurrency(sorted.reduce((s, p) => s + p.cashout, 0))}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${sorted.reduce((s, p) => s + p.result, 0) >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {formatCurrency(sorted.reduce((s, p) => s + p.result, 0))}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-warning">{formatCurrency(sorted.reduce((s, p) => s + p.expTotal, 0))}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${sorted.reduce((s, p) => s + p.realResult, 0) >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {formatCurrency(sorted.reduce((s, p) => s + p.realResult, 0))}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-muted-foreground">{sorted.reduce((s, p) => s + p.txCount, 0)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// =================== GROUP REPORT ===================
const GroupReport = ({ from, to }: { from: string; to: string }) => {
  const { data: groups = [] } = usePlayerGroups();
  const { data: transactions = [] } = useTransactions();
  const { data: expenses = [] } = useExpenses();

  const groupData = useMemo(() => {
    const filteredTx = transactions.filter(t => {
      const d = t.created_at.split("T")[0];
      return d >= from && d <= to;
    });
    const filteredExp = expenses.filter((e: any) => {
      const d = e.created_at.split("T")[0];
      return d >= from && d <= to && e.approved;
    });

    return groups.map((g: any) => {
      const memberIds = (g.group_members || [])
        .filter((m: any) => {
          const joined = m.joined_at.split("T")[0];
          const left = m.left_at ? m.left_at.split("T")[0] : "9999-12-31";
          return joined <= to && left >= from;
        })
        .map((m: any) => m.player_id);

      const gTx = filteredTx.filter(t => memberIds.includes(t.player_id));
      const gExp = filteredExp.filter((e: any) => e.player_id && memberIds.includes(e.player_id));
      const drop = gTx.filter(t => (t.type === "buy" || t.type === "in")).reduce((s, t) => s + Number(t.amount), 0);
      const cashout = gTx.filter(t => (t.type === "cashout" || t.type === "out")).reduce((s, t) => s + Number(t.amount), 0);
      const expTotal = gExp.reduce((s: number, e: any) => s + Number(e.amount), 0);
      return { id: g.id, name: g.name, members: memberIds.length, drop, cashout, result: cashout - drop, realResult: cashout - drop - expTotal, expTotal };
    }).filter(g => g.members > 0);
  }, [groups, transactions, expenses, from, to]);

  const { sorted, sort, toggle } = useSorted(groupData, { key: "drop", dir: "desc" });

  return (
    <div className="cms-panel overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <SortTh label="Group" k="name" sort={sort} toggle={toggle} />
            <SortTh label="Members" k="members" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Drop" k="drop" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Cashout" k="cashout" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Result" k="result" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Expenses" k="expTotal" sort={sort} toggle={toggle} align="right" />
            <SortTh label="Real Result" k="realResult" sort={sort} toggle={toggle} align="right" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={7} className="text-center text-muted-foreground text-sm py-6">No group data</td></tr>
          ) : sorted.map((g) => (
            <tr key={g.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-3 py-2 text-sm font-medium text-card-foreground">{g.name}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{g.members}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(g.drop)}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(g.cashout)}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${g.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {g.result >= 0 ? "+" : ""}{formatCurrency(g.result)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-warning">{formatCurrency(g.expTotal)}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${g.realResult >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {g.realResult >= 0 ? "+" : ""}{formatCurrency(g.realResult)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// =================== EXPENSE REPORT ===================
const ExpenseReport = ({ from, to }: { from: string; to: string }) => {
  const { data: expenses = [] } = useExpenses();

  const data = useMemo(() => {
    const filtered = expenses.filter((e: any) => {
      const d = e.created_at.split("T")[0];
      return d >= from && d <= to;
    });

    const byCategory: Record<string, { total: number; count: number }> = {};
    const byPlayer: Record<string, { name: string; total: number; count: number }> = {};

    filtered.forEach((e: any) => {
      if (!byCategory[e.category]) byCategory[e.category] = { total: 0, count: 0 };
      byCategory[e.category].total += Number(e.amount);
      byCategory[e.category].count += 1;

      if (e.player_id && e.players) {
        if (!byPlayer[e.player_id]) byPlayer[e.player_id] = { name: `${e.players.first_name} ${e.players.last_name}`, total: 0, count: 0 };
        byPlayer[e.player_id].total += Number(e.amount);
        byPlayer[e.player_id].count += 1;
      }
    });

    const total = filtered.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const approved = filtered.filter((e: any) => e.approved).reduce((s: number, e: any) => s + Number(e.amount), 0);
    const pending = total - approved;

    const catList = Object.entries(byCategory).map(([category, v]) => ({ category, total: v.total, count: v.count }));
    const playerList = Object.entries(byPlayer).map(([id, v]) => ({ id, name: v.name, total: v.total, count: v.count }));

    return { total, approved, pending, count: filtered.length, catList, playerList };
  }, [expenses, from, to]);

  const catSort = useSorted(data.catList, { key: "total", dir: "desc" });
  const playerSort = useSorted(data.playerList, { key: "total", dir: "desc" });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="cms-panel p-2"><p className="uppercase text-muted-foreground tracking-wider text-lg">Total</p><p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(data.total)}</p></div>
        <div className="cms-panel p-2"><p className="uppercase text-muted-foreground tracking-wider text-lg">Approved</p><p className="font-mono font-bold text-success text-3xl">{formatCurrency(data.approved)}</p></div>
        <div className="cms-panel p-2"><p className="uppercase text-muted-foreground tracking-wider text-lg">Pending</p><p className="font-mono text-sm font-bold text-warning">{formatCurrency(data.pending)}</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* By Category */}
        <div className="cms-panel overflow-x-auto">
          <div className="cms-header text-xs">By Category</div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <SortTh label="Category" k="category" sort={catSort.sort} toggle={catSort.toggle} />
                <SortTh label="Count" k="count" sort={catSort.sort} toggle={catSort.toggle} align="right" />
                <SortTh label="Total" k="total" sort={catSort.sort} toggle={catSort.toggle} align="right" />
              </tr>
            </thead>
            <tbody>
              {catSort.sorted.length === 0 ? (
                <tr><td colSpan={3} className="text-center text-muted-foreground text-xs py-4">No expenses</td></tr>
              ) : catSort.sorted.map(c => (
                <tr key={c.category} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px] font-mono capitalize">{c.category}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">×{c.count}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-medium text-card-foreground">{formatCurrency(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* By Player */}
        <div className="cms-panel overflow-x-auto">
          <div className="cms-header text-xs">By Player</div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <SortTh label="Player" k="name" sort={playerSort.sort} toggle={playerSort.toggle} />
                <SortTh label="Count" k="count" sort={playerSort.sort} toggle={playerSort.toggle} align="right" />
                <SortTh label="Total" k="total" sort={playerSort.sort} toggle={playerSort.toggle} align="right" />
              </tr>
            </thead>
            <tbody>
              {playerSort.sorted.length === 0 ? (
                <tr><td colSpan={3} className="text-center text-muted-foreground text-xs py-4">No player-linked expenses</td></tr>
              ) : playerSort.sorted.map(p => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 text-xs text-card-foreground">{p.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">×{p.count}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-medium text-card-foreground">{formatCurrency(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =================== TRACKER REPORT ===================
const TrackerReport = ({ from, to }: { from: string; to: string }) => {
  const { casinoId } = useAuth();
  const { data: tables = [] } = useGamingTables();

  const { data: trackerData = [] } = useQuery({
    queryKey: ["tracker-report", casinoId, from, to],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase.from("table_tracker").select("*").eq("casino_id", casinoId).gte("date", from).lte("date", to);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });

  const openTables = useMemo(() => tables.filter(t => t.status === "open"), [tables]);

  const byDate = useMemo(() => {
    const map: Record<string, { date: string; total: number; byTable: Record<string, number> }> = {};
    trackerData.forEach(t => {
      if (!map[t.date]) map[t.date] = { date: t.date, total: 0, byTable: {} };
      map[t.date].total += Number(t.value);
      map[t.date].byTable[t.table_id] = (map[t.date].byTable[t.table_id] || 0) + Number(t.value);
    });
    // Build flat objects for sorting that include each table column as a sortable key
    return Object.values(map).map(row => {
      const out: any = { date: row.date, total: row.total, byTable: row.byTable };
      for (const t of openTables) out[`t_${t.id}`] = row.byTable[t.id] || 0;
      return out;
    });
  }, [trackerData, openTables]);

  const { sorted, sort, toggle } = useSorted(byDate, { key: "date", dir: "asc" });

  const grandTotal = trackerData.reduce((s, t) => s + Number(t.value), 0);

  return (
    <div className="space-y-3">
      <div className="cms-panel p-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{sorted.length} days tracked</span>
        <span className="font-mono text-sm font-bold text-primary">{formatCurrency(grandTotal)}</span>
      </div>

      <div className="cms-panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <SortTh label="Date" k="date" sort={sort} toggle={toggle} />
              {openTables.map(t => (
                <SortTh key={t.id} label={t.name} k={`t_${t.id}`} sort={sort} toggle={toggle} align="right" />
              ))}
              <SortTh label="Total" k="total" sort={sort} toggle={toggle} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={openTables.length + 2} className="text-center text-muted-foreground text-sm py-6">No tracker data</td></tr>
            ) : sorted.map(d => (
              <tr key={d.date} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 text-xs font-mono text-card-foreground">{d.date}</td>
                {openTables.map(t => (
                  <td key={t.id} className="px-3 py-2 text-right font-mono text-xs text-card-foreground">
                    {d.byTable[t.id] ? formatCurrency(d.byTable[t.id]) : "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">{formatCurrency(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// =================== DAILY ANALYTICS REPORT ===================
// Per business-day: Drop (R) / Cash In / Miss Chips / Result / Hold % (R/D) /
// Player Result / Diff (Result + Player Result).
//
// - Drop (R)  = External new money at tables (NEP-split drop_r)
// - Cash In   = Total cash buy-in at tables = Drop(R) + Drop(V recycled).
//               Pulled from same RPC as Drop so Cash In ≥ Drop (R) by construction.
// - Result    = Σ shifts.tables_result (chip-based, canonical)
// - Miss Chips= Σ shifts.miss_total
// - Hold %    = Result / Drop(R) * 100  (can be negative — red)
// - Player Result = Cashout − Cash-In (player tx; positive = player wins)
// - Diff      = Result + Player Result  (should converge to ~0)
const DailyReport = ({ from, to }: { from: string; to: string }) => {
  const { casinoId } = useAuth();

  // Enumerate business dates in range (inclusive)
  const dates = useMemo(() => {
    const out: string[] = [];
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return out;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      out.push(toIsoDate(d));
    }
    return out;
  }, [from, to]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["daily-report", casinoId, from, to],
    queryFn: async () => {
      if (!casinoId || dates.length === 0) return [];

      // Window [from 11:00 EAT, to+1 11:00 EAT] in UTC
      const winFrom = businessDayHourUTC(from, 11);
      const winTo = businessDayHourUTC(to, 35);

      // 1) Shifts (Result + Miss bucketed by opened_at → business date)
      const { data: shifts, error: sErr } = await supabase
        .from("shifts")
        .select("id, opened_at, tables_result, miss_total")
        .eq("casino_id", casinoId)
        .gte("opened_at", winFrom)
        .lt("opened_at", winTo);
      if (sErr) throw sErr;

      // 2) Player transactions (Cashout / cash-in for Player Result)
      const { data: txs, error: tErr } = await supabase
        .from("transactions")
        .select("type, amount, created_at")
        .eq("casino_id", casinoId)
        .in("type", ["buy", "in", "cashout", "out"])
        .gte("created_at", winFrom)
        .lt("created_at", winTo);
      if (tErr) throw tErr;

      // 3) Per-day NEP split (Drop R + Drop V) — one RPC per day in parallel
      const splits = await Promise.all(
        dates.map(async (d) => {
          const f = businessDayHourUTC(d, 11);
          const t = businessDayHourUTC(d, 35);
          const { data, error } = await (supabase as any).rpc("compute_tables_drop_split", {
            _casino_id: casinoId,
            _from: f,
            _to: t,
          });
          if (error) return { date: d, dropR: 0, dropV: 0 };
          const dropR = (data || []).reduce((s: number, r: any) => s + Number(r.drop_r || 0), 0);
          const dropV = (data || []).reduce((s: number, r: any) => s + Number(r.drop_recycled || 0), 0);
          return { date: d, dropR, dropV };
        }),
      );
      const splitByDate = new Map(splits.map((s) => [s.date, s]));

      const byDate: Record<string, {
        date: string;
        cashInTx: number;
        cashout: number;
        miss: number;
        result: number;
      }> = {};
      const ensure = (d: string) => {
        if (!byDate[d]) byDate[d] = { date: d, cashInTx: 0, cashout: 0, miss: 0, result: 0 };
        return byDate[d];
      };
      dates.forEach((d) => ensure(d));

      // Map UTC ISO timestamp → business date (rollover 11:00 EAT = 08:00 UTC)
      const tsToBusinessDate = (iso: string): string => {
        const t = new Date(iso).getTime();
        const eatHours = t / 3600000 + 3;
        const adj = new Date((eatHours - 11) * 3600000);
        return adj.toISOString().split("T")[0];
      };

      (shifts || []).forEach((s: any) => {
        const d = tsToBusinessDate(s.opened_at);
        const row = ensure(d);
        row.result += Number(s.tables_result || 0);
        row.miss += Number(s.miss_total || 0);
      });

      (txs || []).forEach((t: any) => {
        const d = tsToBusinessDate(t.created_at);
        if (!splitByDate.has(d)) return;
        const row = ensure(d);
        const amt = Number(t.amount || 0);
        if (t.type === "buy" || t.type === "in") row.cashInTx += amt;
        else if (t.type === "cashout" || t.type === "out") row.cashout += amt;
      });

      return dates.map((d) => {
        const r = ensure(d);
        const sp = splitByDate.get(d) || { dropR: 0, dropV: 0 };
        const cashIn = sp.dropR + sp.dropV; // total cash drop at tables (R + V)
        const playerResult = r.cashout - r.cashInTx;
        const hold = sp.dropR !== 0 ? (r.result / sp.dropR) * 100 : null;
        return {
          date: d,
          dropR: sp.dropR,
          cashIn,
          miss: r.miss,
          result: r.result,
          hold,
          playerResult,
          diff: r.result + playerResult - r.miss,
        };
      });
    },
    enabled: !!casinoId && dates.length > 0,
    staleTime: 30_000,
  });

  const { sorted, sort, toggle } = useSorted(rows, { key: "date", dir: "desc" });

  const totals = useMemo(() => {
    const t = rows.reduce(
      (a, r) => {
        a.dropR += r.dropR;
        a.cashIn += r.cashIn;
        a.miss += r.miss;
        a.result += r.result;
        a.playerResult += r.playerResult;
        a.diff += r.diff;
        return a;
      },
      { dropR: 0, cashIn: 0, miss: 0, result: 0, playerResult: 0, diff: 0 },
    );
    return { ...t, hold: t.dropR !== 0 ? (t.result / t.dropR) * 100 : null };
  }, [rows]);

  const cls = (n: number) =>
    n > 0 ? "cms-amount-positive" : n < 0 ? "cms-amount-negative" : "text-card-foreground";
  const holdCls = (h: number | null) =>
    h == null ? "text-card-foreground" : h < 0 ? "cms-amount-negative" : "text-card-foreground";
  const holdFmt = (h: number | null) => (h == null ? "·" : `${h.toFixed(1)}%`);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-[64px_repeat(7,minmax(0,1fr))] gap-2">
        <div className="cms-panel p-2">
          <p className="uppercase text-muted-foreground tracking-wider text-[10px]">Days</p>
          <p className="font-mono text-sm font-bold text-card-foreground">{rows.length}</p>
        </div>
        {[
          { label: "Drop (R)", value: formatCurrency(totals.dropR), cls: "text-card-foreground" },
          { label: "Cash In", value: formatCurrency(totals.cashIn), cls: "text-card-foreground" },
          { label: "Miss", value: formatCurrency(totals.miss), cls: "text-warning" },
          { label: "Result", value: formatCurrency(totals.result), cls: cls(totals.result) },
          { label: "Hold %", value: holdFmt(totals.hold), cls: holdCls(totals.hold) },
          { label: "Player Result", value: formatCurrency(totals.playerResult), cls: cls(totals.playerResult) },
          { label: "Diff", value: formatCurrency(totals.diff), cls: cls(totals.diff) },
        ].map((c) => (
          <div key={c.label} className="cms-panel p-2">
            <p className="uppercase text-muted-foreground tracking-wider text-[10px]">{c.label}</p>
            <p className={`font-mono text-sm font-bold ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="cms-panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <SortTh label="Date" k="date" sort={sort} toggle={toggle} />
              <SortTh label="Drop (R)" k="dropR" sort={sort} toggle={toggle} align="right" />
              <SortTh label="Cash In" k="cashIn" sort={sort} toggle={toggle} align="right" />
              <SortTh label="Miss Chips" k="miss" sort={sort} toggle={toggle} align="right" />
              <SortTh label="Result" k="result" sort={sort} toggle={toggle} align="right" />
              <SortTh label="Hold % (R/D)" k="hold" sort={sort} toggle={toggle} align="right" />
              <SortTh label="Player Result" k="playerResult" sort={sort} toggle={toggle} align="right" />
              <SortTh label="Diff (R + P)" k="diff" sort={sort} toggle={toggle} align="right" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center text-muted-foreground text-sm py-6">Loading…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-muted-foreground text-sm py-6">No data in range</td></tr>
            ) : sorted.map((r) => (
              <tr key={r.date} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 text-xs font-mono text-card-foreground">{fmtDate(r.date)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(r.dropR)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(r.cashIn)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-warning">{formatCurrency(r.miss)}</td>
                <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${cls(r.result)}`}>{formatCurrency(r.result)}</td>
                <td className={`px-3 py-2 text-right font-mono text-xs ${holdCls(r.hold)}`}>
                  {holdFmt(r.hold)}
                </td>
                <td className={`px-3 py-2 text-right font-mono text-xs ${cls(r.playerResult)}`}>{formatCurrency(r.playerResult)}</td>
                <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${cls(r.diff)}`}>{formatCurrency(r.diff)}</td>
              </tr>
            ))}
            {sorted.length > 0 && (
              <tr className="border-t-2 border-primary/30 bg-muted/30">
                <td className="px-3 py-2 text-xs font-bold text-card-foreground uppercase">Totals</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">{formatCurrency(totals.dropR)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">{formatCurrency(totals.cashIn)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-warning">{formatCurrency(totals.miss)}</td>
                <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${cls(totals.result)}`}>{formatCurrency(totals.result)}</td>
                <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${holdCls(totals.hold)}`}>
                  {holdFmt(totals.hold)}
                </td>
                <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${cls(totals.playerResult)}`}>{formatCurrency(totals.playerResult)}</td>
                <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${cls(totals.diff)}`}>{formatCurrency(totals.diff)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;
