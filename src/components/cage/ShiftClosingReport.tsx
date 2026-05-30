/**
 * ShiftClosingReport — printable consolidating cash desk report.
 *
 * Mirrors the legacy paper form: tables (Open / Fill / Credit / Close / Drop /
 * Grand Total), Cash Flow Opener / Closer per currency + mobile, summary panel
 * (Tables Result, Fills, Credits, Miss Chips, Expenses, Tips, Shift Balance)
 * and signature lines.
 *
 * Fully self-contained: fetches chip baselines, cage transfers and table
 * tracker for the shift's business day on its own. Designed for window.print().
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CHIP_DENOMS, CURRENCIES, formatNumberSpaces, CASH_DENOMS } from "@/lib/currency";
import { fmtDate } from "@/lib/format-date";
import { buildLatestTableSnapshot, chipSnapshotResult, type BaselineMap } from "@/lib/table-live-result";
// Authoritative Result is computed server-side via compute_shift_table_results RPC.
// Snapshot index is still loaded for backward-compatible fallback only.
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  shift: Tables<"shifts">;
  tables: Tables<"gaming_tables">[];
  /** Closing snapshot from CloseShiftDialog (chips, cash, mobile, bank, totals) */
  closingCount: any;
  /** From shift.opening_float */
  openingFloat: any;
  exchangeRates: Record<string, number>;
  totalExpenses: number;
  missTotal: number;
  resultTable: number;
  balance: number;
  businessDate: string;
  cashierName?: string;
  managerName?: string;
}

const sumChipsObj = (chips: Record<string | number, number> | undefined) => {
  if (!chips) return 0;
  return Object.entries(chips).reduce((s, [d, q]) => s + Number(d) * (Number(q) || 0), 0);
};

