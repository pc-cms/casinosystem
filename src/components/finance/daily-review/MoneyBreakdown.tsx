import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumberSpaces } from "@/lib/currency";
import { Banknote, Smartphone, Building2 } from "lucide-react";

interface MoneyBreakdownProps {
  closingCount: any;
  closingCash: any;
  exchangeRates: Record<string, number>;
}

export const MoneyBreakdown = ({ closingCount, closingCash, exchangeRates }: MoneyBreakdownProps) => {
  if (!closingCount) return null;

  const totals = closingCount.totals || {};
  const mobile = closingCount.mobile || {};
  const bank = closingCount.bank || {};

  // Cash total (chips + all currency cash)
  const chipsTzs = totals.chips_tzs || 0;
  const cashTzs = totals.TZS || 0;
  const foreignCurrencies = ["USD", "EUR", "GBP", "KES"];
  const foreignTotals = foreignCurrencies.map(c => ({
    currency: c,
    amount: totals[c] || 0,
    tzs: (totals[c] || 0) * (exchangeRates[c] || 0),
  })).filter(f => f.amount > 0);

  const totalCashPhysical = chipsTzs + cashTzs + foreignTotals.reduce((s, f) => s + f.tzs, 0);

  // Mobile total
  const mobileProviders = Object.entries(mobile).filter(([, v]) => (v as number) !== 0);
  const mobileTotal: number = (Object.values(mobile) as number[]).reduce((s, v) => s + (v || 0), 0);

  // Bank total
  const bankTzs = bank.tzs || 0;
  const bankUsd = bank.usd || 0;
  const bankTotalTzs = bankTzs + bankUsd * (exchangeRates["USD"] || 0);

  const grandTotal = totalCashPhysical + mobileTotal + bankTotalTzs;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Money Breakdown (from Cage)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Cash */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Banknote className="w-4 h-4" /> Physical Cash
            </div>
            <span className="font-mono text-xs font-bold text-foreground">{formatNumberSpaces(totalCashPhysical)}</span>
          </div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between text-muted-foreground">
              <span>Chips</span><span>{formatNumberSpaces(chipsTzs)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>TZS Cash</span><span>{formatNumberSpaces(cashTzs)}</span>
            </div>
            {foreignTotals.map(f => (
              <div key={f.currency} className="flex justify-between text-muted-foreground">
                <span>{f.currency} ({formatNumberSpaces(f.amount)})</span>
                <span>{formatNumberSpaces(f.tzs)}</span>
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
            <span className={`font-mono text-xs font-bold ${mobileTotal >= 0 ? "text-foreground" : "text-destructive"}`}>
              {mobileTotal >= 0 ? "" : ""}{formatNumberSpaces(mobileTotal)}
            </span>
          </div>
          {mobileProviders.length > 0 ? (
            <div className="space-y-1 text-xs font-mono">
              {mobileProviders.map(([provider, rawValue]) => {
                const val = Number(rawValue) || 0;
                return (
                <div key={provider} className="flex justify-between">
                  <span className="text-muted-foreground">{provider}</span>
                  <span className={val >= 0 ? "text-foreground" : "text-destructive"}>
                    {val >= 0 ? "+" : ""}{formatNumberSpaces(val)}
                  </span>
                </div>
                );
              })}

            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No mobile money</p>
          )}
        </div>

        {/* Bank */}
        <div className="p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Building2 className="w-4 h-4" /> Bank Accounts
            </div>
            <span className="font-mono text-xs font-bold text-foreground">{formatNumberSpaces(bankTotalTzs)}</span>
          </div>
          <div className="space-y-1 text-xs font-mono">
            {bankTzs > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>TZS</span><span>{formatNumberSpaces(bankTzs)}</span>
              </div>
            )}
            {bankUsd > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>USD ({formatNumberSpaces(bankUsd)})</span>
                <span>{formatNumberSpaces(bankUsd * (exchangeRates["USD"] || 0))}</span>
              </div>
            )}
            {bankTzs === 0 && bankUsd === 0 && (
              <p className="text-xs text-muted-foreground">No bank balances</p>
            )}
          </div>
        </div>

        {/* Grand Total */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Grand Total (TZS)</span>
            <span className="font-mono text-lg font-bold text-primary">{formatNumberSpaces(grandTotal)}</span>
          </div>
        </div>

        {/* Verification */}
        {closingCash && (
          <div className="flex items-center justify-between text-xs font-mono p-2 rounded border border-border">
            <div className="space-y-0.5">
              <div className="flex gap-4">
                <span className="text-muted-foreground">Expected: {formatNumberSpaces(closingCash.expected || 0)}</span>
                <span className="text-muted-foreground">Counted: {formatNumberSpaces(closingCash.actual || 0)}</span>
              </div>
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
