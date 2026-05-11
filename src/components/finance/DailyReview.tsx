import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useDailySummaries, useUpsertDailySummary,
  useCageExpensesForDate, useCreateWalletTransaction, useShiftClosingForDate,
  useTablesResultForDate,
} from "@/hooks/use-finance";
import { useCasinoInfo } from "@/hooks/use-table-lifecycle";
import { useAuth } from "@/lib/auth-context";
import { MoneyBreakdown } from "@/components/finance/daily-review/MoneyBreakdown";
import { formatNumberSpaces, formatInputWithSpaces, parseSpacedNumber } from "@/lib/currency";
import { Check, AlertTriangle, ArrowDownToLine } from "lucide-react";
import { DateNavigator } from "@/components/ui/date-navigator";
import { format, subDays, addDays } from "date-fns";
import { fmtDate } from "@/lib/format-date";
import { toast } from "sonner";

// Calculate physical cash in cage from closing_count (excludes chips, mobile, bank)
const getClosingCashOnly = (closingCount: any, rates: Record<string, number>): number => {
  if (!closingCount?.cash) return 0;
  const cash = closingCount.cash as Record<string, Record<number, number>>;
  return Object.entries(cash).reduce((sum, [cur, denoms]) => {
    const t = Object.entries(denoms || {}).reduce((s, [d, c]) => s + Number(d) * (Number(c) || 0), 0);
    const rate = cur === "TZS" ? 1 : (rates[cur] || 0);
    return sum + t * rate;
  }, 0);
};

