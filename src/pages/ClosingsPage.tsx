/**
 * Closings Hub — single surface for all post-close inspection & printing.
 * Tabs: Total | Live Game | Slots | Expenses.
 *
 * Rules (manager spec):
 *  · Show ONLY closed shifts (open shifts hidden until closed).
 *  · Slots day/night labels removed from UI (historical rows keep their type
 *    but no shift_type column is rendered).
 *  · Total tab shows: Drop Tables, Tables Result, Drop Slots (manual,
 *    inline-editable, stored on cage_slots_shifts.manual_drop_slots),
 *    Slots Result, Expenses (informational only — NOT subtracted),
 *    Total Results = Tables Result + Slots Result.
 *  · Every tab supports per-column sorting.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Landmark, Coins, Receipt, BarChart3, Printer,
  ChevronLeft, ChevronRight, CalendarDays,
  ArrowUp, ArrowDown, ArrowUpDown, Check,
} from "lucide-react";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDate, fmtDateTime } from "@/lib/format-date";
import ReprintShiftDialog from "@/components/cage/ReprintShiftDialog";
import PrintSlotsShiftDialog from "@/components/cage-slots/PrintSlotsShiftDialog";
import { useCageSlotsHistory } from "@/hooks/use-cage-slots";
import { useDailyExpenses } from "@/hooks/use-daily-expenses";
import { useCasino } from "@/lib/casino-context";
import PrintPortal from "@/components/cage/PrintPortal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ExpensesDayReport from "@/components/closings/ExpensesDayReport";
import { businessDayHourUTC, getBusinessDate } from "@/lib/business-day";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { toast } from "sonner";

type TabKey = "total" | "live" | "slots" | "expenses";

// ============================================================
// Sortable column header helper
// ============================================================
type SortDir = "asc" | "desc";
const useSort = <K extends string>(initialKey: K, initialDir: SortDir = "desc") => {
  const [key, setKey] = useState<K>(initialKey);
  const [dir, setDir] = useState<SortDir>(initialDir);
  const toggle = (k: K) => {
    if (k === key) setDir(d => d === "asc" ? "desc" : "asc");
    else { setKey(k); setDir("desc"); }
  };
  return { key, dir, toggle };
};

const SortTh = <K extends string>({
  label, sortKey, sort, align = "left",
}: {
  label: string; sortKey: K; sort: ReturnType<typeof useSort<K>>; align?: "left" | "right" | "center";
}) => {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      onClick={() => sort.toggle(sortKey)}
      className={`px-3 py-2 uppercase text-muted-foreground select-none cursor-pointer hover:text-foreground ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      }`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label}
        <Icon className={`w-3 h-3 ${active ? "text-foreground" : "opacity-40"}`} />
      </span>
    </th>
  );
};

const cmp = (a: any, b: any) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
};

const ClosingsPage = () => {
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as TabKey) || "total";
  const setTab = (t: TabKey) => { sp.set("tab", t); setSp(sp, { replace: true }); };

  const today = useMemo(() => new Date(), []);
  const [monthAnchor, setMonthAnchor] = useState<Date>(startOfMonth(today));
  const monthLabel = format(monthAnchor, "MMMM yyyy");
  const goPrev = () => setMonthAnchor((d) => startOfMonth(subMonths(d, 1)));
  const goNext = () => setMonthAnchor((d) => startOfMonth(addMonths(d, 1)));
  const goCurrent = () => setMonthAnchor(startOfMonth(today));
  const nextDisabled = monthAnchor >= startOfMonth(today);

  const showMonthNav = tab !== "expenses";

  return (
    <PageShell>
      <PageHeader
        icon={BarChart3}
        title="Closings"
        subtitle={showMonthNav ? `Per-day totals and printable shift reports · ${monthLabel}` : "Per-day totals and printable shift reports"}
        date
        centerSlot={showMonthNav ? (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 font-mono min-w-[140px]" onClick={goCurrent}>
              {monthLabel}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext} disabled={nextDisabled}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : undefined}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="total" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Total</TabsTrigger>
          <TabsTrigger value="live" className="gap-1.5"><Landmark className="w-3.5 h-3.5" /> Live Game</TabsTrigger>
          <TabsTrigger value="slots" className="gap-1.5"><Coins className="w-3.5 h-3.5" /> Slots</TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5"><Receipt className="w-3.5 h-3.5" /> Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="total"><TotalTab monthAnchor={monthAnchor} /></TabsContent>
        <TabsContent value="live"><LiveTab monthAnchor={monthAnchor} /></TabsContent>
        <TabsContent value="slots"><SlotsTab monthAnchor={monthAnchor} /></TabsContent>
        <TabsContent value="expenses"><ExpensesTab /></TabsContent>
      </Tabs>
    </PageShell>
  );
};

export default ClosingsPage;

// ============================================================
// TOTAL TAB — per-business-day rollup with manual Drop Slots editing
// ============================================================
type TotalSortKey = "date" | "dropTables" | "tablesResult" | "dropSlots" | "systemShiftResult" | "slotsResult" | "expenses" | "totalResults";

const TotalTab = ({ monthAnchor }: { monthAnchor: Date }) => {
  const { casinoId, roles } = useAuth();
  const qc = useQueryClient();
  const monthLabel = format(monthAnchor, "MMMM yyyy");
  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = startOfMonth(addMonths(monthAnchor, 1));
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");
  const canEditDrop = roles.includes("super_admin") || roles.includes("manager") ||
                      roles.includes("floor_manager") || roles.includes("finance_manager");

  const sort = useSort<TotalSortKey>("date", "desc");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["closings-total", casinoId, monthStartStr],
    queryFn: async () => {
      if (!casinoId) return [];
      const fromIso = businessDayHourUTC(monthStartStr, 7);
      const toIso = businessDayHourUTC(monthEndStr, 7);

      const [liveRes, slotsRes, expRes, dropRes] = await Promise.all([
        // Closed live shifts only
        supabase
          .from("shifts")
          .select("id, opened_at, closed_at, tables_result")
          .eq("casino_id", casinoId)
          .eq("status", "closed")
          .gte("closed_at", fromIso)
          .lt("closed_at", toIso)
          .limit(500),
        // Closed slots shifts only
        supabase
          .from("cage_slots_shifts")
          .select("id, business_date, status, system_shift_result, ace_fills, slots_result, manual_drop_slots")
          .eq("casino_id", casinoId)
          .eq("status", "closed")
          .gte("business_date", monthStartStr)
          .lt("business_date", monthEndStr)
          .limit(500),
        supabase
          .from("expenses")
          .select("amount, created_at, source")
          .eq("casino_id", casinoId)
          .gte("created_at", fromIso)
          .lt("created_at", toIso)
          .limit(5000),
        // Drop = sum of 'buy' transactions for live game by business day
        supabase
          .from("transactions")
          .select("amount, created_at, type")
          .eq("casino_id", casinoId)
          .eq("type", "buy")
          .is("cancelled_at", null)
          .gte("created_at", fromIso)
          .lt("created_at", toIso)
          .limit(20000),
      ]);
      if (liveRes.error) throw liveRes.error;
      if (slotsRes.error) throw slotsRes.error;
      if (expRes.error) throw expRes.error;
      if (dropRes.error) throw dropRes.error;

      // Canonical 07:00 EAT rollover (matches DB business_date_of).
      const eatDate = (iso: string) => {
        const d = new Date(iso);
        const hh = parseInt(d.toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", hour12: false }), 10);
        const tgt = hh < 7 ? new Date(d.getTime() - 86400_000) : d;
        return tgt.toLocaleDateString("en-CA", { timeZone: "Africa/Dar_es_Salaam" });
      };

      const map: Record<string, any> = {};
      const row = (d: string) => (map[d] ||= {
        date: d,
        dropTables: 0,
        tablesResult: 0,
        dropSlots: 0,
        systemShiftResult: 0,
        slotsResult: 0,
        expenses: 0,
        slotsShiftIds: [] as string[],
      });

      (liveRes.data || []).forEach((s: any) => {
        const d = s.closed_at ? eatDate(s.closed_at) : null;
        if (!d) return;
        const r = row(d);
        r.tablesResult += Number(s.tables_result || 0);
      });
      (slotsRes.data || []).forEach((s: any) => {
        const r = row(s.business_date);
        r.systemShiftResult += Number(s.system_shift_result || 0);
        r.slotsResult += Number(s.slots_result || 0);
        r.dropSlots += Number(s.manual_drop_slots || 0);
        r.slotsShiftIds.push(s.id);
      });
      (expRes.data || []).forEach((e: any) => {
        const r = row(eatDate(e.created_at));
        r.expenses += Number(e.amount || 0);
      });
      (dropRes.data || []).forEach((t: any) => {
        const r = row(eatDate(t.created_at));
        r.dropTables += Number(t.amount || 0);
      });

      return Object.values(map);
    },
    enabled: !!casinoId,
  });

  const sorted = useMemo(() => {
    const arr = [...rows] as any[];
    arr.sort((a, b) => {
      const k = sort.key;
      const av = k === "totalResults" ? a.tablesResult + a.slotsResult : a[k];
      const bv = k === "totalResults" ? b.tablesResult + b.slotsResult : b[k];
      return sort.dir === "asc" ? cmp(av, bv) : cmp(bv, av);
    });
    return arr;
  }, [rows, sort.key, sort.dir]);

  // Inline editor for Drop Slots
  const updateDropSlots = useMutation({
    mutationFn: async ({ shiftIds, value }: { shiftIds: string[]; value: number }) => {
      if (!shiftIds.length) throw new Error("No closed slots shift for this day yet");
      // Apply the full value to the first shift; zero out the rest to avoid
      // duplication when historical data has multiple shifts per day.
      const [first, ...rest] = shiftIds;
      const r1 = await supabase.from("cage_slots_shifts").update({ manual_drop_slots: value } as any).eq("id", first);
      if (r1.error) throw r1.error;
      if (rest.length) {
        const r2 = await supabase.from("cage_slots_shifts").update({ manual_drop_slots: 0 } as any).in("id", rest);
        if (r2.error) throw r2.error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["closings-total"] });
      toast.success("Drop Slots updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update"),
  });

  return (
    <div className="cms-panel">
      <div className="cms-header">
        Daily Totals · {monthLabel} (closed shifts only)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-card">
            <tr className="border-b border-border">
              <SortTh label="Business Day" sortKey="date" sort={sort} />
              <SortTh label="Drop Tables" sortKey="dropTables" sort={sort} align="right" />
              <SortTh label="Tables Result" sortKey="tablesResult" sort={sort} align="right" />
              <SortTh label="Drop Slots" sortKey="dropSlots" sort={sort} align="right" />
              <SortTh label="System Shift Result" sortKey="systemShiftResult" sort={sort} align="right" />
              <SortTh label="Slots Result" sortKey="slotsResult" sort={sort} align="right" />
              <SortTh label="Expenses" sortKey="expenses" sort={sort} align="right" />
              <SortTh label="Total Results" sortKey="totalResults" sort={sort} align="right" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Loading…</td></tr> :
             sorted.length === 0 ? <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">No closed shifts</td></tr> :
             sorted.map((r: any) => {
              const totalResults = (r.tablesResult || 0) + (r.slotsResult || 0);
              const cls = (n: number) => n < 0 ? "cms-amount-negative" : n > 0 ? "cms-amount-positive" : "text-muted-foreground";
              const slotsShiftIds: string[] = Array.isArray(r.slotsShiftIds) ? r.slotsShiftIds : [];
              return (
                <tr key={r.date} className="border-b border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{formatNumberSpaces(r.dropTables || 0)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${cls(r.tablesResult || 0)}`}>{formatNumberSpaces(r.tablesResult || 0)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    <DropSlotsCell
                      value={r.dropSlots || 0}
                      canEdit={canEditDrop && slotsShiftIds.length > 0}
                      onSave={(v) => updateDropSlots.mutate({ shiftIds: slotsShiftIds, value: v })}
                    />
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${cls(r.systemShiftResult || 0)}`}>{formatNumberSpaces(r.systemShiftResult || 0)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${cls(r.slotsResult || 0)}`}>{formatNumberSpaces(r.slotsResult || 0)}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{formatNumberSpaces(r.expenses || 0)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-bold ${cls(totalResults)}`}>{formatNumberSpaces(totalResults)}</td>
                </tr>
              );
             })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DropSlotsCell = ({ value, canEdit, onSave }: { value: number; canEdit: boolean; onSave: (v: number) => void }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  if (!canEdit) {
    return <span className="text-muted-foreground">{value ? formatNumberSpaces(value) : "·"}</span>;
  }
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(String(value || "")); setEditing(true); }}
        className="hover:bg-muted/50 rounded px-1.5 py-0.5 -my-0.5 transition-colors"
      >
        {value ? formatNumberSpaces(value) : <span className="text-muted-foreground/50">+ add</span>}
      </button>
    );
  }
  const save = () => {
    const n = Number(draft) || 0;
    onSave(n);
    setEditing(false);
  };
  return (
    <span className="inline-flex items-center gap-1">
      <Input
        type="number"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-7 w-24 text-right font-mono text-xs"
      />
      <Check className="w-3 h-3 text-muted-foreground" />
    </span>
  );
};

// ============================================================
// LIVE TAB — closed shifts only, sortable
// ============================================================
type LiveSortKey = "opened" | "closed" | "cash" | "miss" | "tables" | "balance";

const LiveTab = ({ monthAnchor }: { monthAnchor: Date }) => {
  const { casinoId } = useAuth();
  const [reprintId, setReprintId] = useState<string | null>(null);
  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = startOfMonth(addMonths(monthAnchor, 1));
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");
  const sort = useSort<LiveSortKey>("closed", "desc");

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["closings-live", casinoId, monthStartStr],
    queryFn: async () => {
      if (!casinoId) return [];
      // Business-day window: [monthStart 07:00 EAT, nextMonth 07:00 EAT)
      // so a shift closed at 05:00 EAT on the 1st belongs to the previous month.
      const fromIso = businessDayHourUTC(monthStartStr, 7);
      const toIso = businessDayHourUTC(monthEndStr, 7);
      const { data, error } = await supabase
        .from("shifts")
        .select("id, opened_at, closed_at, cash_result, miss_total, tables_result, balance, notes")
        .eq("casino_id", casinoId)
        .eq("status", "closed")
        .gte("closed_at", fromIso)
        .lt("closed_at", toIso)
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!casinoId,
  });

  const sorted = useMemo(() => {
    const arr = [...shifts] as any[];
    const keyMap: Record<LiveSortKey, (s: any) => any> = {
      opened: s => s.opened_at,
      closed: s => s.closed_at,
      cash: s => Number(s.cash_result || 0),
      miss: s => Number(s.miss_total || 0),
      tables: s => Number(s.tables_result || 0),
      balance: s => Number(s.balance || 0),
    };
    const get = keyMap[sort.key];
    arr.sort((a, b) => sort.dir === "asc" ? cmp(get(a), get(b)) : cmp(get(b), get(a)));
    return arr;
  }, [shifts, sort.key, sort.dir]);

  return (
    <div className="cms-panel">
      <div className="cms-header">
        Live Game Closings · {format(monthAnchor, "MMMM yyyy")} ({shifts.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-card">
            <tr className="border-b border-border">
              <SortTh label="Opened" sortKey="opened" sort={sort} />
              <SortTh label="Closed" sortKey="closed" sort={sort} />
              <SortTh label="Cash" sortKey="cash" sort={sort} align="right" />
              <SortTh label="Miss" sortKey="miss" sort={sort} align="right" />
              <SortTh label="Tables" sortKey="tables" sort={sort} align="right" />
              <SortTh label="Balance" sortKey="balance" sort={sort} align="right" />
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Loading…</td></tr> :
             sorted.length === 0 ? <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No closings</td></tr> :
             sorted.map((s: any) => {
              const cash = Number(s.cash_result || 0);
              const tables = Number(s.tables_result || 0);
              const balance = Number(s.balance || 0);
              const miss = Number(s.miss_total || 0);
              const cls = (n: number) => n < 0 ? "cms-amount-negative" : n > 0 ? "cms-amount-positive" : "text-muted-foreground";
              return (
                <tr key={s.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-[11px]">{s.opened_at ? fmtDateTime(s.opened_at) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{s.closed_at ? fmtDateTime(s.closed_at) : "—"}</td>
                  <td className={`px-3 py-2 text-right font-mono ${cls(cash)}`}>{formatNumberSpaces(cash)}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{formatNumberSpaces(miss)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${cls(tables)}`}>{formatNumberSpaces(tables)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${cls(balance)}`}>{formatNumberSpaces(balance)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => setReprintId(s.id)}>
                      <Printer className="w-3 h-3" /> Print
                    </Button>
                  </td>
                </tr>
              );
             })}
          </tbody>
        </table>
      </div>
      {reprintId && casinoId && (
        <ReprintShiftDialog open onClose={() => setReprintId(null)} shiftId={reprintId} casinoId={casinoId} />
      )}
    </div>
  );
};

// ============================================================
// SLOTS TAB — closed shifts only, no shift_type column, sortable
// ============================================================
type SlotsSortKey = "date" | "systemShiftResult" | "slotsResult" | "cdr" | "balance";

const SlotsTab = ({ monthAnchor }: { monthAnchor: Date }) => {
  const { data: shiftsRaw = [], isLoading } = useCageSlotsHistory(500);
  const monthStartStr = format(startOfMonth(monthAnchor), "yyyy-MM-dd");
  const monthEndStr = format(startOfMonth(addMonths(monthAnchor, 1)), "yyyy-MM-dd");
  const monthLabel = format(monthAnchor, "MMMM yyyy");
  const shifts = useMemo(
    () => shiftsRaw.filter((s: any) =>
      s.status === "closed" &&
      s.business_date >= monthStartStr &&
      s.business_date < monthEndStr
    ),
    [shiftsRaw, monthStartStr, monthEndStr]
  );
  const [printId, setPrintId] = useState<string | null>(null);
  const sort = useSort<SlotsSortKey>("date", "desc");

  const sorted = useMemo(() => {
    const arr = [...shifts] as any[];
    const keyMap: Record<SlotsSortKey, (s: any) => any> = {
      date: s => s.business_date,
      systemShiftResult: s => Number(s.system_shift_result || 0),
      slotsResult: s => Number(s.slots_result || 0),
      cdr: s => Number(s.cash_desk_result || 0),
      balance: s => Number(s.balance || 0),
    };
    const get = keyMap[sort.key];
    arr.sort((a, b) => sort.dir === "asc" ? cmp(get(a), get(b)) : cmp(get(b), get(a)));
    return arr;
  }, [shifts, sort.key, sort.dir]);

  return (
    <div className="cms-panel">
      <div className="cms-header">Slots Closings · {monthLabel} ({shifts.length})</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-card">
            <tr className="border-b border-border">
              <SortTh label="Business Day" sortKey="date" sort={sort} />
              <SortTh label="System Shift Result" sortKey="systemShiftResult" sort={sort} align="right" />
              <SortTh label="Slots Result" sortKey="slotsResult" sort={sort} align="right" />
              <SortTh label="Cash Desk" sortKey="cdr" sort={sort} align="right" />
              <SortTh label="Balance" sortKey="balance" sort={sort} align="right" />
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</td></tr> :
             sorted.length === 0 ? <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No closings</td></tr> :
             sorted.map((s: any) => {
              const sysRes = Number(s.system_shift_result || 0);
              const slotsRes = Number(s.slots_result || 0);
              const cdr = Number(s.cash_desk_result || 0);
              const balance = Number(s.balance || 0);
              const cls = (n: number) => n < 0 ? "cms-amount-negative" : n > 0 ? "cms-amount-positive" : "text-muted-foreground";
              return (
                <tr key={s.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono">{fmtDate(s.business_date)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${cls(sysRes)}`}>{formatNumberSpaces(sysRes)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${cls(slotsRes)}`}>{formatNumberSpaces(slotsRes)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${cls(cdr)}`}>{formatNumberSpaces(cdr)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${cls(balance)}`}>{formatNumberSpaces(balance)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => setPrintId(s.id)}>
                      <Printer className="w-3 h-3" /> Print
                    </Button>
                  </td>
                </tr>
              );
             })}
          </tbody>
        </table>
      </div>
      {printId && (
        <PrintSlotsShiftDialog open shiftId={printId} onClose={() => setPrintId(null)} />
      )}
    </div>
  );
};

// ============================================================
// EXPENSES TAB — sortable, all sources visible
// ============================================================
type ExpSortKey = "time" | "source" | "category" | "amount" | "description" | "player" | "approved";

const ExpensesTab = () => {
  const { data: serverDate } = useEffectiveBusinessDate();
  const { activeCasino } = useCasino();
  const [date, setDate] = useState<string>(() => serverDate || getBusinessDate());
  const [source, setSource] = useState<"all" | "live_game" | "slots" | "office">("all");
  const [print, setPrint] = useState(false);
  const sort = useSort<ExpSortKey>("time", "desc");

  const { data: rows = [], isLoading } = useDailyExpenses(date);
  const filtered = useMemo(() => {
    if (source === "all") return rows;
    return rows.filter((r: any) => {
      const s = (r.source || (r.cage_type === "slots" ? "slots" : "live_game")).toLowerCase();
      return s === source;
    });
  }, [rows, source]);

  const sorted = useMemo(() => {
    const arr = [...filtered] as any[];
    const keyMap: Record<ExpSortKey, (r: any) => any> = {
      time: r => r.created_at,
      source: r => (r.source || (r.cage_type === "slots" ? "slots" : "live_game")),
      category: r => r.category_code || r.category,
      amount: r => Number(r.amount || 0),
      description: r => r.description || "",
      player: r => r.players ? `${r.players.first_name || ""} ${r.players.last_name || ""}`.trim() : r.player_name || "",
      approved: r => r.approved ? 1 : 0,
    };
    const get = keyMap[sort.key];
    arr.sort((a, b) => sort.dir === "asc" ? cmp(get(a), get(b)) : cmp(get(b), get(a)));
    return arr;
  }, [filtered, sort.key, sort.dir]);

  const total = sorted.reduce((a: number, r: any) => a + Number(r.amount || 0), 0);

  const shiftDate = (delta: number) => {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="cms-panel">
      <div className="cms-header flex items-center justify-between flex-wrap gap-2">
        <span className="flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5" /> Expenses · {fmtDate(date)} ({sorted.length})</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => shiftDate(-1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 px-2 text-xs rounded border border-border bg-background font-mono" />
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => shiftDate(1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
          <div className="mx-2 h-5 border-l border-border" />
          {(["all", "live_game", "slots", "office"] as const).map(s => (
            <Button key={s} size="sm" variant={source === s ? "default" : "outline"} className="h-7 text-[11px] uppercase" onClick={() => setSource(s)}>{s.replace("_", " ")}</Button>
          ))}
          <Button size="sm" variant="outline" className="h-7 gap-1 ml-2" onClick={() => setPrint(true)}><Printer className="w-3.5 h-3.5" /> Print</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-card">
            <tr className="border-b border-border">
              <SortTh label="Time" sortKey="time" sort={sort} />
              <SortTh label="Source" sortKey="source" sort={sort} />
              <SortTh label="Category" sortKey="category" sort={sort} />
              <SortTh label="Amount" sortKey="amount" sort={sort} align="right" />
              <SortTh label="Description" sortKey="description" sort={sort} />
              <SortTh label="Player" sortKey="player" sort={sort} />
              <SortTh label="Approved" sortKey="approved" sort={sort} align="center" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Loading…</td></tr> :
             sorted.length === 0 ? <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No expenses</td></tr> :
             sorted.map((r: any) => {
              const src = (r.source || (r.cage_type === "slots" ? "slots" : "live_game")).toLowerCase();
              const player = r.players ? `${r.players.first_name || ""} ${r.players.last_name || ""}`.trim() : r.player_name || "";
              return (
                <tr key={r.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{fmtDateTime(r.created_at).slice(-5)}</td>
                  <td className="px-3 py-2 uppercase text-[10px] font-bold">{src.replace("_", " ")}</td>
                  <td className="px-3 py-2 uppercase">{r.category_code || r.category}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatNumberSpaces(Number(r.amount || 0))}</td>
                  <td className="px-3 py-2 truncate max-w-[280px] text-muted-foreground">{r.description}</td>
                  <td className="px-3 py-2 text-muted-foreground">{player || "—"}</td>
                  <td className="px-3 py-2 text-center">{r.approved ? "✓" : ""}</td>
                </tr>
              );
             })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td colSpan={3} className="px-3 py-2 text-right">TOTAL</td>
              <td className="px-3 py-2 text-right font-mono">{formatNumberSpaces(total)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
      {print && (
        <Dialog open onOpenChange={(v) => !v && setPrint(false)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Expenses · {fmtDate(date)}</DialogTitle></DialogHeader>
            <div className="border border-border rounded-md overflow-hidden bg-white print:hidden">
              <div className="origin-top-left scale-[0.85] w-[117%]">
                <ExpensesDayReport casinoName={activeCasino?.name || ""} businessDate={date} rows={sorted as any} />
              </div>
            </div>
            <PrintPortal>
              <div className="expenses-print-area hidden print:block">
                <ExpensesDayReport casinoName={activeCasino?.name || ""} businessDate={date} rows={sorted as any} />
              </div>
            </PrintPortal>
            <DialogFooter className="print:hidden">
              <Button variant="outline" onClick={() => setPrint(false)}>Close</Button>
              <Button onClick={() => window.print()} className="gap-1.5"><Printer className="w-4 h-4" /> Print</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
