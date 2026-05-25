import { useParams } from "react-router-dom";
import { Coins, Printer } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumberSpaces, CURRENCIES } from "@/lib/currency";
import { fmtDate, fmtDateTime } from "@/lib/format-date";
import {
  useCageSlotsShift, useSlotsInventory, useSlotsCards,
  useSlotsCashless, useSlotsComments, useSlotsRates,
} from "@/hooks/use-cage-slots";

const CageSlotsReport = () => {
  const { id } = useParams<{ id: string }>();
  const { data: shift } = useCageSlotsShift(id);
  const { data: inventory = [] } = useSlotsInventory(id);
  const { data: cards } = useSlotsCards(id);
  const { data: cashless = [] } = useSlotsCashless(id);
  const { data: comments = [] } = useSlotsComments(id);
  const { data: rates = [] } = useSlotsRates(id);

  if (!shift) {
    return (
      <PageShell className="print-target">
        <PageHeader icon={Coins} title="Cage Slots · Report" subtitle="Loading…" />
      </PageShell>
    );
  }


  const openingTotal = inventory.filter(r => r.inventory_type === "opening").reduce((s, r) => s + Number(r.total_tzs || 0), 0);
  const closingTotal = inventory.filter(r => r.inventory_type === "closing").reduce((s, r) => s + Number(r.total_tzs || 0), 0);
  const cardDepositTzs = Number(cards?.card_deposit_value_tzs || 5000);
  const cardsOpeningTzs = Number(cards?.opening_card_count || 0) * cardDepositTzs;
  const cardsClosingTzs = Number(cards?.closing_card_count || 0) * cardDepositTzs;
  const cashlessNet = cashless.reduce((s, t: any) => s + (t.direction === "IN" ? Number(t.amount) : -Number(t.amount)), 0);
  const actualResult = Number(shift.actual_cage_result || ((closingTotal + cardsClosingTzs) - (openingTotal + cardsOpeningTzs) - cashlessNet));
  const systemResult = Number(shift.system_shift_result || 0);
  const diff = Number(shift.difference_amount ?? (actualResult - systemResult));

  return (
    <PageShell>
      <PageHeader
        icon={Coins}
        title="Cage Slots · Shift Report"
        subtitle={`${fmtDate(shift.business_date)} · ${shift.shift_type.toUpperCase()}`}
        context={<Badge variant="outline" className="uppercase text-[10px]">{shift.status.replace("_", " ")}</Badge>}
      >
        <Button onClick={() => window.print()} size="sm" variant="outline" className="gap-1.5 h-8 print:hidden">
          <Printer className="w-3.5 h-3.5" /> Print
        </Button>
      </PageHeader>

      <PageSection title="Header">
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Field label="Business Day" value={fmtDate(shift.business_date)} />
          <Field label="Shift Type" value={shift.shift_type.toUpperCase()} />
          <Field label="Opened" value={fmtDateTime(shift.opened_at)} />
          <Field label="Closed" value={shift.closed_at ? fmtDateTime(shift.closed_at) : "—"} />
        </dl>
      </PageSection>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <InventoryTable title="Opening Cash" rows={inventory.filter(r => r.inventory_type === "opening")} />
        <InventoryTable title="Closing Cash" rows={inventory.filter(r => r.inventory_type === "closing")} />
      </div>

      <PageSection title="Plastic Cards">
        <div className="grid grid-cols-4 gap-3 text-sm">
          <Field label="Opening Cards" value={String(cards?.opening_card_count ?? 0)} />
          <Field label="Closing Cards" value={String(cards?.closing_card_count ?? "—")} />
          <Field label="Miss" value={String(cards?.miss_card_count ?? 0)} />
          <Field label="Card Value (TZS)" value={formatNumberSpaces(cardDepositTzs)} />
        </div>
      </PageSection>

      <PageSection title="Cashless">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground border-b border-border">
            <tr><th className="text-left py-1.5">When</th><th>Dir</th><th>Provider</th><th className="text-left">Player</th><th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {cashless.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-2">·</td></tr>}
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
        <div className="text-right text-xs mt-1 font-mono">
          Net: <span className={cashlessNet < 0 ? "cms-amount-negative" : "cms-amount-positive"}>{cashlessNet > 0 ? "+" : ""}{formatNumberSpaces(cashlessNet)}</span>
        </div>
      </PageSection>

      <PageSection title="Balance Calculation">
        <div className="grid grid-cols-2 gap-3 text-sm font-mono">
          <Field label="Opening Total (TZS)" value={formatNumberSpaces(openingTotal + cardsOpeningTzs)} />
          <Field label="Closing Total (TZS)" value={formatNumberSpaces(closingTotal + cardsClosingTzs)} />
          <Field label="Cashless Net" value={(cashlessNet >= 0 ? "+" : "") + formatNumberSpaces(cashlessNet)} />
          <Field label="Actual Cage Result" value={(actualResult >= 0 ? "+" : "") + formatNumberSpaces(actualResult)} />
          <Field label="System Result" value={(systemResult >= 0 ? "+" : "") + formatNumberSpaces(systemResult)} />
          <Field label="Difference" value={(diff >= 0 ? "+" : "") + formatNumberSpaces(diff)} emphasize />
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

      <div className="grid grid-cols-2 gap-6 mt-6 text-sm">
        <div>
          <p className="border-t border-foreground pt-1 text-center">Cashier Signature</p>
        </div>
        <div>
          <p className="border-t border-foreground pt-1 text-center">Manager Signature</p>
        </div>
      </div>
    </PageShell>
  );
};

const Field = ({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) => (
  <div>
    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
    <p className={`font-mono ${emphasize ? "text-base font-bold" : "text-sm"}`}>{value}</p>
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

export default CageSlotsReport;