const ShiftClosingReport = ({
  shift, tables, closingCount, openingFloat, exchangeRates,
  totalExpenses, missTotal, resultTable, balance, businessDate,
  cashierName, managerName,
}: Props) => {
  const { casinoId } = useAuth();
  const [casinoName, setCasinoName] = useState("Casino");
  const [baselines, setBaselines] = useState<Record<string, number>>({}); // tableId -> TZS value
  const [baselineByDenom, setBaselineByDenom] = useState<BaselineMap>({}); // tableId -> denom -> qty (Pit baseline)
  const [snapshotIndex, setSnapshotIndex] = useState<ReturnType<typeof buildLatestTableSnapshot>>({});
  const [fillCredits, setFillCredits] = useState<Record<string, { fill: number; credit: number }>>({});
  const [cashFlowTransfers, setCashFlowTransfers] = useState({ addFloat: 0, slotsOut: 0 });
  /** IN per table = sum of all Cash Desk IN transactions (type 'buy' or 'in')
   *  for this shift, grouped by table_id. */
  const [inByTable, setInByTable] = useState<Record<string, number>>({});
  /** Imported daily results (legacy import path) — when present, take precedence
   *  for Open/Fill/Credit/Close columns; Result still comes from snapshot. */
  const [dailyResults, setDailyResults] = useState<Record<string, {
    open: number; fill: number; credit: number; close: number; drop: number; result: number;
  }>>({});
  /** Authoritative per-table Result computed by DB RPC
   *  `compute_shift_table_results` — formula (Σ(actual−baseline)·denom) − Fill + Credit. */
  const [serverResults, setServerResults] = useState<Record<string, number>>({});
  /** Tips for the business day, split by shift_type. Informational only —
   *  tips are NOT part of Shift Balance. */
  const [tipsByShift, setTipsByShift] = useState<{ day: number; night: number }>({ day: 0, night: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!casinoId || !shift) return;
      const [{ data: c }, { data: bl }, { data: tr }, { data: tdr }, { data: tx }, { data: snaps }] = await Promise.all([
        supabase.from("casinos").select("name").eq("id", casinoId).maybeSingle(),
        supabase.from("chip_baseline").select("location_id, denomination, expected_quantity")
          .eq("casino_id", casinoId).eq("location_type", "table"),
        supabase.from("cage_transfers").select("table_id, transfer_type, amount")
          .eq("shift_id", shift.id).in("transfer_type", ["fill", "credit", "add_float", "slots_out"]),
        businessDate
          ? supabase.from("table_daily_results")
              .select("table_id, open, fill, credit, close, drop_amount, result")
              .eq("casino_id", casinoId).eq("date", businessDate)
          : Promise.resolve({ data: [] as any[] } as any),
        supabase.from("transactions").select("table_id, type, amount")
          .eq("shift_id", shift.id).in("type", ["buy", "in"]).is("cancelled_at", null),
        // Pit's Chip Count snapshots for this shift's business day. Result =
        // (latest snapshot.actual − chip_baseline.expected) × denom per table.
        businessDate
          ? supabase.from("chip_snapshots")
              .select("location_type, location_id, denomination, expected_quantity, actual_quantity, created_at")
              .eq("casino_id", casinoId).eq("date", businessDate).eq("location_type", "table")
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      if (cancelled) return;
      if (c?.name) setCasinoName(c.name);
      const blMap: Record<string, number> = {};
      const blByDenom: BaselineMap = {};
      (bl || []).forEach((r: any) => {
        if (!r.location_id) return;
        blMap[r.location_id] = (blMap[r.location_id] || 0) + Number(r.denomination) * Number(r.expected_quantity);
        blByDenom[r.location_id] = blByDenom[r.location_id] || {};
        blByDenom[r.location_id][Number(r.denomination)] = Number(r.expected_quantity);
      });
      setBaselines(blMap);
      setBaselineByDenom(blByDenom);
      setSnapshotIndex(buildLatestTableSnapshot((snaps || []) as any));
      const fc: Record<string, { fill: number; credit: number }> = {};
      let addFloat = 0;
      let slotsOut = 0;
      (tr || []).forEach((r: any) => {
        if (r.transfer_type === "add_float") { addFloat += Number(r.amount); return; }
        if (r.transfer_type === "slots_out") { slotsOut += Number(r.amount); return; }
        if (!r.table_id) return;
        fc[r.table_id] = fc[r.table_id] || { fill: 0, credit: 0 };
        if (r.transfer_type === "fill") fc[r.table_id].fill += Number(r.amount);
        else if (r.transfer_type === "credit") fc[r.table_id].credit += Number(r.amount);
      });
      setFillCredits(fc);
      setCashFlowTransfers({ addFloat, slotsOut });
      const inMap: Record<string, number> = {};
      (tx || []).forEach((r: any) => {
        if (!r.table_id) return;
        inMap[r.table_id] = (inMap[r.table_id] || 0) + Number(r.amount || 0);
      });
      setInByTable(inMap);
      const dr: Record<string, any> = {};
      (tdr || []).forEach((r: any) => {
        dr[r.table_id] = {
          open: Number(r.open || 0),
          fill: Number(r.fill || 0),
          credit: Number(r.credit || 0),
          close: Number(r.close || 0),
          drop: Number(r.drop_amount || 0),
          result: Number(r.result || 0),
        };
      });
      setDailyResults(dr);

      // Authoritative Result from server-side RPC.
      const { data: srv } = await (supabase as any).rpc("compute_shift_table_results", { p_shift_id: shift.id });
      if (cancelled) return;
      const sr: Record<string, number> = {};
      (srv || []).forEach((r: any) => { if (r?.table_id) sr[r.table_id] = Number(r.result || 0); });
      setServerResults(sr);
    })();
    return () => { cancelled = true; };
  }, [casinoId, shift?.id, businessDate]);

  // Tables ordered: visible (non-archived), name asc
  const reportTables = useMemo(
    () => tables.filter(t => !t.is_archived).sort((a, b) => a.name.localeCompare(b.name)),
    [tables],
  );

  /** Result is computed by DB RPC `compute_shift_table_results`
   *  (formula: (Σ(actual−baseline)·denom) − Fill + Credit). UI only displays it.
   *  Open/Fill/Credit/Close/IN columns remain informational. */
  const rowFor = (t: Tables<"gaming_tables">) => {
    const inVal = inByTable[t.id] || 0;
    const dr = dailyResults[t.id];
    const res = serverResults[t.id] ?? (dr ? dr.result : 0);
    if (dr) return { op: dr.open, fl: dr.fill, cr: dr.credit, cl: dr.close, inVal, res };
    const op = baselines[t.id] || 0;
    const fl = fillCredits[t.id]?.fill || 0;
    const cr = fillCredits[t.id]?.credit || 0;
    const cl = sumChipsObj(t.closing_chips as any);
    return { op, fl, cr, cl, inVal, res };
  };

  const totals = useMemo(() => {
    let open = 0, fill = 0, credit = 0, close = 0, inSum = 0, result = 0;
    reportTables.forEach(t => {
      const { op, fl, cr, cl, inVal, res } = rowFor(t);
      open += op; fill += fl; credit += cr; close += cl; inSum += inVal; result += res;
    });
    return { open, fill, credit, close, in: inSum, result };
  }, [reportTables, baselines, fillCredits, dailyResults, inByTable, serverResults]);

  // Cash flow opener (per currency cash + mobile from opening_float)
  const openerCash = (openingFloat?.cash || {}) as Record<string, Record<string | number, number>>;
  const openerMobile = (openingFloat?.mobile || {}) as Record<string, number>;
  const openerBank = (openingFloat?.bank || {}) as { tzs?: number; usd?: number };

  // Closer from closingCount snapshot
  const closerCash = (closingCount?.cash || {}) as Record<string, Record<string | number, number>>;
  const closerMobile = (closingCount?.mobile || {}) as Record<string, number>;
  const closerBank = (closingCount?.bank || {}) as { tzs?: number; usd?: number };

  const cashCurrencyTotal = (cash: Record<string | number, number> | undefined) =>
    cash ? Object.entries(cash).reduce((s, [d, q]) => s + Number(d) * (Number(q) || 0), 0) : 0;

  // Per-currency totals for opener/closer (in native currency, not TZS)
  const openerByCurrency = Object.fromEntries(CURRENCIES.map(c => [c, cashCurrencyTotal(openerCash[c])]));
  const closerByCurrency = Object.fromEntries(CURRENCIES.map(c => [c, cashCurrencyTotal(closerCash[c])]));

  const openerCashTzs = CURRENCIES.reduce((s, c) => {
    const t = openerByCurrency[c]; return s + t * (c === "TZS" ? 1 : (exchangeRates[c] || 0));
  }, 0);
  const closerCashTzs = CURRENCIES.reduce((s, c) => {
    const t = closerByCurrency[c]; return s + t * (c === "TZS" ? 1 : (exchangeRates[c] || 0));
  }, 0);
  const openerOtherTzs = (openerBank.tzs || 0) + (openerBank.usd || 0) * (exchangeRates["USD"] || 0);
  const closerOtherTzs = (closerBank.tzs || 0) + (closerBank.usd || 0) * (exchangeRates["USD"] || 0);

  const openerMobileTotal = Object.values(openerMobile).reduce((s, v) => s + (Number(v) || 0), 0);
  const closerMobileTotal = Object.values(closerMobile).reduce((s, v) => s + (Number(v) || 0), 0);

  const openerTotal = openerCashTzs + openerOtherTzs + openerMobileTotal;
  const closerTotal = closerCashTzs + closerOtherTzs + closerMobileTotal;

  const num = (n: number) => (n === 0 ? "" : formatNumberSpaces(n));
  const numAlways = (n: number) => formatNumberSpaces(n);

  // Mobile providers ordered as per legacy form
  const MP = ["Mpesa", "Tigo", "Halo", "AirTel"] as const;

  return (
    <div id="shift-print-area" className="bg-white text-black p-6 font-sans text-[11px] leading-snug">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-black pb-1.5 mb-2">
        <h1 className="text-base font-bold">{casinoName} Consolidating Cash Desk Report</h1>
        <div className="text-right">
          <span className="font-semibold mr-2">Date</span>
          <span className="border-b border-black px-2">{fmtDate(businessDate)}</span>
        </div>
      </div>

      {/* Tables grid */}
      <table className="w-full border-collapse mb-3 text-[11px]">
        <thead>
          <tr className="bg-gray-100">
            {["Table", "Open", "Fill", "Credit", "Close", "IN", "Result"].map(h => (
              <th key={h} className="border border-black px-2 py-1 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reportTables.map(t => {
            const { op, fl, cr, cl, inVal, res } = rowFor(t);
            return (
              <tr key={t.id}>
                <td className="border border-black px-2 py-1 font-semibold">{t.name}</td>
                <td className="border border-black px-2 py-1 text-right tabular-nums">{num(op)}</td>
                <td className="border border-black px-2 py-1 text-right tabular-nums">{num(fl)}</td>
                <td className="border border-black px-2 py-1 text-right tabular-nums">{num(cr)}</td>
                <td className="border border-black px-2 py-1 text-right tabular-nums">{num(cl)}</td>
                <td className="border border-black px-2 py-1 text-right tabular-nums">{num(inVal)}</td>
                <td className="border border-black px-2 py-1 text-right tabular-nums font-semibold">
                  {res === 0 ? "0" : (res > 0 ? numAlways(res) : `-${numAlways(Math.abs(res))}`)}
                </td>
              </tr>
            );
          })}
          {/* Total row */}
          <tr className="bg-gray-100 font-bold">
            <td className="border border-black px-2 py-1">Total</td>
            <td className="border border-black px-2 py-1 text-right tabular-nums">{numAlways(totals.open)}</td>
            <td className="border border-black px-2 py-1 text-right tabular-nums">{numAlways(totals.fill)}</td>
            <td className="border border-black px-2 py-1 text-right tabular-nums">{numAlways(totals.credit)}</td>
            <td className="border border-black px-2 py-1 text-right tabular-nums">{numAlways(totals.close)}</td>
            <td className="border border-black px-2 py-1 text-right tabular-nums">{numAlways(totals.in)}</td>
            <td className="border border-black px-2 py-1 text-right tabular-nums">
              {totals.result >= 0 ? numAlways(totals.result) : `-${numAlways(Math.abs(totals.result))}`}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Cash Flow + Summary panel */}
      <div className="grid grid-cols-3 gap-4">
        {/* Opener */}
        <CashFlowColumn
          title="Cash Flow Opener"
          cash={openerByCurrency}
          mobile={openerMobile}
          mp={[...MP]}
          otherTzs={openerOtherTzs}
          totalCash={openerCashTzs + openerOtherTzs}
          totalMobile={openerMobileTotal}
          totalLabel="Total Opener"
          totalValue={openerTotal}
        />
        {/* Closer */}
        <CashFlowColumn
          title="Cash Flow Closer"
          cash={closerByCurrency}
          mobile={closerMobile}
          mp={[...MP]}
          otherTzs={closerOtherTzs}
          totalCash={closerCashTzs + closerOtherTzs}
          totalMobile={closerMobileTotal}
          totalLabel="Total Closer"
          totalValue={closerTotal}
        />

        {/* Summary panel */}
        <div className="space-y-1">
          <SummaryRow label="Tables Result" value={totals.result} bold />
          <SummaryRow label="Cash Flow FILL" value={cashFlowTransfers.addFloat} />
          <SummaryRow label="Cash Flow CREDIT" value={cashFlowTransfers.slotsOut} />
          <SummaryRow label="Cash Desk Chips FILL" value={0} />
          <SummaryRow label="Cash Desk Chips CREDIT" value={0} />
          <SummaryRow label="Miss Chips" value={missTotal} bold negative />
          <SummaryRow label="Casino Expenses" value={totalExpenses} bold />
          <SummaryRow label="Tips" value={0} />
          <div className="mt-3 pt-2 border-t-2 border-black flex justify-between items-center">
            <span className="font-bold">Shift Balance</span>
            <span className="border border-black px-3 py-0.5 font-bold tabular-nums min-w-[110px] text-right">
              {balance === 0 ? "0" : (balance > 0 ? numAlways(balance) : `-${numAlways(Math.abs(balance))}`)}
            </span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 mt-8">
        <SignatureBlock label="Closing Shift Cashier" name={cashierName} />
        <SignatureBlock label="Closing Shift Manager" name={managerName} />
      </div>
    </div>
  );
};

