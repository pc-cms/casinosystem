import { useState, useMemo } from "react";
import { usePlayers, useTransactions, useGamingTables, useExpenses, usePlayerEconomy, useTableTracker, usePlayerGroups } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Table2, Users, Receipt, Grid3X3, Landmark, UsersRound, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { fmtDate } from "@/lib/format-date";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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

      <Tabs defaultValue="shifts" className="space-y-3">
        <TabsList className="flex-wrap">
          <TabsTrigger value="shifts" className="gap-1 text-xs"><Landmark className="w-3.5 h-3.5" /> Shifts</TabsTrigger>
          <TabsTrigger value="tables" className="gap-1 text-xs"><Table2 className="w-3.5 h-3.5" /> Tables</TabsTrigger>
          <TabsTrigger value="players" className="gap-1 text-xs"><Users className="w-3.5 h-3.5" /> Players</TabsTrigger>
          <TabsTrigger value="groups" className="gap-1 text-xs"><UsersRound className="w-3.5 h-3.5" /> Groups</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1 text-xs"><Receipt className="w-3.5 h-3.5" /> Expenses</TabsTrigger>
          <TabsTrigger value="tracker" className="gap-1 text-xs"><Grid3X3 className="w-3.5 h-3.5" /> Tracker</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts"><ShiftReport from={from} to={to} /></TabsContent>
        <TabsContent value="tables"><TableReport from={from} to={to} /></TabsContent>
        <TabsContent value="players"><PlayerReport from={from} to={to} /></TabsContent>
        <TabsContent value="groups"><GroupReport from={from} to={to} /></TabsContent>
        <TabsContent value="expenses"><ExpenseReport from={from} to={to} /></TabsContent>
        <TabsContent value="tracker"><TrackerReport from={from} to={to} /></TabsContent>
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
      const sTx = transactions.filter(t => t.shift_id === s.id);
      const sExp = expenses.filter((e: any) => e.shift_id === s.id && e.approved);
      const buyTotal = sTx.filter(t => (t.type === "buy" || t.type === "in")).reduce((sum, t) => sum + Number(t.amount), 0);
      const cashoutTotal = sTx.filter(t => (t.type === "cashout" || t.type === "out")).reduce((sum, t) => sum + Number(t.amount), 0);
      const expTotal = sExp.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

      const openTotals = (s.opening_float as any)?.totals || {};
      const closeTotals = (s.closing_count as any)?.totals || {};
      const openingCashOnly = Math.max(Number(openTotals.total_tzs || 0) - Number(openTotals.chips_tzs || 0), 0);
      const hasClosing = s.status === "closed" && (s.closing_count != null);
      const closingCashOnly = hasClosing
        ? Number(closeTotals.total_tzs || 0) - Number(closeTotals.chips_tzs || 0)
        : null;

      // Expected = Money Result (Buy-In − Cashout)
      const expected = buyTotal - cashoutTotal;
      // Actual = Cash Result — net change in cash + bank + mobile (no chips)
      const closingActual = closingCashOnly != null ? closingCashOnly - openingCashOnly : null;
      const diff = closingActual != null ? closingActual - expected : 0;
      return { ...s, buyTotal, cashoutTotal, expTotal, openingFloat: openingCashOnly, expected, closingActual, diff, txCount: sTx.length };
    });
  }, [filtered, transactions, expenses]);

  const totals = useMemo(() => ({
    buy: shiftData.reduce((s, d) => s + d.buyTotal, 0),
    cashout: shiftData.reduce((s, d) => s + d.cashoutTotal, 0),
    expenses: shiftData.reduce((s, d) => s + d.expTotal, 0),
    txns: shiftData.reduce((s, d) => s + d.txCount, 0),
  }), [shiftData]);

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Shifts", value: String(shiftData.length), cls: "text-card-foreground" },
          { label: "Total Buy-Ins", value: formatCurrency(totals.buy), cls: "cms-amount-negative" },
          { label: "Total Cashouts", value: formatCurrency(totals.cashout), cls: "cms-amount-positive" },
          { label: "Total Expenses", value: formatCurrency(totals.expenses), cls: "text-warning" },
          { label: "Result", value: formatCurrency(totals.cashout - totals.buy), cls: totals.cashout - totals.buy >= 0 ? "cms-amount-positive" : "cms-amount-negative" },
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
              {["Date", "Status", "Buy-Ins", "Cashouts", "Expenses", "Expected", "Actual", "Diff", "Txns"].map(h => (
                <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-3 py-2 ${["Date", "Status"].includes(h) ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shiftData.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-muted-foreground text-sm py-6">No shifts in range</td></tr>
            ) : shiftData.map(s => (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 text-xs font-mono text-card-foreground">{fmtDate(s.opened_at)}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${s.status === "open" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(s.buyTotal)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(s.cashoutTotal)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-warning">{formatCurrency(s.expTotal)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(s.expected)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{s.closingActual != null ? formatCurrency(s.closingActual) : "—"}</td>
                <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${s.closingActual == null ? "text-muted-foreground" : s.diff === 0 ? "text-success" : "text-destructive"}`}>
                  {s.closingActual != null ? `${s.diff >= 0 ? "+" : ""}${formatCurrency(s.diff)}` : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{s.txCount}</td>
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
      return { ...table, drop, cashout, result: cashout - drop, txCount: tTx.length };
    }).filter(t => t.txCount > 0).sort((a, b) => b.drop - a.drop);
  }, [tables, transactions, from, to]);

  return (
    <div className="cms-panel overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {["Table", "Game", "Float", "Drop", "Cashout", "Result", "Txns"].map(h => (
              <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-3 py-2 ${["Table", "Game"].includes(h) ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.length === 0 ? (
            <tr><td colSpan={7} className="text-center text-muted-foreground text-sm py-6">No table data</td></tr>
          ) : tableData.map(t => (
            <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              <td className="px-3 py-2 text-sm font-medium text-card-foreground">{t.name}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{t.game}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(Number(t.float_amount))}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(t.drop)}</td>
              <td className="px-3 py-2 text-right font-mono text-xs text-card-foreground">{formatCurrency(t.cashout)}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${t.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {t.result >= 0 ? "+" : ""}{formatCurrency(t.result)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{t.txCount}</td>
            </tr>
          ))}
          {tableData.length > 0 && (
            <tr className="border-t-2 border-primary/30 bg-muted/30">
              <td colSpan={3} className="px-3 py-2 text-xs font-bold text-card-foreground uppercase">Totals</td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">{formatCurrency(tableData.reduce((s, t) => s + t.drop, 0))}</td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">{formatCurrency(tableData.reduce((s, t) => s + t.cashout, 0))}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${tableData.reduce((s, t) => s + t.result, 0) >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {formatCurrency(tableData.reduce((s, t) => s + t.result, 0))}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-muted-foreground">{tableData.reduce((s, t) => s + t.txCount, 0)}</td>
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
      return { ...p, drop, cashout, expTotal, result, realResult, txCount: pTx.length };
    }).filter(p => p.txCount > 0).sort((a, b) => b.drop - a.drop);
  }, [players, transactions, expenses, from, to]);

  return (
    <div className="cms-panel overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {["Player", "Drop", "Cashout", "Result", "Expenses", "Real Result", "Txns"].map(h => (
              <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-3 py-2 ${h === "Player" ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {playerData.length === 0 ? (
            <tr><td colSpan={7} className="text-center text-muted-foreground text-sm py-6">No player data</td></tr>
          ) : playerData.map(p => (
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
          {playerData.length > 0 && (
            <tr className="border-t-2 border-primary/30 bg-muted/30">
              <td className="px-3 py-2 text-xs font-bold text-card-foreground uppercase">Totals ({playerData.length} players)</td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">{formatCurrency(playerData.reduce((s, p) => s + p.drop, 0))}</td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-card-foreground">{formatCurrency(playerData.reduce((s, p) => s + p.cashout, 0))}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${playerData.reduce((s, p) => s + p.result, 0) >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {formatCurrency(playerData.reduce((s, p) => s + p.result, 0))}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-warning">{formatCurrency(playerData.reduce((s, p) => s + p.expTotal, 0))}</td>
              <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${playerData.reduce((s, p) => s + p.realResult, 0) >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {formatCurrency(playerData.reduce((s, p) => s + p.realResult, 0))}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-muted-foreground">{playerData.reduce((s, p) => s + p.txCount, 0)}</td>
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
      return { name: g.name, members: memberIds.length, drop, cashout, result: cashout - drop, realResult: cashout - drop - expTotal, expTotal };
    }).filter(g => g.members > 0);
  }, [groups, transactions, expenses, from, to]);

  return (
    <div className="cms-panel overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {["Group", "Members", "Drop", "Cashout", "Result", "Expenses", "Real Result"].map(h => (
              <th key={h} className={`text-xs font-medium text-muted-foreground uppercase px-3 py-2 ${["Group"].includes(h) ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupData.length === 0 ? (
            <tr><td colSpan={7} className="text-center text-muted-foreground text-sm py-6">No group data</td></tr>
          ) : groupData.map((g, i) => (
            <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
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

    return { total, approved, pending, count: filtered.length, byCategory, byPlayer: Object.entries(byPlayer).sort((a, b) => b[1].total - a[1].total) };
  }, [expenses, from, to]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="cms-panel p-2"><p className="uppercase text-muted-foreground tracking-wider text-lg">Total</p><p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(data.total)}</p></div>
        <div className="cms-panel p-2"><p className="uppercase text-muted-foreground tracking-wider text-lg">Approved</p><p className="font-mono font-bold text-success text-3xl">{formatCurrency(data.approved)}</p></div>
        <div className="cms-panel p-2"><p className="uppercase text-muted-foreground tracking-wider text-lg">Pending</p><p className="font-mono text-sm font-bold text-warning">{formatCurrency(data.pending)}</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* By Category */}
        <div className="cms-panel">
          <div className="cms-header text-xs">By Category</div>
          <div className="divide-y divide-border">
            {Object.entries(data.byCategory).sort((a, b) => b[1].total - a[1].total).map(([cat, v]) => (
              <div key={cat} className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono capitalize">{cat}</Badge>
                  <span className="text-[10px] text-muted-foreground">×{v.count}</span>
                </div>
                <span className="font-mono text-xs font-medium text-card-foreground">{formatCurrency(v.total)}</span>
              </div>
            ))}
            {Object.keys(data.byCategory).length === 0 && <p className="text-center text-muted-foreground text-xs py-4">No expenses</p>}
          </div>
        </div>

        {/* By Player */}
        <div className="cms-panel">
          <div className="cms-header text-xs">By Player</div>
          <div className="divide-y divide-border">
            {data.byPlayer.slice(0, 15).map(([id, v]) => (
              <div key={id} className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-card-foreground">{v.name}</span>
                  <span className="text-[10px] text-muted-foreground">×{v.count}</span>
                </div>
                <span className="font-mono text-xs font-medium text-card-foreground">{formatCurrency(v.total)}</span>
              </div>
            ))}
            {data.byPlayer.length === 0 && <p className="text-center text-muted-foreground text-xs py-4">No player-linked expenses</p>}
          </div>
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

  const byDate = useMemo(() => {
    const map: Record<string, { date: string; total: number; byTable: Record<string, number> }> = {};
    trackerData.forEach(t => {
      if (!map[t.date]) map[t.date] = { date: t.date, total: 0, byTable: {} };
      map[t.date].total += Number(t.value);
      map[t.date].byTable[t.table_id] = (map[t.date].byTable[t.table_id] || 0) + Number(t.value);
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [trackerData]);

  const grandTotal = trackerData.reduce((s, t) => s + Number(t.value), 0);

  return (
    <div className="space-y-3">
      <div className="cms-panel p-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{byDate.length} days tracked</span>
        <span className="font-mono text-sm font-bold text-primary">{formatCurrency(grandTotal)}</span>
      </div>

      <div className="cms-panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-3 py-2">Date</th>
              {tables.filter(t => t.status === "open").map(t => (
                <th key={t.id} className="text-right text-xs font-medium text-muted-foreground uppercase px-3 py-2">{t.name}</th>
              ))}
              <th className="text-right text-xs font-medium text-muted-foreground uppercase px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {byDate.length === 0 ? (
              <tr><td colSpan={tables.length + 2} className="text-center text-muted-foreground text-sm py-6">No tracker data</td></tr>
            ) : byDate.map(d => (
              <tr key={d.date} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 text-xs font-mono text-card-foreground">{d.date}</td>
                {tables.filter(t => t.status === "open").map(t => (
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

export default Reports;
