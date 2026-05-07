/**
 * CashCheckViewerDialog — read-only snapshot of a single cash_counts row.
 * Renders chips + per-currency cash + banks + mobile exactly as captured.
 * Empty sections are collapsed (<details>) so the viewer can verify zeros.
 */
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { CURRENCIES, CASH_DENOMS, CHIP_DENOMS, formatCurrency, formatNumberSpaces, formatChipLabel, formatCashDenomLabel, CURRENCY_SYMBOLS } from "@/lib/currency";
import { MOBILE_PROVIDERS } from "@/components/cage/CageHelpers";
import type { Tables } from "@/integrations/supabase/types";

type Denoms = {
  chips?: Record<number, number>;
  cash?: Record<string, Record<number, number>>;
  bank?: { tzs: number; usd: number };
  mobile?: Record<string, number>;
  totals?: Record<string, any>;
};

const sumRecord = (r?: Record<string | number, number>) =>
  r ? Object.values(r).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
const sumValue = (r?: Record<number, number>) =>
  r ? Object.entries(r).reduce((s, [d, c]) => s + Number(d) * (Number(c) || 0), 0) : 0;

const Section = ({ title, isEmpty, children }: { title: string; isEmpty: boolean; children: React.ReactNode }) => {
  if (isEmpty) {
    return (
      <details className="rounded-xl border border-border bg-background/40">
        <summary className="cursor-pointer list-none px-4 py-2 flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">
          <span>{title}</span>
          <span className="font-mono normal-case tracking-normal text-muted-foreground/70">· empty</span>
        </summary>
        <div className="px-4 pb-3 pt-1 opacity-60">{children}</div>
      </details>
    );
  }
  return (
    <section className="rounded-xl border border-border bg-background/40 p-4 space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">{title}</p>
      {children}
    </section>
  );
};

const ChipsView = ({ chips }: { chips: Record<number, number> }) => (
  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
    {CHIP_DENOMS.map(d => {
      const qty = chips[d] || 0;
      return (
        <div key={d} className="flex items-center justify-between gap-2 text-xs font-mono">
          <span className="cms-chip-token">{formatChipLabel(d)}</span>
          <span className={`tabular-nums ${qty > 0 ? "text-card-foreground" : "text-muted-foreground/50"}`}>{qty || "·"}</span>
          <span className="tabular-nums text-muted-foreground text-[10px] w-20 text-right">
            {qty > 0 ? formatNumberSpaces(qty * d) : "·"}
          </span>
        </div>
      );
    })}
    <div className="col-span-2 flex justify-between pt-2 mt-1 border-t border-border text-xs">
      <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Total</span>
      <span className="font-mono font-bold text-card-foreground">TZS {formatNumberSpaces(sumValue(chips))}</span>
    </div>
  </div>
);

