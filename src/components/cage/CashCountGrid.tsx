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
      {/* 3 columns × 3 equal-height rows; sections fill cells, content centered, totals pinned bottom */}
      <div className="grid grid-cols-1 xl:grid-cols-3 xl:grid-rows-[1fr_1fr_1fr] gap-4 items-stretch">
        {/* Column 1 */}
        <section className="rounded-xl border border-border bg-background/40 p-4 flex flex-col h-full xl:row-start-1 xl:col-start-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em] mb-3">TZS Chips</p>
          <div className="flex-1 flex flex-col justify-center">
            <ChipDenomInput values={chips} onChange={onChipsChange} showValue={false} placeholder={chipPlaceholder} />
          </div>
        </section>
        <section className="rounded-xl border border-border bg-background/40 p-4 flex flex-col h-full xl:row-start-2 xl:row-span-2 xl:col-start-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em] mb-3">TZS Cash</p>
          <div className="flex-1 flex flex-col justify-center">
            <CashDenomInput values={cash["TZS"] || {}} onChange={v => onCashChange("TZS", v)} denoms={CASH_DENOMS["TZS"] || []} currency="TZS" />
          </div>
        </section>

        {/* Column 2 */}
        <section className="rounded-xl border border-border bg-background/40 p-4 flex flex-col h-full xl:row-start-1 xl:col-start-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em] mb-3">USD Cash</p>
          <div className="flex-1 flex flex-col justify-center">
            <CashDenomInput values={cash["USD"] || {}} onChange={v => onCashChange("USD", v)} denoms={CASH_DENOMS["USD"] || []} currency="USD" />
          </div>
        </section>
        <section className="rounded-xl border border-border bg-background/40 p-4 flex flex-col h-full xl:row-start-2 xl:col-start-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em] mb-3">KES Cash</p>
          <div className="flex-1 flex flex-col justify-center">
            <CashDenomInput values={cash["KES"] || {}} onChange={v => onCashChange("KES", v)} denoms={CASH_DENOMS["KES"] || []} currency="KES" />
          </div>
        </section>
        <section className="rounded-xl border border-border bg-background/40 p-4 flex flex-col h-full xl:row-start-3 xl:col-start-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em] mb-3">Mobile Money</p>
          <div className="flex-1 flex flex-col justify-center space-y-0">
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
          <div className="flex items-center justify-between gap-2 pt-1 mt-2 border-t border-border">
            <span className="text-[10px] font-medium text-muted-foreground">Total</span>
            <span className="font-mono text-xs font-bold text-card-foreground">TZS {formatNumberSpaces(mobTotal)}</span>
          </div>
        </section>

        {/* Column 3 */}
        <section className="rounded-xl border border-border bg-background/40 p-4 flex flex-col h-full xl:row-start-1 xl:col-start-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em] mb-3">EUR Cash</p>
          <div className="flex-1 flex flex-col justify-center">
            <CashDenomInput values={cash["EUR"] || {}} onChange={v => onCashChange("EUR", v)} denoms={CASH_DENOMS["EUR"] || []} currency="EUR" />
          </div>
        </section>
        <section className="rounded-xl border border-border bg-background/40 p-4 flex flex-col h-full xl:row-start-2 xl:col-start-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em] mb-3">GBP Cash</p>
          <div className="flex-1 flex flex-col justify-center">
            <CashDenomInput values={cash["GBP"] || {}} onChange={v => onCashChange("GBP", v)} denoms={CASH_DENOMS["GBP"] || []} currency="GBP" />
          </div>
        </section>
        <section className="rounded-xl border border-border bg-background/40 p-4 flex flex-col h-full xl:row-start-3 xl:col-start-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em] mb-3">Banks</p>
          <div className="flex-1 flex flex-col justify-center space-y-0">
            <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-1.5">
              <span className="cms-chip text-[8px] bg-muted text-foreground h-5 w-14 shrink-0 justify-center">TZS</span>
              <NumberInput value={banks.tzs || ""} onChange={v => onBanksChange({ ...banks, tzs: Number(v) || 0 })} className={inputCls} placeholder="0" />
            </div>
            <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-1.5">
              <span className="cms-chip text-[8px] bg-muted text-foreground h-5 w-14 shrink-0 justify-center">USD</span>
              <NumberInput value={banks.usd || ""} onChange={v => onBanksChange({ ...banks, usd: Number(v) || 0 })} className={inputCls} placeholder="0" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 mt-2 border-t border-border">
            <span className="text-[10px] font-medium text-muted-foreground">Total</span>
            <span className="font-mono text-xs font-bold text-card-foreground">TZS {formatNumberSpaces(banksTzsTotal)}</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CashCountGrid;
