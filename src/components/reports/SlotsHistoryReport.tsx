/**
 * SlotsHistoryReport — read-only Slots cage shift history over an arbitrary
 * business-day range. Migrated to DataTable v2 + MoneyCell (Full/Compact toggle).
 */
import { Fragment, KeyboardEvent, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoneyFull } from "@/lib/format-money";
import { fmtDate, fmtDateTime } from "@/lib/format-date";
import {
  useCageSlotsHistory,
  useSlotsCashlessAggByShift,
  useSlotsClosingTotalsByShift,
} from "@/hooks/use-cage-slots";
import PrintSlotsShiftDialog from "@/components/cage-slots/PrintSlotsShiftDialog";
import SlotsShiftReportBody from "@/components/cage-slots/SlotsShiftReportBody";
import {
  DataTable, DTHead, DTBody, DTRow, DTHeader, DTCell,
} from "@/components/ui/data-table";
import { MoneyCell } from "@/components/ui/money-cell";
import { useMoneyMode } from "@/components/ui/data-table-toolbar";

const NORMALIZE_PROVIDER = (k: string): string | null => {
  const v = String(k || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (v.includes("mpesa")) return "MPESA";
  if (v.includes("tigo") || v.includes("tpesa")) return "TIGO";
  if (v.includes("halo") || v.includes("hpesa")) return "HALOTEL";
  if (v.includes("airtel")) return "AIRTEL";
  return null;
};

type SortKey =
  | "business_date" | "status" | "system" | "slots" | "cdr"
  | "miss" | "clIn" | "clOut" | "clNet" | "balance";
type SortDir = "asc" | "desc";

const SlotsHistoryReport = ({ from, to, embedded = false }: { from: string; to: string; embedded?: boolean }) => {
  const { data: allShifts = [], isLoading } = useCageSlotsHistory(500);
  const [mode, MoneyToggle] = useMoneyMode("slots-history-report");

  const shifts = useMemo(() => {
    return allShifts.filter((s: any) => {
      if (s.status !== "closed" && s.status !== "reviewed") return false;
      const d = s.business_date;
      return d >= from && d <= to;
    });
  }, [allShifts, from, to]);

  const shiftIds = shifts.map((s: any) => s.id);
  const { data: cashlessAgg = {} } = useSlotsCashlessAggByShift(shiftIds);
  const { data: closingTotals = {} } = useSlotsClosingTotalsByShift(shiftIds);
  const [printShiftId, setPrintShiftId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "business_date", dir: "desc" });

  const rows = useMemo(() => {
    return shifts.map((s: any) => {
      const ct = (closingTotals as any)[s.id];
      const balance = Number(s.balance ?? ct?.shift_balance ?? 0);
      const cdr = Number(s.cash_desk_result ?? s.actual_cage_result ?? 0);
      const cMiss = Number(s.cards_miss || 0);
      const sysRes = Number(s.system_shift_result || 0);
      const slotsRes = Number(s.slots_result || 0);

      const providersFromShift: Record<string, { in: number; out: number }> = {};
      const addProv = (raw: any, dir: "in" | "out") => {
        if (!raw || typeof raw !== "object") return;
        Object.entries(raw).forEach(([k, v]) => {
          const norm = NORMALIZE_PROVIDER(k);
          if (!norm) return;
          const pv = (providersFromShift[norm] ||= { in: 0, out: 0 });
          pv[dir] += Number(v || 0);
        });
      };
      addProv(s.cashless_in_providers, "in");
      addProv(s.cashless_out_providers, "out");
      const shiftClIn = Object.values(providersFromShift).reduce((a, p) => a + p.in, 0);
      const shiftClOut = Object.values(providersFromShift).reduce((a, p) => a + p.out, 0);

      const txAgg = (cashlessAgg as any)[s.id];
      const txIn = txAgg?.in || 0;
      const txOut = txAgg?.out || 0;

      const clIn = txIn || shiftClIn || (ct?.cashless_in ?? 0);
      const clOut = txOut || shiftClOut || (ct?.cashless_out ?? 0);
      const clNet = clIn - clOut;

      return { s, balance, cdr, cMiss, sysRes, slotsRes, clIn, clOut, clNet };
    });
  }, [shifts, cashlessAgg, closingTotals]);

  const totals = useMemo(() => ({
    shifts: rows.length,
    slotsResult: rows.reduce((a, r) => a + r.slotsRes, 0),
    cdr: rows.reduce((a, r) => a + r.cdr, 0),
    cashlessNet: rows.reduce((a, r) => a + r.clNet, 0),
    miss: rows.reduce((a, r) => a + r.cMiss, 0),
    balance: rows.reduce((a, r) => a + r.balance, 0),
  }), [rows]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    const get = (r: typeof rows[number]): number | string => {
      switch (sort.key) {
        case "business_date": return r.s.business_date;
        case "status":        return r.s.status;
        case "system":        return r.sysRes;
        case "slots":         return r.slotsRes;
        case "cdr":           return r.cdr;
        case "miss":          return r.cMiss;
        case "clIn":          return r.clIn;
        case "clOut":         return r.clOut;
        case "clNet":         return r.clNet;
        case "balance":       return r.balance;
      }
    };
    arr.sort((a, b) => {
      const va = get(a); const vb = get(b);
      if (typeof va === "number" && typeof vb === "number") return sort.dir === "asc" ? va - vb : vb - va;
      const sa = String(va); const sb = String(vb);
      return sort.dir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return arr;
  }, [rows, sort]);

  const toggleSort = (k: SortKey) =>
    setSort(s => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }));

  const sortArrow = (k: SortKey) => sort.key === k ? (sort.dir === "asc" ? " ↑" : " ↓") : "";

  const signCls = (n: number) => n > 0 ? "cms-amount-positive" : n < 0 ? "cms-amount-negative" : "";

  return (
    <div className="space-y-3">
      {/* KPI summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {[
          { label: "Shifts", value: String(totals.shifts), cls: "text-card-foreground", raw: false },
          { label: "Slots Result", value: totals.slotsResult, cls: signCls(totals.slotsResult), raw: true },
          { label: "Cash Desk Result", value: totals.cdr, cls: signCls(totals.cdr), raw: true },
          { label: "Cashless Net", value: totals.cashlessNet, cls: signCls(totals.cashlessNet), raw: true },
          { label: "Cards Miss", value: totals.miss, cls: "text-warning", raw: true },
          { label: "Balance", value: totals.balance, cls: signCls(totals.balance), raw: true },
        ].map((c) => (
          <div key={c.label} className="cms-panel p-2">
            <p className="uppercase text-muted-foreground tracking-wider text-[10px]">{c.label}</p>
            <p className={`font-mono text-sm font-bold ${c.cls}`}>
              {c.raw ? formatMoneyFull(c.value as number) : (c.value as string)}
            </p>
          </div>
        ))}
      </div>

      {!embedded && (
        <div className="flex items-center justify-end">
          <MoneyToggle />
        </div>
      )}

      <DataTable stickyFirstColumn>
        <DTHead>
          <DTRow>
            <DTHeader type="date" className="cursor-pointer select-none" onClick={() => toggleSort("business_date")}>
              Business Day{sortArrow("business_date")}
            </DTHeader>
            <DTHeader type="status" className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
              Status{sortArrow("status")}
            </DTHeader>
            <DTHeader type="date">Opened</DTHeader>
            <DTHeader type="date">Closed</DTHeader>
            <DTHeader type="money" className="cursor-pointer select-none" onClick={() => toggleSort("system")}>System{sortArrow("system")}</DTHeader>
            <DTHeader type="money" className="cursor-pointer select-none" onClick={() => toggleSort("slots")}>Slots Result{sortArrow("slots")}</DTHeader>
            <DTHeader type="money" className="cursor-pointer select-none" onClick={() => toggleSort("cdr")}>Cash Desk Result{sortArrow("cdr")}</DTHeader>
            <DTHeader type="money" className="cursor-pointer select-none" onClick={() => toggleSort("miss")}>Cards Miss{sortArrow("miss")}</DTHeader>
            <DTHeader type="money" className="cursor-pointer select-none" onClick={() => toggleSort("clIn")}>Cashless IN{sortArrow("clIn")}</DTHeader>
            <DTHeader type="money" className="cursor-pointer select-none" onClick={() => toggleSort("clOut")}>Cashless OUT{sortArrow("clOut")}</DTHeader>
            <DTHeader type="money" className="cursor-pointer select-none" onClick={() => toggleSort("clNet")}>Cashless NET{sortArrow("clNet")}</DTHeader>
            <DTHeader type="money" className="cursor-pointer select-none" onClick={() => toggleSort("balance")}>Balance{sortArrow("balance")}</DTHeader>
            <DTHeader type="actions" />
          </DTRow>
        </DTHead>
        <DTBody>
          {isLoading && (
            <DTRow><DTCell colSpan={13} className="text-center text-muted-foreground py-4">Loading…</DTCell></DTRow>
          )}
          {!isLoading && sorted.length === 0 && (
            <DTRow><DTCell colSpan={13} className="text-center text-muted-foreground py-4">No closed slots shifts in range</DTCell></DTRow>
          )}
          {sorted.map(({ s, balance, cdr, cMiss, sysRes, slotsRes, clIn, clOut, clNet }) => {
            const isExpanded = expandedId === s.id;
            const toggleExpanded = () => setExpandedId(isExpanded ? null : s.id);
            const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleExpanded();
              }
            };
            return (
              <Fragment key={s.id}>
                <DTRow
                  className={`cursor-pointer ${isExpanded ? "bg-accent/20" : ""}`}
                  onClick={toggleExpanded}
                  onKeyDown={onRowKeyDown}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <DTCell type="date">
                    <span className="inline-flex items-center gap-1">
                      {isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                      {fmtDate(s.business_date)}
                    </span>
                  </DTCell>
                  <DTCell type="status"><Badge variant="outline" className="text-[10px] uppercase">{String(s.status).replace("_", " ")}</Badge></DTCell>
                  <DTCell type="date" className="text-muted-foreground">{fmtDateTime(s.opened_at)}</DTCell>
                  <DTCell type="date" className="text-muted-foreground">{s.closed_at ? fmtDateTime(s.closed_at) : "·"}</DTCell>
                  <DTCell type="money"><MoneyCell value={sysRes} mode={mode} /></DTCell>
                  <DTCell type="money"><MoneyCell value={slotsRes} mode={mode} signed /></DTCell>
                  <DTCell type="money"><MoneyCell value={cdr} mode={mode} signed /></DTCell>
                  <DTCell type="money"><MoneyCell value={cMiss} mode={mode} empty="·" className={cMiss < 0 ? "cms-amount-negative" : ""} /></DTCell>
                  <DTCell type="money"><MoneyCell value={clIn || null} mode={mode} empty="·" className={clIn ? "cms-amount-positive" : ""} /></DTCell>
                  <DTCell type="money"><MoneyCell value={clOut ? -clOut : null} mode={mode} empty="·" className={clOut ? "cms-amount-negative" : ""} /></DTCell>
                  <DTCell type="money"><MoneyCell value={clNet || null} mode={mode} signed empty="·" /></DTCell>
                  <DTCell type="money"><MoneyCell value={balance} mode={mode} signed /></DTCell>
                  <DTCell type="actions" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => setPrintShiftId(s.id)} className="gap-1 h-7">
                      <Printer className="w-3.5 h-3.5" /> Print
                    </Button>
                  </DTCell>
                </DTRow>
                {isExpanded && (
                  <DTRow className="bg-muted/10">
                    <DTCell colSpan={13} className="p-3">
                      <SlotsShiftReportBody id={s.id} showHeader={false} compact />
                    </DTCell>
                  </DTRow>
                )}
              </Fragment>
            );
          })}
        </DTBody>
      </DataTable>

      {printShiftId && (
        <PrintSlotsShiftDialog open shiftId={printShiftId} onClose={() => setPrintShiftId(null)} />
      )}
    </div>
  );
};

export default SlotsHistoryReport;
