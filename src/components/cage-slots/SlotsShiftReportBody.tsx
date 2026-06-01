/**
 * SlotsShiftReportBody — reusable shift report body (no PageShell/PageHeader).
 * Used by the dedicated /cage-slots/report/:id page AND by the inline
 * expansion in Cage Slots · History.
 */
import { PageSection } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { formatNumberSpaces, CURRENCIES } from "@/lib/currency";
import { fmtDate, fmtDateTime } from "@/lib/format-date";
import {
  useCageSlotsShift, useSlotsInventory, useSlotsCards,
  useSlotsCashless, useSlotsComments, useSlotsRates, useSlotsCashCounts,
} from "@/hooks/use-cage-slots";
import { useSlotsTransfers } from "@/hooks/use-cage-slots-transfers";
import { useSlotsExpenses } from "@/hooks/use-expenses";

const Field = ({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) => (
  <div className="leading-tight">
    <p className="text-[9px] uppercase text-muted-foreground tracking-wider">{label}</p>
    <p className={`font-mono ${emphasize ? "text-sm font-bold" : "text-xs"}`}>{value}</p>
  </div>
);

const InventoryTable = ({ title, rows }: { title: string; rows: any[] }) => {
  const byCur: Record<string, any[]> = {};
  rows.forEach(r => { (byCur[r.currency_code] ||= []).push(r); });
  const totalTzs = rows.reduce((s, r) => s + Number(r.total_tzs || 0), 0);
  return (
    <PageSection title={title}>
      {Object.keys(byCur).length === 0 && <p className="text-xs text-muted-foreground">·</p>}
      {CURRENCIES.filter(c => byCur[c]?.length).map(cur => {
        const list = (byCur[cur] || []).slice().sort((a, b) => b.denomination - a.denomination);
        return (
          <div key={cur} className="mb-2">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">{cur}</p>
            <table className="w-full text-xs font-mono">
              <tbody>
                {list.map(r => (
                  <tr key={r.id}><td>{formatNumberSpaces(Number(r.denomination))}</td><td className="text-right">×{r.quantity}</td><td className="text-right">{formatNumberSpaces(Number(r.total_tzs))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="text-xs font-mono font-bold text-right border-t border-border pt-1">Total: TZS {formatNumberSpaces(totalTzs)}</p>
    </PageSection>
  );
};

interface Props {
  id: string;
  showHeader?: boolean; // include "Header" section with business date/times
  compact?: boolean;    // tighter spacing for inline embedding
}

const SlotsShiftReportBody = ({ id, showHeader = true, compact = false }: Props) => {
  const { data: shift } = useCageSlotsShift(id);
  const { data: inventory = [] } = useSlotsInventory(id);
  const { data: cards } = useSlotsCards(id);
  const { data: cashless = [] } = useSlotsCashless(id);
  const { data: comments = [] } = useSlotsComments(id);
  const { data: rates = [] } = useSlotsRates(id);
  const { data: checks = [] } = useSlotsCashCounts(id);
  const { data: transfers = [] } = useSlotsTransfers(id);
  const { data: expenses = [] } = useSlotsExpenses(shift?.business_date);

  if (!shift) {
    return <p className="text-xs text-muted-foreground py-2">Loading…</p>;
  }

  const openingTotal = inventory.filter(r => r.inventory_type === "opening").reduce((s, r) => s + Number(r.total_tzs || 0), 0);
  const closingTotal = inventory.filter(r => r.inventory_type === "closing").reduce((s, r) => s + Number(r.total_tzs || 0), 0);
  const cardDepositTzs = Number(cards?.card_deposit_value_tzs || 5000);
  const cashlessIn = cashless.reduce((s, t: any) => s + (t.direction === "IN" ? Number(t.amount) : 0), 0);
  const cashlessOut = cashless.reduce((s, t: any) => s + (t.direction === "OUT" ? Number(t.amount) : 0), 0);
  const latestCheck = checks.find((c: any) => !(c.denominations as any)?.is_opening);
  const latestDenominations = ((latestCheck?.denominations as any) || {}) as Record<string, any>;
  const latestTotals = (latestDenominations.totals || {}) as Record<string, number>;

  const closingCash = Number(latestTotals.total_tzs ?? closingTotal);

  const txAgg = transfers.reduce((acc: any, t: any) => {
    acc[t.transfer_type] = (acc[t.transfer_type] || 0) + Number(t.amount || 0);
    return acc;
  }, { fill: 0, collection: 0, lg_in: 0, lg_out: 0 } as Record<string, number>);
  const expensesTotal = expenses.filter((e: any) => e.approved).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  const systemResult = Number(shift.system_shift_result ?? latestTotals.system_result ?? 0);
  const slotsResult = Number(shift.slots_result ?? latestTotals.slots_result_derived ?? systemResult);
  const deltaCash = closingCash - openingTotal;
  const cardsMiss = Number(shift.cards_miss ?? ((Number(cards?.opening_card_count || 0) - Number(cards?.closing_card_count || 0)) * cardDepositTzs));
  const cashDeskResult = Number(
    shift.cash_desk_result ?? latestTotals.cash_desk_result ??
    (closingCash + expensesTotal - txAgg.fill + txAgg.collection + txAgg.lg_out - txAgg.lg_in),
  );
  const expected = systemResult;
  const balance = Number(
    shift.balance ?? latestTotals.shift_balance ?? latestTotals.balance ??
    (cashDeskResult - systemResult - cardsMiss),
  );

  const cashlessBalance = cashlessIn - cashlessOut;
  const cashlessFinal = Number((shift as any).cashless_final ?? latestTotals.cashless_final ?? 0);

  // Provider breakdown — prefer live transactions; fallback to shift JSON columns
  const PROVIDERS = ["MPESA", "TIGO", "HALOTEL", "AIRTEL"] as const;
  const NORM = (k: string): string | null => {
    const v = String(k || "").toLowerCase().replace(/[\s_-]+/g, "");
    if (v.includes("mpesa")) return "MPESA";
    if (v.includes("tigo") || v.includes("tpesa")) return "TIGO";
    if (v.includes("halo") || v.includes("hpesa")) return "HALOTEL";
    if (v.includes("airtel")) return "AIRTEL";
    return null;
  };
  const byProv: Record<string, { in: number; out: number }> = {};
  PROVIDERS.forEach(p => { byProv[p] = { in: 0, out: 0 }; });
  if (cashless.length > 0) {
    cashless.forEach((t: any) => {
      const p = NORM(t.provider) || String(t.provider || "").toUpperCase();
      if (!byProv[p]) byProv[p] = { in: 0, out: 0 };
      if (t.direction === "IN") byProv[p].in += Number(t.amount || 0);
      else if (t.direction === "OUT") byProv[p].out += Number(t.amount || 0);
    });
  } else {
    const sip = (shift as any).cashless_in_providers || latestDenominations.cashless_in_providers || {};
    const sop = (shift as any).cashless_out_providers || latestDenominations.cashless_out_providers || {};
    Object.entries(sip).forEach(([k, v]) => { const p = NORM(k); if (p) byProv[p].in += Number(v || 0); });
    Object.entries(sop).forEach(([k, v]) => { const p = NORM(k); if (p) byProv[p].out += Number(v || 0); });
  }
  const providerCashlessIn = Object.values(byProv).reduce((s, p) => s + p.in, 0);
  const providerCashlessOut = Object.values(byProv).reduce((s, p) => s + p.out, 0);
  const dispCashlessIn = cashless.length > 0 ? cashlessIn : providerCashlessIn || Number(latestTotals.cashless_in || 0);
  const dispCashlessOut = cashless.length > 0 ? cashlessOut : providerCashlessOut || Number(latestTotals.cashless_out || 0);
  const dispCashlessBalance = dispCashlessIn - dispCashlessOut;

  const wrap = compact ? "space-y-1.5" : "space-y-3";

  return (
    <div className={wrap}>
      {showHeader && (
        <PageSection title="Header">
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <Field label="Business Day" value={fmtDate(shift.business_date)} />
            <Field label="Opened" value={fmtDateTime(shift.opened_at)} />
            <Field label="Closed" value={shift.closed_at ? fmtDateTime(shift.closed_at) : "—"} />
          </dl>
        </PageSection>
      )}

      {rates.length > 0 && (
        <PageSection title="Exchange Rates">
          <div className="flex flex-wrap gap-4 text-sm font-mono">
            {rates.map(r => (
              <div key={r.id}>
                <span className="text-muted-foreground text-xs uppercase mr-1">{r.currency_code}</span>
                {formatNumberSpaces(Number(r.rate_to_tzs))}
              </div>
            ))}
          </div>
        </PageSection>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <InventoryTable title="Opening Cash" rows={inventory.filter(r => r.inventory_type === "opening")} />
        <InventoryTable title="Closing Cash" rows={inventory.filter(r => r.inventory_type === "closing")} />
      </div>

      <PageSection title="Plastic Cards">
        <div className="grid grid-cols-4 gap-2 text-sm">
          <Field label="Opening Cards" value={String(cards?.opening_card_count ?? 0)} />
          <Field label="Closing Cards" value={String(cards?.closing_card_count ?? "—")} />
          <Field label="Miss" value={String(cards?.miss_card_count ?? 0)} />
          <Field label="Card Value (TZS)" value={formatNumberSpaces(cardDepositTzs)} />
        </div>
      </PageSection>

      <PageSection title="Cashless">
        <table className="w-full text-xs font-mono mb-2">
          <thead className="text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left py-1.5">Provider</th>
              <th className="text-right">IN</th>
              <th className="text-right">OUT</th>
              <th className="text-right">NET (IN−OUT)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byProv).map(([p, v]) => {
              const net = v.in - v.out;
              return (
                <tr key={p} className="border-b border-border/50">
                  <td className="py-1">{p}</td>
                  <td className="text-right cms-amount-positive">{v.in ? "+" + formatNumberSpaces(v.in) : "·"}</td>
                  <td className="text-right cms-amount-negative">{v.out ? "−" + formatNumberSpaces(v.out) : "·"}</td>
                  <td className={`text-right ${net < 0 ? "cms-amount-negative" : net > 0 ? "cms-amount-positive" : ""}`}>
                    {net !== 0 ? (net > 0 ? "+" : "") + formatNumberSpaces(net) : "·"}
                  </td>
                </tr>
              );
            })}
            <tr className="font-bold border-t border-border">
              <td className="py-1">TOTAL</td>
              <td className="text-right cms-amount-positive">{dispCashlessIn ? "+" + formatNumberSpaces(dispCashlessIn) : "·"}</td>
              <td className="text-right cms-amount-negative">{dispCashlessOut ? "−" + formatNumberSpaces(dispCashlessOut) : "·"}</td>
              <td className={`text-right ${dispCashlessBalance < 0 ? "cms-amount-negative" : dispCashlessBalance > 0 ? "cms-amount-positive" : ""}`}>
                {dispCashlessBalance !== 0 ? (dispCashlessBalance > 0 ? "+" : "") + formatNumberSpaces(dispCashlessBalance) : "·"}
              </td>
            </tr>
          </tbody>
        </table>

        {cashless.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Transactions ({cashless.length})</summary>
            <table className="w-full text-xs mt-2">
              <thead className="text-muted-foreground border-b border-border">
                <tr><th className="text-left py-1.5">When</th><th>Dir</th><th>Provider</th><th className="text-left">Player</th><th className="text-right">Amount</th></tr>
              </thead>
              <tbody>
                {cashless.map((t: any) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="py-1">{fmtDateTime(t.created_at)}</td>
                    <td className="text-center">{t.direction}</td>
                    <td className="text-center">{t.provider}</td>
                    <td>{t.player_name}</td>
                    <td className="text-right font-mono">{formatNumberSpaces(Number(t.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        <div className="text-right text-xs mt-2 font-mono text-muted-foreground">
          Cashless Final (manual · print only):{" "}
          <span className="text-card-foreground">{formatNumberSpaces(cashlessFinal)}</span>
        </div>
      </PageSection>

      <PageSection title="Balance Calculation">
        <div className="grid grid-cols-2 gap-3 text-sm font-mono">
          <Field label="Closing Cash" value={formatNumberSpaces(closingCash)} />
          <Field label="+ Expenses" value={formatNumberSpaces(expensesTotal)} />
          <Field label="− Ace Fill" value={formatNumberSpaces(txAgg.fill)} />
          <Field label="+ Collection" value={formatNumberSpaces(txAgg.collection)} />
          <Field label="+ LG Out" value={formatNumberSpaces(txAgg.lg_out)} />
          <Field label="− LG In" value={formatNumberSpaces(txAgg.lg_in)} />
          <Field label="= Cash Desk Result" value={(cashDeskResult >= 0 ? "+" : "") + formatNumberSpaces(cashDeskResult)} emphasize />
          <Field label="System Result" value={(systemResult >= 0 ? "+" : "") + formatNumberSpaces(systemResult)} />
          <Field label="Slots Result (= System Result)" value={(slotsResult >= 0 ? "+" : "") + formatNumberSpaces(slotsResult)} />
          <Field label="− Cards Miss" value={(cardsMiss >= 0 ? "+" : "") + formatNumberSpaces(cardsMiss)} />
          <Field label="= Shift Balance" value={(balance >= 0 ? "+" : "") + formatNumberSpaces(balance)} emphasize />
        </div>
      </PageSection>


      {(shift.cashier_note || shift.manager_comment || comments.length > 0) && (
        <PageSection title="Notes & Comments">
          {shift.cashier_note && (
            <p className="text-xs"><span className="font-semibold uppercase tracking-wider mr-1">Cashier:</span>{shift.cashier_note}</p>
          )}
          {shift.manager_comment && (
            <p className="text-xs mt-1"><span className="font-semibold uppercase tracking-wider mr-1">Manager:</span>{shift.manager_comment}</p>
          )}
          {comments.map(c => (
            <p key={c.id} className="text-xs mt-1">
              <Badge variant="outline" className="text-[10px] uppercase mr-1">{c.comment_type.replace("_", " ")}</Badge>
              {c.comment_text}
            </p>
          ))}
        </PageSection>
      )}
    </div>
  );
};

export default SlotsShiftReportBody;
