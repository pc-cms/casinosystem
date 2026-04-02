import { NumberInput } from "@/components/ui/number-input";
import { formatNumberSpaces, CASH_DENOMS } from "@/lib/currency";
import ChipDenomInput from "@/components/ChipDenomInput";
import CashDenomInput from "./CashDenomInput";
import { MOBILE_PROVIDERS, mobileTotal, type MobileProviders, type Banks } from "./CageHelpers";

const CashCountGrid = ({
  chips, onChipsChange,
  cash, onCashChange,
  banks, onBanksChange,
  mobile, onMobileChange,
  chipPlaceholder,
  rates,
}: {
  chips: Record<number, number>;
  onChipsChange: (v: Record<number, number>) => void;
  cash: Record<string, Record<number, number>>;
  onCashChange: (currency: string, v: Record<number, number>) => void;
  banks: Banks;
  onBanksChange: (v: Banks) => void;
  mobile: MobileProviders;
  onMobileChange: (v: MobileProviders) => void;
  chipPlaceholder?: Record<number, number>;
  rates?: Record<string, number>;
}) => {
  const mobTotal = mobileTotal(mobile);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="grid gap-4 content-start">
          <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">TZS Chips</p>
            <ChipDenomInput values={chips} onChange={onChipsChange} showValue={false} placeholder={chipPlaceholder} />
          </section>
          <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">TZS Cash</p>
            <CashDenomInput values={cash["TZS"] || {}} onChange={v => onCashChange("TZS", v)} denoms={CASH_DENOMS["TZS"] || []} currency="TZS" />
          </section>
        </div>

        <div className="grid gap-4 content-start">
          <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">EUR Cash</p>
            <CashDenomInput values={cash["EUR"] || {}} onChange={v => onCashChange("EUR", v)} denoms={CASH_DENOMS["EUR"] || []} currency="EUR" />
          </section>
          <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">GBP Cash</p>
            <CashDenomInput values={cash["GBP"] || {}} onChange={v => onCashChange("GBP", v)} denoms={CASH_DENOMS["GBP"] || []} currency="GBP" />
          </section>
        </div>

        <div className="grid gap-4 content-start">
          <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">USD Cash</p>
            <CashDenomInput values={cash["USD"] || {}} onChange={v => onCashChange("USD", v)} denoms={CASH_DENOMS["USD"] || []} currency="USD" />
          </section>
          <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">KES Cash</p>
            <CashDenomInput values={cash["KES"] || {}} onChange={v => onCashChange("KES", v)} denoms={CASH_DENOMS["KES"] || []} currency="KES" />
          </section>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">Mobile Money</p>
          <span className="font-mono text-sm font-bold text-card-foreground">TZS {formatNumberSpaces(mobTotal)}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {MOBILE_PROVIDERS.map(provider => (
            <div key={provider} className="rounded-lg border border-border bg-background/60 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">{provider}</p>
              <NumberInput
                value={mobile[provider] || ""}
                onChange={v => onMobileChange({ ...mobile, [provider]: Number(v) || 0 })}
                className="no-spin h-9 w-full min-w-0 font-mono text-sm text-right"
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <section className="rounded-xl border border-border bg-background/40 p-4 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">Bank TZS</p>
          <NumberInput value={banks.tzs || ""} onChange={v => onBanksChange({ ...banks, tzs: Number(v) || 0 })} className="no-spin h-10 w-full min-w-0 text-right" placeholder="0" />
        </section>
        <section className="rounded-xl border border-border bg-background/40 p-4 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">Bank USD</p>
          <NumberInput value={banks.usd || ""} onChange={v => onBanksChange({ ...banks, usd: Number(v) || 0 })} className="no-spin h-10 w-full min-w-0 text-right" placeholder="0" />
          {banks.usd > 0 && rates?.["USD"] ? (
            <p className="text-[10px] font-mono text-muted-foreground">= TZS {formatNumberSpaces(banks.usd * (rates["USD"] || 0))}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default CashCountGrid;
