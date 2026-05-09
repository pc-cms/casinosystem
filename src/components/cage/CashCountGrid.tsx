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
  const banksTzsTotal = (banks.tzs || 0) + (banks.usd || 0) * (rates?.["USD"] || 0);

  const rowInput = "no-spin font-mono text-sm h-9 w-40 rounded border border-border bg-background px-2 text-right text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const rowLabel = "cms-chip text-[10px] bg-muted text-foreground h-7 w-16 shrink-0 justify-center";

  const sectionCls = "rounded-xl border border-border bg-background/40 p-3 space-y-2";
  const titleCls = "text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.22em]";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-start">
      {/* Column 1: TZS Chips (full height) */}
      <section className={sectionCls}>
        <p className={titleCls}>TZS Chips</p>
        <ChipDenomInput
          values={chips}
          onChange={onChipsChange}
          showValue={false}
          placeholder={chipPlaceholder}
          columns={2}
          size="md"
        />
      </section>

      {/* Column 2: TZS Cash above USD Cash */}
      <div className="grid gap-3 content-start">
        <section className={sectionCls}>
          <p className={titleCls}>TZS Cash</p>
          <CashDenomInput values={cash["TZS"] || {}} onChange={v => onCashChange("TZS", v)} denoms={CASH_DENOMS["TZS"] || []} currency="TZS" />
        </section>
        <section className={sectionCls}>
          <p className={titleCls}>USD Cash</p>
          <CashDenomInput values={cash["USD"] || {}} onChange={v => onCashChange("USD", v)} denoms={CASH_DENOMS["USD"] || []} currency="USD" />
        </section>
      </div>

      {/* Column 3: EUR Cash + GBP Cash */}
      <div className="grid gap-3 content-start">
        <section className={sectionCls}>
          <p className={titleCls}>EUR Cash</p>
          <CashDenomInput values={cash["EUR"] || {}} onChange={v => onCashChange("EUR", v)} denoms={CASH_DENOMS["EUR"] || []} currency="EUR" />
        </section>
        <section className={sectionCls}>
          <p className={titleCls}>GBP Cash</p>
          <CashDenomInput values={cash["GBP"] || {}} onChange={v => onCashChange("GBP", v)} denoms={CASH_DENOMS["GBP"] || []} currency="GBP" />
        </section>
      </div>

      {/* Column 4: KES Cash + Mobile Money + Banks */}
      <div className="grid gap-3 content-start">
        <section className={sectionCls}>
          <p className={titleCls}>KES Cash</p>
          <CashDenomInput values={cash["KES"] || {}} onChange={v => onCashChange("KES", v)} denoms={CASH_DENOMS["KES"] || []} currency="KES" />
        </section>
        <section className={sectionCls}>
          <p className={titleCls}>Mobile Money</p>
          <div className="space-y-1">
            {MOBILE_PROVIDERS.map(provider => (
              <div key={provider} className="flex items-center justify-between gap-2">
                <span className={rowLabel}>{provider}</span>
                <NumberInput
                  value={mobile[provider] || ""}
                  onChange={v => onMobileChange({ ...mobile, [provider]: Number(v) || 0 })}
                  className={rowInput}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-border">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total</span>
            <span className="font-mono text-base font-bold text-card-foreground whitespace-nowrap">TZS {formatNumberSpaces(mobTotal)}</span>
          </div>
        </section>
        <section className={sectionCls}>
          <p className={titleCls}>Banks</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className={rowLabel}>TZS</span>
              <NumberInput value={banks.tzs || ""} onChange={v => onBanksChange({ ...banks, tzs: Number(v) || 0 })} className={rowInput} placeholder="0" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={rowLabel}>USD</span>
              <NumberInput value={banks.usd || ""} onChange={v => onBanksChange({ ...banks, usd: Number(v) || 0 })} className={rowInput} placeholder="0" />
            </div>
          </div>
          <div className="pt-2 mt-2 border-t border-border space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">USD in TZS</span>
              <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">TZS {formatNumberSpaces((banks.usd || 0) * (rates?.["USD"] || 0))}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total</span>
              <span className="font-mono text-base font-bold text-card-foreground whitespace-nowrap">TZS {formatNumberSpaces(banksTzsTotal)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CashCountGrid;