const CashView = ({ values, denoms, currency }: { values: Record<number, number>; denoms: number[]; currency: string }) => {
  const total = sumValue(values);
  return (
    <div className="space-y-0.5">
      {denoms.map(d => {
        const qty = values[d] || 0;
        return (
          <div key={d} className="grid grid-cols-[3.5rem_1fr_5rem] items-center gap-1.5 text-xs font-mono">
            <span className="cms-chip text-[8px] bg-muted text-foreground h-5 w-14 shrink-0 justify-center">
              {formatCashDenomLabel(d, currency)}
            </span>
            <span className={`tabular-nums text-right ${qty > 0 ? "text-card-foreground" : "text-muted-foreground/50"}`}>{qty || "·"}</span>
            <span className="tabular-nums text-muted-foreground text-[10px] text-right">
              {qty > 0 ? formatNumberSpaces(qty * d) : "·"}
            </span>
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-2 pt-1 mt-1 border-t border-border">
        <span className="text-[10px] font-medium text-muted-foreground uppercase">Total</span>
        <span className="font-mono text-xs font-bold text-card-foreground">
          {currency === "TZS" ? `TZS ${formatNumberSpaces(total)}` : `${CURRENCY_SYMBOLS[currency] || currency}${formatNumberSpaces(total)}`}
        </span>
      </div>
    </div>
  );
};

const KeyValRow = ({ label, value, mono = true, muted = false }: { label: string; value: React.ReactNode; mono?: boolean; muted?: boolean }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className={`${mono ? "font-mono tabular-nums" : ""} ${muted ? "text-muted-foreground/50" : "text-card-foreground font-medium"}`}>{value}</span>
  </div>
);

const CashCheckViewerDialog = ({
  open,
  onOpenChange,
  check,
  cashierName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  check: Tables<"cash_counts"> | null;
  cashierName?: string;
}) => {
  if (!check) return null;
  const d = (check.denominations || {}) as Denoms;
  const chips = d.chips || {};
  const cash = d.cash || {};
  const bank = d.bank || { tzs: 0, usd: 0 };
  const mobile = d.mobile || {};
  const t = d.totals || {};
  const expected = Number(t.expected ?? 0);
  const counted = Number(t.counted ?? Number(check.total));
  const diff = Number(t.difference ?? counted - expected);
  const balanced = !!t.balanced || diff === 0;

  const stamp = new Date(check.created_at).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cash Check · ${stamp}`}
      description={cashierName}
      size="4xl"
    >
      <div className="space-y-4">
        {/* Totals strip */}
        <div className="grid grid-cols-3 gap-2 cms-panel p-3">
          <div className="text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Expected</p>
            <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(expected)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Counted</p>
            <p className="font-mono text-sm font-bold text-card-foreground">{formatCurrency(counted)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase text-muted-foreground">Diff</p>
            <p className={`font-mono text-sm font-bold ${balanced ? "text-success" : "text-destructive"}`}>
              {balanced ? "Balanced" : `${diff >= 0 ? "+" : ""}${formatCurrency(diff)}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Column 1: TZS Chips + TZS Cash */}
          <div className="grid gap-4 content-start">
            <Section title="TZS Chips" isEmpty={sumValue(chips) === 0}>
              <ChipsView chips={chips} />
            </Section>
            <Section title="TZS Cash" isEmpty={sumValue(cash["TZS"] || {}) === 0}>
              <CashView values={cash["TZS"] || {}} denoms={CASH_DENOMS["TZS"] || []} currency="TZS" />
            </Section>
          </div>

          {/* Column 2: foreign currencies + mobile */}
          <div className="grid gap-4 content-start">
            {CURRENCIES.filter(c => c !== "TZS").map(cur => (
              <Section key={cur} title={`${cur} Cash`} isEmpty={sumValue(cash[cur] || {}) === 0}>
                <CashView values={cash[cur] || {}} denoms={CASH_DENOMS[cur] || []} currency={cur} />
              </Section>
            ))}
          </div>

          {/* Column 3: Banks + Mobile */}
          <div className="grid gap-4 content-start">
            <Section title="Bank Balances" isEmpty={(bank.tzs || 0) === 0 && (bank.usd || 0) === 0}>
              <div className="space-y-1">
                <KeyValRow label="TZS" value={formatNumberSpaces(bank.tzs || 0)} muted={!bank.tzs} />
                <KeyValRow label="USD" value={formatNumberSpaces(bank.usd || 0)} muted={!bank.usd} />
              </div>
            </Section>
            <Section title="Mobile Money" isEmpty={sumRecord(mobile) === 0}>
              <div className="space-y-1">
                {MOBILE_PROVIDERS.map(p => (
                  <KeyValRow key={p} label={p} value={formatNumberSpaces(mobile[p] || 0)} muted={!mobile[p]} />
                ))}
                <div className="flex items-center justify-between pt-1 mt-1 border-t border-border">
                  <span className="text-[10px] uppercase text-muted-foreground">Total</span>
                  <span className="font-mono text-xs font-bold text-card-foreground">TZS {formatNumberSpaces(sumRecord(mobile))}</span>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
};

export default CashCheckViewerDialog;
