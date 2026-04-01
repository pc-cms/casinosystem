import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumberSpaces } from "@/lib/currency";
import { Banknote, Smartphone, Building2, TrendingUp, TrendingDown } from "lucide-react";

interface MoneyBreakdownProps {
  openingFloat: any;
  closingCount: any;
  closingCash: any;
  exchangeRates: Record<string, number>;
}

const CURRENCIES = ["TZS", "USD", "EUR", "GBP", "KES"];
const MOBILE_PROVIDERS = ["Mpesa", "Tigo", "Halo", "AirTel"];

const cashSum = (denoms: Record<number, number> | undefined) =>
  Object.entries(denoms || {}).reduce((s, [d, c]) => s + Number(d) * (Number(c) || 0), 0);

export const MoneyBreakdown = ({ openingFloat, closingCount, closingCash, exchangeRates }: MoneyBreakdownProps) => {
  if (!closingCount || !openingFloat) return null;

  const openCash = openingFloat.cash || {};
  const closeCash = closingCount.cash || {};
  const openMobile = openingFloat.mobile || {};
  const closeMobile = closingCount.mobile || {};
  const openBank = openingFloat.bank || {};
  const closeBank = closingCount.bank || {};

  // Cash deltas per currency (closing - opening = how much came in via this currency)
  const cashDeltas = CURRENCIES.map(cur => {
    const openVal = cashSum(openCash[cur]);
    const closeVal = cashSum(closeCash[cur]);
    const delta = closeVal - openVal;
    const rate = cur === "TZS" ? 1 : (exchangeRates[cur] || 0);
    return { currency: cur, open: openVal, close: closeVal, delta, deltaTzs: delta * rate, rate };
  }).filter(c => c.open !== 0 || c.close !== 0 || c.delta !== 0);

  const totalCashDeltaTzs = cashDeltas.reduce((s, c) => s + c.deltaTzs, 0);

  // Mobile deltas
  const mobileDeltas = MOBILE_PROVIDERS.map(p => {
    const openVal = Number(openMobile[p]) || 0;
    const closeVal = Number(closeMobile[p]) || 0;
    return { provider: p, open: openVal, close: closeVal, delta: closeVal - openVal };
  }).filter(m => m.open !== 0 || m.close !== 0 || m.delta !== 0);

  const totalMobileDelta = mobileDeltas.reduce((s, m) => s + m.delta, 0);

  // Bank deltas
  const bankDeltaTzs = (Number(closeBank.tzs) || 0) - (Number(openBank.tzs) || 0);
  const bankDeltaUsd = (Number(closeBank.usd) || 0) - (Number(openBank.usd) || 0);
  const bankDeltaTotalTzs = bankDeltaTzs + bankDeltaUsd * (exchangeRates["USD"] || 0);
  const hasBankDelta = bankDeltaTzs !== 0 || bankDeltaUsd !== 0;

  // Grand total income
  const grandDelta = totalCashDeltaTzs + totalMobileDelta + bankDeltaTotalTzs;

  const DeltaValue = ({ value, suffix }: { value: number; suffix?: string }) => (
    <span className={`font-mono text-xs font-bold ${value > 0 ? "text-green-500" : value < 0 ? "text-destructive" : "text-muted-foreground"}`}>
      {value > 0 ? "+" : ""}{formatNumberSpaces(value)}{suffix ? ` ${suffix}` : ""}
    </span>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Income Breakdown (by payment method)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Cash by currency */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Banknote className="w-4 h-4" /> Cash
            </div>
            <DeltaValue value={totalCashDeltaTzs} suffix="TZS" />
          </div>
          <div className="space-y-1 text-xs font-mono">
            {cashDeltas.map(c => (
              <div key={c.currency} className="flex justify-between">
                <span className="text-muted-foreground">
                  {c.currency}
                  {c.currency !== "TZS" && c.delta !== 0 && (
                    <span className="text-muted-foreground/60"> ({c.delta > 0 ? "+" : ""}{formatNumberSpaces(c.delta)} × {formatNumberSpaces(c.rate)})</span>
                  )}
                </span>
                <DeltaValue value={c.deltaTzs} />
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Money */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Smartphone className="w-4 h-4" /> Mobile Money
            </div>
            <DeltaValue value={totalMobileDelta} suffix="TZS" />
          </div>
          {mobileDeltas.length > 0 ? (
            <div className="space-y-1 text-xs font-mono">
              {mobileDeltas.map(m => (
                <div key={m.provider} className="flex justify-between">
                  <span className="text-muted-foreground">{m.provider}</span>
                  <DeltaValue value={m.delta} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No mobile money movement</p>
          )}
        </div>

        {/* Bank */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Building2 className="w-4 h-4" /> Bank Accounts
            </div>
            <DeltaValue value={bankDeltaTotalTzs} suffix="TZS" />
          </div>
          {hasBankDelta ? (
            <div className="space-y-1 text-xs font-mono">
              {bankDeltaTzs !== 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TZS</span>
                  <DeltaValue value={bankDeltaTzs} />
                </div>
              )}
              {bankDeltaUsd !== 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">USD ({bankDeltaUsd > 0 ? "+" : ""}{formatNumberSpaces(bankDeltaUsd)} × {formatNumberSpaces(exchangeRates["USD"] || 0)})</span>
                  <DeltaValue value={bankDeltaUsd * (exchangeRates["USD"] || 0)} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No bank movement</p>
          )}
        </div>

        {/* Grand Total */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {grandDelta >= 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
              <span className="text-xs font-semibold text-foreground">Total Income (TZS)</span>
            </div>
            <span className={`font-mono text-lg font-bold ${grandDelta >= 0 ? "text-green-500" : "text-destructive"}`}>
              {grandDelta > 0 ? "+" : ""}{formatNumberSpaces(grandDelta)}
            </span>
          </div>
        </div>

        {/* Verification */}
        {closingCash && (
          <div className="flex items-center justify-between text-xs font-mono p-2 rounded border border-border">
            <div className="flex gap-4">
              <span className="text-muted-foreground">Expected: {formatNumberSpaces(closingCash.expected || 0)}</span>
              <span className="text-muted-foreground">Counted: {formatNumberSpaces(closingCash.actual || 0)}</span>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] ${(closingCash.difference || 0) === 0
                ? "bg-green-500/10 text-green-500 border-green-500/30"
                : "bg-destructive/10 text-destructive border-destructive/30"
              }`}
            >
              Δ {formatNumberSpaces(closingCash.difference || 0)}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
