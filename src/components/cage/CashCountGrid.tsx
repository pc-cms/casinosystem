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

  const inputCls = "no-spin h-5 w-full min-w-0 font-mono text-xs text-right px-1.5";
  const banksTzsTotal = (banks.tzs || 0) + (banks.usd || 0) * (rates?.["USD"] || 0);

  return (
    <div className="space-y-4">
      {/* 3 columns; each column stacks two sections vertically */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Column 1: TZS Chips + TZS Cash */}
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

        {/* Column 2: USD Cash + KES Cash + Mobile Money */}
        <div className="grid gap-4 content-start">
          <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">USD Cash</p>
            <CashDenomInput values={cash["USD"] || {}} onChange={v => onCashChange("USD", v)} denoms={CASH_DENOMS["USD"] || []} currency="USD" />
          </section>
          <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">KES Cash</p>
            <CashDenomInput values={cash["KES"] || {}} onChange={v => onCashChange("KES", v)} denoms={CASH_DENOMS["KES"] || []} currency="KES" />
          </section>
          <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">Mobile Money</p>
            <div className="space-y-0">
              {MOBILE_PROVIDERS.map(provider => (
                <div key={provider} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-1.5">
                  <span className="cms-chip text-[8px] bg-muted text-foreground h-5 w-14 shrink-0 justify-center">{provider}</span>
                  <NumberInput
                    value={mobile[provider] || ""}
                    onChange={v => onMobileChange({ ...mobile, [provider]: Number(v) || 0 })}
                    className={inputCls}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
              <span className="text-[10px] font-medium text-muted-foreground">Total</span>
              <span className="font-mono text-xs font-bold text-card-foreground">TZS {formatNumberSpaces(mobTotal)}</span>
            </div>
          </section>
        </div>

        {/* Column 3: EUR Cash + GBP Cash + Banks */}
        <div className="grid gap-4 content-start">
          <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">EUR Cash</p>
            <CashDenomInput values={cash["EUR"] || {}} onChange={v => onCashChange("EUR", v)} denoms={CASH_DENOMS["EUR"] || []} currency="EUR" />
          </section>
          <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">GBP Cash</p>
            <CashDenomInput values={cash["GBP"] || {}} onChange={v => onCashChange("GBP", v)} denoms={CASH_DENOMS["GBP"] || []} currency="GBP" />
          </section>
          <section className="rounded-xl border border-border bg-background/40 p-4 space-y-3 flex flex-col min-h-[200px]">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]">Banks</p>
            <div className="space-y-0">
              <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-1.5">
                <span className="cms-chip text-[8px] bg-muted text-foreground h-5 w-14 shrink-0 justify-center">TZS</span>
                <NumberInput value={banks.tzs || ""} onChange={v => onBanksChange({ ...banks, tzs: Number(v) || 0 })} className={inputCls} placeholder="0" />
              </div>
              <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-1.5">
                <span className="cms-chip text-[8px] bg-muted text-foreground h-5 w-14 shrink-0 justify-center">USD</span>
                <NumberInput value={banks.usd || ""} onChange={v => onBanksChange({ ...banks, usd: Number(v) || 0 })} className={inputCls} placeholder="0" />
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between gap-2 pt-1 border-t border-border">
              <span className="text-[10px] font-medium text-muted-foreground">Total</span>
              <span className="font-mono text-xs font-bold text-card-foreground">TZS {formatNumberSpaces(banksTzsTotal)}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CashCountGrid;