const CashFlowColumn = ({
  title, cash, mobile, mp, otherTzs, totalCash, totalMobile, totalLabel, totalValue,
}: {
  title: string;
  cash: Record<string, number>;
  mobile: Record<string, number>;
  mp: string[];
  otherTzs: number;
  totalCash: number;
  totalMobile: number;
  totalLabel: string;
  totalValue: number;
}) => {
  const num = (n: number) => (n === 0 ? "" : formatNumberSpaces(n));
  return (
    <div>
      <p className="font-semibold border-b border-black pb-0.5 mb-1">{title}</p>
      <div className="space-y-0.5">
        {CURRENCIES.map(c => (
          <Row key={c} label={c} value={num(cash[c] || 0)} />
        ))}
        <Row label="Other in TZS" value={num(otherTzs)} />
        <Row label="Total Cash" value={formatNumberSpaces(totalCash)} bold framed />
        {mp.map(p => (
          <Row key={p} label={p === "Mpesa" ? "M Pessa" : p === "Tigo" ? "T Pesa" : p === "Halo" ? "H Pesa" : "Airtel Money"} value={num(mobile[p] || 0)} />
        ))}
        <Row label="Total CashLess" value={formatNumberSpaces(totalMobile)} bold framed />
      </div>
      <div className="mt-2 pt-1 border-t border-black flex justify-between font-bold">
        <span>{totalLabel}</span>
        <span className="border border-black px-2 tabular-nums min-w-[100px] text-right">
          {formatNumberSpaces(totalValue)}
        </span>
      </div>
    </div>
  );
};