export const DailyReview = () => {
  const { casinoId } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [slotsInput, setSlotsInput] = useState("");
  const [comment, setComment] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [equalizing, setEqualizing] = useState(false);

  const { data: summaries = [] } = useDailySummaries();
  const { data: cageExpenses = 0 } = useCageExpensesForDate(selectedDate);
  const { data: shiftClosing } = useShiftClosingForDate(selectedDate);
  const { data: casinoInfo } = useCasinoInfo();
  // Canonical chip-based shift P&L for the date — Σ shifts.tables_result.
  // (Was previously confused with cash result, which corrupted Finance KPIs.)
  const { data: tablesResultDate = 0 } = useTablesResultForDate(selectedDate);
  const upsert = useUpsertDailySummary();
  const createTx = useCreateWalletTransaction();

  const existing = summaries.find(s => s.date === selectedDate);

  // Cash result from cage shift (closing cash − opening cash, adjusted for float/collection).
  // Analytical only here — NOT written into daily_summaries.tables_result anymore.
  const cashResult = Number((shiftClosing?.closing_cash as any)?.cash_result) || 0;
  const hasShiftData = !!shiftClosing;
  const rates = (shiftClosing?.exchange_rates || {}) as Record<string, number>;

  const slotsValue = existing?.confirmed ? existing.slots_result : parseSpacedNumber(slotsInput);
  // Day's tables result: prefer just-loaded canonical RPC sum; on confirmed
  // days fall back to the persisted summary (matches what was saved).
  const tablesResult = existing?.confirmed ? Number(existing.tables_result || 0) : Number(tablesResultDate || 0);
  const totalResult = tablesResult + slotsValue;
  const netResult = totalResult - cageExpenses;

  // Float equalization
  const cageFloatTarget = Number((casinoInfo as any)?.cage_float) || 0;
  const closingCashAmount = getClosingCashOnly(shiftClosing?.closing_count, rates);
  const floatDeficit = cageFloatTarget - closingCashAmount; // >0 means manager must bring cash

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setSlotsInput("");
    setComment("");
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await upsert.mutateAsync({
        date: selectedDate,
        tables_result: cashResult,
        slots_result: slotsValue,
        total_expenses: cageExpenses,
        confirmed: true,
        comment: comment || existing?.comment || "",
      });

      if (casinoId && netResult !== 0) {
        try {
          if (netResult > 0) {
            await createTx.mutateAsync({
              tx_type: "daily_result",
              to_wallet: "main_cash",
              amount: netResult,
              description: `Daily result ${selectedDate} (income)`,
              business_date: selectedDate,
            });
            await createTx.mutateAsync({
              tx_type: "transfer",
              from_wallet: "main_cash",
              amount: netResult,
              to_wallet: "office_safe",
              description: `Transfer to safe ${selectedDate}`,
              business_date: selectedDate,
            });
          } else {
            await createTx.mutateAsync({
              tx_type: "daily_result",
              from_wallet: "main_cash",
              amount: Math.abs(netResult),
              description: `Daily result ${selectedDate} (loss)`,
              business_date: selectedDate,
            });
          }
        } catch (txErr: any) {
          if (txErr.message?.includes("idx_wallet_tx_daily_result_unique") || txErr.message?.includes("duplicate")) {
            // Already exists — skip
          } else {
            throw txErr;
          }
        }
      }
      toast.success("Day confirmed & transferred to safe");
    } catch (e: any) {
      toast.error(e.message || "Failed to confirm");
    } finally {
      setConfirming(false);
    }
  };

  const handleEqualize = async () => {
    if (!casinoId || floatDeficit === 0) return;
    setEqualizing(true);
    try {
      if (floatDeficit > 0) {
        // Manager brings cash from safe to cage
        await createTx.mutateAsync({
          tx_type: "transfer",
          from_wallet: "office_safe",
          to_wallet: "main_cash",
          amount: floatDeficit,
          description: `Equalize cage float ${selectedDate} (top-up)`,
          business_date: selectedDate,
        });
      } else {
        // Excess cash goes from cage to safe
        await createTx.mutateAsync({
          tx_type: "transfer",
          from_wallet: "main_cash",
          to_wallet: "office_safe",
          amount: Math.abs(floatDeficit),
          description: `Equalize cage float ${selectedDate} (excess)`,
          business_date: selectedDate,
        });
      }
      toast.success("Float equalized");
    } catch (e: any) {
      toast.error(e.message || "Failed to equalize");
    } finally {
      setEqualizing(false);
    }
  };

  const handleSave = () => {
    upsert.mutate({
      date: selectedDate,
      tables_result: cashResult,
      slots_result: slotsValue,
      total_expenses: cageExpenses,
      confirmed: false,
      comment: comment || existing?.comment || "",
    });
  };

  const prevDay = () => handleDateChange(format(subDays(new Date(selectedDate), 1), "yyyy-MM-dd"));
  const nextDay = () => handleDateChange(format(addDays(new Date(selectedDate), 1), "yyyy-MM-dd"));

  return (
    <div className="space-y-4 mt-4">
      {/* Date navigator */}
      <div className="flex items-center gap-2">
        <DateNavigator value={selectedDate} onChange={handleDateChange} />
        {existing?.confirmed && <Badge className="bg-success/10 text-success border-success/30">Confirmed</Badge>}
      </div>

      {/* No shift warning */}
      {!hasShiftData && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/50">
          <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No closed shift found for this date</p>
        </div>
      )}

      {/* Results card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Day Results — {fmtDate(selectedDate)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Cash Result (from Cage)</p>
              <p className={`text-lg font-bold font-mono ${cashResult >= 0 ? "text-foreground" : "text-destructive"}`}>
                {formatNumberSpaces(cashResult)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Buy-ins − Cashouts</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Slots Result (manual)</p>
              {existing?.confirmed ? (
                <p className="text-lg font-bold font-mono">{formatNumberSpaces(existing.slots_result)}</p>
              ) : (
                <Input
                  className="font-mono text-lg font-bold h-8"
                  placeholder="0"
                  value={slotsInput}
                  onChange={e => setSlotsInput(formatInputWithSpaces(e.target.value))}
                />
              )}
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Total Result</p>
              <p className={`text-lg font-bold font-mono ${totalResult >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                {totalResult >= 0 ? "+" : ""}{formatNumberSpaces(totalResult)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Expenses (from Cage)</p>
              <p className="text-lg font-bold font-mono">{formatNumberSpaces(cageExpenses)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Net → Office Safe</p>
              <p className={`text-lg font-bold font-mono ${netResult >= 0 ? "text-success" : "text-destructive"}`}>
                {formatNumberSpaces(netResult)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Auto-transfer on confirm</p>
            </div>
          </div>

          {/* Comment */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Comment</p>
            <Textarea
              value={comment || existing?.comment || ""}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a note for this day..."
              rows={2}
              disabled={existing?.confirmed}
            />
          </div>

          {/* Actions */}
          {!existing?.confirmed && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={upsert.isPending || confirming}>Save Draft</Button>
              <Button onClick={handleConfirm} disabled={upsert.isPending || confirming || !hasShiftData} className="gap-1">
                <Check className="w-4 h-4" /> Confirm Day
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Equalize Float — shown after confirm when cage float target is set */}
      {existing?.confirmed && hasShiftData && cageFloatTarget > 0 && floatDeficit !== 0 && (
        <Card className={floatDeficit > 0 ? "border-destructive/30" : "border-success/30"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4" /> Equalize Float
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Float Target</p>
                <p className="text-sm font-bold font-mono">{formatNumberSpaces(cageFloatTarget)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Cash in Cage</p>
                <p className="text-sm font-bold font-mono">{formatNumberSpaces(closingCashAmount)}</p>
              </div>
              <div className={`p-3 rounded-lg border text-center ${floatDeficit > 0 ? "bg-destructive/5 border-destructive/20" : "bg-success/5 border-success/20"}`}>
                <p className="text-[10px] text-muted-foreground mb-1">
                  {floatDeficit > 0 ? "Manager Must Bring" : "Excess to Safe"}
                </p>
                <p className={`text-sm font-bold font-mono ${floatDeficit > 0 ? "text-destructive" : "text-success"}`}>
                  {formatNumberSpaces(Math.abs(floatDeficit))}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {floatDeficit > 0
                ? `Manager transfers ${formatNumberSpaces(floatDeficit)} TZS from Office Safe → Cage to restore the float.`
                : `Excess ${formatNumberSpaces(Math.abs(floatDeficit))} TZS transferred from Cage → Office Safe.`
              }
            </p>

            <Button onClick={handleEqualize} disabled={equalizing} className="gap-1 w-full">
              <ArrowDownToLine className="w-4 h-4" />
              {equalizing ? "Processing…" : floatDeficit > 0 ? "Top-Up Cage Float" : "Transfer Excess to Safe"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Income Breakdown from Cage */}
      {shiftClosing?.closing_count && (
        <MoneyBreakdown
          openingFloat={shiftClosing.opening_float}
          closingCount={shiftClosing.closing_count}
          closingCash={shiftClosing.closing_cash}
          exchangeRates={rates}
        />
      )}

      {/* History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recent Days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {summaries.slice(0, 14).map(s => (
              <button
                key={s.id}
                onClick={() => handleDateChange(s.date)}
                className={`w-full flex items-center justify-between py-2 px-3 rounded-md text-sm transition-colors ${
                  s.date === selectedDate ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono">{s.date}</span>
                  {s.confirmed && <Badge variant="outline" className="text-[10px] px-1 py-0 bg-success/10 text-success border-success/30">✓</Badge>}
                </div>
                <span className="font-mono font-medium">{formatNumberSpaces(s.total_result)}</span>
              </button>
            ))}
            {summaries.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No summaries yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
