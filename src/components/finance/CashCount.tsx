import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWallets, WALLET_LABELS, WalletType, useCreateWalletTransaction } from "@/hooks/use-finance";
import { useCashCountHistory, useLatestCashCounts, useCreateCashCount } from "@/hooks/use-cash-count";
import { CASH_DENOMS, CURRENCIES, SupportedCurrency, DEFAULT_EXCHANGE_RATES, formatNumberSpaces, formatCashDenomLabel, formatCurrency } from "@/lib/currency";
import { AlertTriangle, CheckCircle, ClipboardCheck, History, Save } from "lucide-react";
import { format } from "date-fns";

const COUNTABLE_WALLETS: WalletType[] = ["main_cash", "office_safe"];

// Key for quantities state: "walletType__currency__denom"
type QtyState = Record<string, number>;

const qKey = (wallet: string, currency: string, denom: number) => `${wallet}__${currency}__${denom}`;

export const CashCount = () => {
  const { data: wallets = [], isLoading } = useWallets();
  const { data: history = [] } = useCashCountHistory();
  const { data: latestSnapshots = [] } = useLatestCashCounts();
  const createCount = useCreateCashCount();
  const createAdjustment = useCreateWalletTransaction();

  const [quantities, setQuantities] = useState<QtyState>({});
  const [note, setNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Pre-fill from latest snapshots
  useEffect(() => {
    if (prefilled || latestSnapshots.length === 0) return;
    const q: QtyState = {};
    for (const snap of latestSnapshots) {
      if (!COUNTABLE_WALLETS.includes(snap.wallet_type as WalletType)) continue;
      const denoms = snap.denominations as Record<string, number>;
      for (const [denomStr, qty] of Object.entries(denoms)) {
        if (qty > 0) {
          q[qKey(snap.wallet_type, snap.currency, Number(denomStr))] = qty;
        }
      }
    }
    setQuantities(q);
    setPrefilled(true);
  }, [latestSnapshots, prefilled]);

  const handleQuantityChange = useCallback((wallet: string, currency: string, denom: number, raw: string) => {
    const val = raw === "" ? 0 : parseInt(raw, 10);
    if (isNaN(val) || val < 0) return;
    setQuantities(prev => ({ ...prev, [qKey(wallet, currency, denom)]: val }));
  }, []);

  // Calculate totals per wallet across all currencies
  const walletTotals = useMemo(() => {
    const result: Record<string, { totalTzs: number; byCurrency: Record<string, number> }> = {};
    for (const wt of COUNTABLE_WALLETS) {
      let totalTzs = 0;
      const byCurrency: Record<string, number> = {};
      for (const cur of CURRENCIES) {
        const denoms = CASH_DENOMS[cur] || [];
        const rate = cur === "TZS" ? 1 : (DEFAULT_EXCHANGE_RATES[cur] || 1);
        let curTotal = 0;
        for (const d of denoms) {
          curTotal += d * (quantities[qKey(wt, cur, d)] || 0);
        }
        byCurrency[cur] = curTotal;
        totalTzs += curTotal * rate;
      }
      result[wt] = { totalTzs, byCurrency };
    }
    return result;
  }, [quantities]);

  // Grand total physical TZS
  const grandPhysicalTzs = useMemo(() =>
    COUNTABLE_WALLETS.reduce((sum, wt) => sum + (walletTotals[wt]?.totalTzs || 0), 0),
    [walletTotals]
  );

  // Grand expected
  const grandExpected = useMemo(() =>
    COUNTABLE_WALLETS.reduce((sum, wt) => {
      const w = wallets.find(w => w.wallet_type === wt);
      return sum + Number(w?.current_balance || 0);
    }, 0),
    [wallets]
  );

  const grandDiscrepancy = grandExpected - grandPhysicalTzs;

  const handleSave = async () => {
    // Save one snapshot per wallet per currency that has data
    for (const wt of COUNTABLE_WALLETS) {
      for (const cur of CURRENCIES) {
        const denoms = CASH_DENOMS[cur] || [];
        const rate = cur === "TZS" ? 1 : (DEFAULT_EXCHANGE_RATES[cur] || 1);
        const denomMap: Record<string, number> = {};
        let hasData = false;
        let physTotal = 0;
        for (const d of denoms) {
          const qty = quantities[qKey(wt, cur, d)] || 0;
          if (qty > 0) {
            denomMap[String(d)] = qty;
            hasData = true;
          }
          physTotal += d * qty;
        }
        if (!hasData) continue;
        const expected = Number(wallets.find(w => w.wallet_type === wt)?.current_balance || 0);
        const physTotalTzs = physTotal * rate;
        await createCount.mutateAsync({
          wallet_type: wt,
          currency: cur,
          denominations: denomMap,
          physical_total: physTotal,
          expected_balance: expected,
          discrepancy: expected - physTotalTzs,
          exchange_rate: rate,
          physical_total_tzs: physTotalTzs,
          note,
        });
      }
    }
    setNote("");
  };

  const handleAdjustment = async (walletType: WalletType, discrepancy: number) => {
    if (discrepancy === 0) return;
    const abs = Math.abs(discrepancy);
    if (discrepancy > 0) {
      await createAdjustment.mutateAsync({
        tx_type: "adjustment" as any,
        from_wallet: walletType,
        amount: abs,
        description: `Cash count adjustment — system reduced by TZS ${formatNumberSpaces(abs)}`,
        business_date: new Date().toISOString().slice(0, 10),
      });
    } else {
      await createAdjustment.mutateAsync({
        tx_type: "adjustment" as any,
        to_wallet: walletType,
        amount: abs,
        description: `Cash count adjustment — system increased by TZS ${formatNumberSpaces(abs)}`,
        business_date: new Date().toISOString().slice(0, 10),
      });
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5" /> Physical Cash Count
        </h2>
        <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
          <History className="w-4 h-4 mr-1" /> {showHistory ? "Count" : "History"}
        </Button>
      </div>

      {showHistory ? (
        <HistoryView history={history} />
      ) : (
        <div className="space-y-4">
          {/* Wallet sections */}
          {COUNTABLE_WALLETS.map(wt => {
            const expected = Number(wallets.find(w => w.wallet_type === wt)?.current_balance || 0);
            const physical = walletTotals[wt]?.totalTzs || 0;
            const disc = expected - physical;
            return (
              <Card key={wt}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{WALLET_LABELS[wt]}</CardTitle>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">System: <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(expected)}</span></span>
                      <span className="text-muted-foreground">Physical: <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(physical)}</span></span>
                      <span className={`font-mono font-bold ${disc === 0 ? "text-emerald-500" : "text-destructive"}`}>
                        {disc === 0 ? <CheckCircle className="w-3.5 h-3.5 inline mr-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 inline mr-0.5" />}
                        {disc > 0 ? "+" : ""}{formatNumberSpaces(disc)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {CURRENCIES.map(cur => {
                      const denoms = CASH_DENOMS[cur] || [];
                      const rate = cur === "TZS" ? 1 : (DEFAULT_EXCHANGE_RATES[cur] || 1);
                      const curTotal = walletTotals[wt]?.byCurrency[cur] || 0;
                      const curTotalTzs = curTotal * rate;
                      return (
                        <CurrencySection
                          key={cur}
                          wallet={wt}
                          currency={cur}
                          denoms={denoms}
                          rate={rate}
                          quantities={quantities}
                          total={curTotal}
                          totalTzs={curTotalTzs}
                          onChange={handleQuantityChange}
                        />
                      );
                    })}
                  </div>
                  {disc !== 0 && (
                    <div className="flex items-center justify-between mt-3 p-2 rounded bg-destructive/10">
                      <span className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {disc > 0 ? "System exceeds physical" : "Physical exceeds system"} by TZS {formatNumberSpaces(Math.abs(disc))}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => handleAdjustment(wt, disc)}
                        disabled={createAdjustment.isPending}
                      >
                        Create Adjustment
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Global summary */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">Total System: <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(grandExpected)}</span></span>
                  <span className="text-muted-foreground">Total Physical: <span className="font-mono font-semibold text-foreground">TZS {formatNumberSpaces(grandPhysicalTzs)}</span></span>
                  <span className={`font-mono text-sm font-bold ${grandDiscrepancy === 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {grandDiscrepancy === 0 ? "✓ Match" : `Δ ${grandDiscrepancy > 0 ? "+" : ""}${formatNumberSpaces(grandDiscrepancy)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="text-xs h-8 min-h-8 w-48 resize-none"
                  />
                  <Button
                    onClick={handleSave}
                    disabled={grandPhysicalTzs === 0 || createCount.isPending}
                    size="sm"
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    {createCount.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

/** Inline denomination grid for one currency in one wallet */
const CurrencySection = ({
  wallet, currency, denoms, rate, quantities, total, totalTzs, onChange,
}: {
  wallet: string;
  currency: string;
  denoms: number[];
  rate: number;
  quantities: QtyState;
  total: number;
  totalTzs: number;
  onChange: (wallet: string, currency: string, denom: number, raw: string) => void;
}) => (
  <div className="border border-border rounded p-2 space-y-1">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs font-semibold text-foreground">{currency}</span>
      {currency !== "TZS" && (
        <span className="text-[9px] text-muted-foreground">×{formatNumberSpaces(rate)}</span>
      )}
    </div>
    {denoms.map(d => {
      const qty = quantities[qKey(wallet, currency, d)] || 0;
      return (
        <div key={d} className="grid grid-cols-[3rem_1fr_auto] items-center gap-1">
          <span className="text-[10px] font-mono text-muted-foreground text-right">
            {formatCashDenomLabel(d, currency)}
          </span>
          <input
            type="number"
            className="no-spin font-mono text-xs h-6 w-full rounded border border-border bg-background px-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={qty || ""}
            onChange={e => onChange(wallet, currency, d, e.target.value)}
            placeholder="0"
            inputMode="numeric"
          />
          {qty > 0 && (
            <span className="text-[8px] font-mono text-muted-foreground whitespace-nowrap">
              {formatCurrency(d * qty, currency)}
            </span>
          )}
        </div>
      );
    })}
    <div className="border-t border-border pt-1 mt-1 flex justify-between text-[10px]">
      <span className="text-muted-foreground">Total</span>
      <span className="font-mono font-semibold text-foreground">
        {formatCurrency(total, currency)}
        {currency !== "TZS" && total > 0 && (
          <span className="text-muted-foreground ml-1">≈TZS {formatNumberSpaces(totalTzs)}</span>
        )}
      </span>
    </div>
  </div>
);

const HistoryView = ({ history }: { history: any[] }) => {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No cash counts recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      {history.map(snap => (
        <Card key={snap.id}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">
                {format(new Date(snap.created_at), "dd MMM yyyy HH:mm")} · {WALLET_LABELS[snap.wallet_type as WalletType]} · {snap.currency}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Expected</span>
                <p className="font-mono font-semibold">TZS {formatNumberSpaces(snap.expected_balance)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Physical</span>
                <p className="font-mono font-semibold">TZS {formatNumberSpaces(snap.physical_total_tzs)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Discrepancy</span>
                <p className={`font-mono font-semibold ${snap.discrepancy === 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {snap.discrepancy > 0 ? "+" : ""}{formatNumberSpaces(snap.discrepancy)}
                </p>
              </div>
            </div>
            {snap.note && <p className="text-[10px] text-muted-foreground mt-1">{snap.note}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