const Row = ({ label, value, bold, framed }: { label: string; value: string | number; bold?: boolean; framed?: boolean }) => (
  <div className={`flex justify-between items-center ${bold ? "font-bold" : ""}`}>
    <span>{label}</span>
    <span className={`tabular-nums text-right min-w-[90px] ${framed ? "border border-black px-2" : "border-b border-dotted border-black px-1"}`}>
      {value}
    </span>
  </div>
);

const SummaryRow = ({ label, value, bold, negative }: { label: string; value: number; bold?: boolean; negative?: boolean }) => {
  const signed = negative && value > 0 ? -value : value;
  const display = signed === 0 ? "0" : signed > 0 ? formatNumberSpaces(signed) : `-${formatNumberSpaces(Math.abs(signed))}`;
  return (
    <div className={`flex justify-between items-center ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="border-b border-dotted border-black px-2 tabular-nums min-w-[100px] text-right">{display}</span>
    </div>
  );
};

const SignatureBlock = ({ label, name }: { label: string; name?: string }) => (
  <div>
    <div className="flex items-end gap-3">
      <span className="font-semibold whitespace-nowrap">{label}:</span>
      <span className="flex-1 border-b border-black pb-0.5 font-semibold uppercase">{name || ""}</span>
    </div>
    <div className="flex items-end gap-3 mt-5">
      <span className="font-semibold whitespace-nowrap">Signature:</span>
      <span className="flex-1 border-b border-black h-5" />
    </div>
  </div>
);

export default ShiftClosingReport;
