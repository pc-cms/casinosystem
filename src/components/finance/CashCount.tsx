import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWallets, WALLET_LABELS, WalletType, useCreateWalletTransaction } from "@/hooks/use-finance";
import { useCashCountHistory, useCreateCashCount } from "@/hooks/use-cash-count";
import { CASH_DENOMS, CURRENCIES, SupportedCurrency, DEFAULT_EXCHANGE_RATES, formatNumberSpaces, formatCashDenomLabel, formatCurrency } from "@/lib/currency";
import { AlertTriangle, CheckCircle, ClipboardCheck, History } from "lucide-react";
import { format } from "date-fns";

const COUNTABLE_WALLETS: WalletType[] = ["main_cash", "office_safe"];

export const CashCount = () => {
  const { data: wallets = [], isLoading } = useWallets();
  const { data: history = [] } = useCashCountHistory();
  const createCount = useCreateCashCount();
  const createAdjustment = useCreateWalletTransaction();

  const [selectedWallet, setSelectedWallet] = useState<WalletType>("main_cash");
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>("TZS");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const denoms = CASH_DENOMS[selectedCurrency] || [];
  const exchangeRate = selectedCurrency === "TZS" ? 1 : (DEFAULT_EXCHANGE_RATES[selectedCurrency] || 1);
  const expectedBalance = Number(wallets.find(w => w.wallet_type === selectedWallet)?.current_balance || 0);

  const physicalTotal = useMemo(() =>
    denoms.reduce((sum, d) => sum + d * (quantities[d] || 0), 0),
    [denoms, quantities]
  );

  const physicalTotalTzs = physicalTotal * exchangeRate;
  const discrepancy = expectedBalance - physicalTotalTzs;

  const handleQuantityChange = (denom: number, raw: string) => {
    const val = raw === "" ? 0 : parseInt(raw, 10);
    if (isNaN(val) || val < 0) return;
    setQuantities(prev => ({ ...prev, [denom]: val }));
  };

  const handleSubmit = async () => {
    const denomMap: Record<string, number> = {};
    denoms.forEach(d => { if (quantities[d]) denomMap[String(d)] = quantities[d]; });

    await createCount.mutateAsync({
      wallet_type: selectedWallet,
      currency: selectedCurrency,
      denominations: denomMap,
      physical_total: physicalTotal,
      expected_balance: expectedBalance,
      discrepancy,
      exchange_rate: exchangeRate,
      physical_total_tzs: physicalTotalTzs,
      note,
    });
    setQuantities({});
    setNote("");
  };

  const handleAdjustment = async (snap: typeof history[0]) => {
    if (snap.discrepancy === 0) return;
    // If discrepancy > 0: system has more than physical → reduce wallet
    // If discrepancy < 0: system has less than physical → increase wallet
    const absDisc = Math.abs(snap.discrepancy);
    if (snap.discrepancy > 0) {
      await createAdjustment.mutateAsync({
        tx_type: "manual_expense",
        from_wallet: snap.wallet_type,
        amount: absDisc,
        expense_category: "adjustments",
        description: `Cash count adjustment — system reduced by TZS ${formatNumberSpaces(absDisc)}`,
        business_date: new Date().toISOString().slice(0, 10),
      });
    } else {
      await createAdjustment.mutateAsync({
        tx_type: "daily_result",
        to_wallet: snap.wallet_type,
        amount: absDisc,
        description: `Cash count adjustment — system increased by TZS ${formatNumberSpaces(absDisc)}`,
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
          <History className="w-4 h-4 mr-1" /> {showHistory ? "New Count" : "History"}
        </Button>
      </div>

      {showHistory ? (
        <HistoryView history={history} onAdjust={handleAdjustment} isAdjusting={createAdjustment.isPending} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Input panel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Count Cash</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Select value={selectedWallet} onValueChange={v => { setSelectedWallet(v as WalletType); setQuantities({}); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTABLE_WALLETS.map(wt => (
                      <SelectItem key={wt} value={wt}>{WALLET_LABELS[wt]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedCurrency} onValueChange={v => { setSelectedCurrency(v as SupportedCurrency); setQuantities({}); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCurrency !== "TZS" && (
                <p className="text-[10px] text-muted-foreground">
                  Rate: 1 {selectedCurrency} = TZS {formatNumberSpaces(exchangeRate)}
                </p>
              )}

              <div className="space-y-0.5">
                {denoms.map(d => (
                  <div key={d} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-1.5">
                    <span className="text-xs font-mono font-medium text-muted-foreground text-right">
                      {formatCashDenomLabel(d, selectedCurrency)}
                    </span>
                    <input
                      type="number"
                      className="no-spin font-mono text-xs h-7 w-full rounded border border-border bg-background px-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      value={quantities[d] || ""}
                      onChange={e => handleQuantityChange(d, e.target.value)}
                      placeholder="0"
                      inputMode="numeric"
                    />
                    {(quantities[d] || 0) > 0 && (
                      <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">
                        ={formatCurrency(d * (quantities[d] || 0), selectedCurrency)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="text-xs h-16"
              />

              <Button
                onClick={handleSubmit}
                disabled={physicalTotal === 0 || createCount.isPending}
                className="w-full"
                size="sm"
              >
                {createCount.isPending ? "Saving…" : "Save Cash Count"}
              </Button>
            </CardContent>
          </Card>

          {/* Result panel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Reconciliation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ResultRow label="Expected (system)" value={expectedBalance} />
              <ResultRow label={`Physical (${selectedCurrency})`} value={physicalTotal} currency={selectedCurrency} />
              {selectedCurrency !== "TZS" && (
                <ResultRow label="Physical (TZS)" value={physicalTotalTzs} />
              )}
              <div className="border-t border-border pt-2">
                <div className={`flex items-center justify-between gap-2 p-2 rounded ${
                  discrepancy === 0
                    ? "bg-emerald-500/10"
                    : "bg-destructive/10"
                }`}>
                  <span className="text-xs font-medium flex items-center gap-1">
                    {discrepancy === 0 ? (
                      <><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Match</>
                    ) : (
                      <><AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Discrepancy</>
                    )}
                  </span>
                  <span className={`font-mono text-sm font-bold ${
                    discrepancy === 0 ? "text-emerald-500" : "text-destructive"
                  }`}>
                    {discrepancy > 0 ? "+" : ""}{formatNumberSpaces(discrepancy)} TZS
                  </span>
                </div>
                {discrepancy !== 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {discrepancy > 0
                      ? "System balance exceeds physical cash — possible unrecorded expense."
                      : "Physical cash exceeds system balance — possible unrecorded income."}
                  </p>
                )}
              </div>

              <div className="text-[10px] text-muted-foreground border-t border-border pt-2">
                <p className="font-medium mb-0.5">Balance Rule</p>
                <p>Expected Cash = Opening + Income − Expenses − Collections</p>
                <p>Physical Cash = Sum of all denominations × exchange rate</p>
                <p>Discrepancy = Expected − Physical</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

const ResultRow = ({ label, value, currency = "TZS" }: { label: string; value: number; currency?: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="font-mono text-xs font-semibold text-foreground">{formatCurrency(value, currency)}</span>
  </div>
);

const HistoryView = ({ history, onAdjust, isAdjusting }: {
  history: any[];
  onAdjust: (snap: any) => void;
  isAdjusting: boolean;
}) => {
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
              {snap.discrepancy !== 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px]"
                  onClick={() => onAdjust(snap)}
                  disabled={isAdjusting}
                >
                  Create Adjustment
                </Button>
              )}
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
