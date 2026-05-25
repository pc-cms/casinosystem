import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, Send, RotateCcw, Printer, FileText, CreditCard, Save, ArrowLeftRight, Receipt } from "lucide-react";
import SlotsTransfersForm from "./SlotsTransfersForm";
import { useSlotsExpenses, useCreateSlotsExpense } from "@/hooks/use-expenses";

import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import CashDenomInput, { cashSum } from "@/components/cage/CashDenomInput";
import CashCountGrid from "@/components/cage/CashCountGrid";
import {
  emptyBanks, emptyMobile, mobileTotal, bankTotalTzs,
  type Banks, type MobileProviders,
} from "@/components/cage/CageHelpers";
import {
  CURRENCIES, FOREIGN_CURRENCIES, CASH_DENOMS,
  formatNumberSpaces, formatCurrency,
} from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";
import {
  useSlotsRates, useSlotsInventory, useSlotsCards, useSlotsCashCounts,
  useSlotsCashless, useSlotsComments,
  useUpdateSlotsSystemResult, useUpsertSlotsInventory, useUpdateSlotsCards,
  useCreateSlotsCashCount, useSubmitSlotsForReview, useApproveSlotsShift,
  useCreateSlotsCashless, useReopenSlotsShift,
} from "@/hooks/use-cage-slots";
import { useAuth } from "@/lib/auth-context";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import type { Tables } from "@/integrations/supabase/types";
import CashCheckViewerDialog from "@/components/cage/CashCheckViewerDialog";

type Shift = Tables<"cage_slots_shifts">;

const ActiveSlotsShiftView = ({ shift }: { shift: Shift }) => {
  const navigate = useNavigate();
  const { roles, managerOverride } = useAuth();
  const canManage =
    roles.includes("manager") || roles.includes("super_admin") || managerOverride.active;

  const { data: rates = [] } = useSlotsRates(shift.id);
  const { data: inventory = [] } = useSlotsInventory(shift.id);
  const { data: cards } = useSlotsCards(shift.id);
  const { data: checks = [] } = useSlotsCashCounts(shift.id);
  const { data: cashless = [] } = useSlotsCashless(shift.id);
  const { data: comments = [] } = useSlotsComments(shift.id);
  const { data: slotsExpenses = [] } = useSlotsExpenses(shift.id);
  const createExpense = useCreateSlotsExpense();


  const setSystem = useUpdateSlotsSystemResult();
  const upsertInv = useUpsertSlotsInventory();
  const updateCards = useUpdateSlotsCards();
  const saveCheck = useCreateSlotsCashCount();
  const submit = useSubmitSlotsForReview();
  const approve = useApproveSlotsShift();
  const reopen = useReopenSlotsShift();
  const createCashless = useCreateSlotsCashless();

  const rateMap = useMemo(() => {
    const m: Record<string, number> = { TZS: 1 };
    rates.forEach(r => { m[r.currency_code] = Number(r.rate_to_tzs); });
    return m;
  }, [rates]);

  // Opening totals
  const opening = useMemo(() => {
    const byCur: Record<string, Record<number, number>> = Object.fromEntries(CURRENCIES.map(c => [c, {}]));
    inventory.filter(r => r.inventory_type === "opening").forEach(r => {
      byCur[r.currency_code] = byCur[r.currency_code] || {};
      byCur[r.currency_code][r.denomination] = r.quantity;
    });
    return byCur;
  }, [inventory]);

  const openingTotalTzs = useMemo(() =>
    inventory.filter(r => r.inventory_type === "opening")
      .reduce((s, r) => s + Number(r.total_tzs || 0), 0),
    [inventory],
  );

  // Closing entry state (controlled locally, persisted on save)
  const [closingCash, setClosingCash] = useState<Record<string, Record<number, number>>>(
    Object.fromEntries(CURRENCIES.map(c => [c, {}]))
  );
  const [closingBanks, setClosingBanks] = useState<Banks>(emptyBanks());
  const [closingMobile, setClosingMobile] = useState<MobileProviders>(emptyMobile());
  const [closingCards, setClosingCards] = useState<number>(cards?.closing_card_count ?? 0);
  const [systemResultInput, setSystemResultInput] = useState<string>(
    shift.system_shift_result?.toString() ?? "",
  );
  const [cashierNote, setCashierNote] = useState<string>(shift.cashier_note || "");

  // Hydrate closing from persisted closing inventory + cards
  useEffect(() => {
    const byCur: Record<string, Record<number, number>> = Object.fromEntries(CURRENCIES.map(c => [c, {}]));
    inventory.filter(r => r.inventory_type === "closing").forEach(r => {
      byCur[r.currency_code] = byCur[r.currency_code] || {};
      byCur[r.currency_code][r.denomination] = r.quantity;
    });
    setClosingCash(byCur);
  }, [inventory]);
  useEffect(() => {
    if (cards?.closing_card_count != null) setClosingCards(cards.closing_card_count);
  }, [cards?.closing_card_count]);

  // Hydrate banks + mobile from the latest cash check (denominations JSONB).
  useEffect(() => {
    const last = checks[0];
    const d = (last?.denominations || {}) as Record<string, unknown>;
    if (d.bank) setClosingBanks(d.bank as Banks);
    if (d.mobile) setClosingMobile(d.mobile as MobileProviders);
  }, [checks]);


  const closingTzsTotal = useMemo(() => cashSum(closingCash["TZS"] || {}), [closingCash]);
  const closingFxTzs = useMemo(() => FOREIGN_CURRENCIES.reduce(
    (s, c) => s + cashSum(closingCash[c] || {}) * (rateMap[c] || 0), 0,
  ), [closingCash, rateMap]);
  const cardDepositTzs = Number(cards?.card_deposit_value_tzs || 5000);
  const closingCardsTzs = closingCards * cardDepositTzs;
  const closingTotalTzs = closingTzsTotal + closingFxTzs + closingCardsTzs;

  const cashMovementTzs = closingTotalTzs - openingTotalTzs;
  const cashlessNetTzs = useMemo(() =>
    cashless.reduce((s, t: any) => s + (t.direction === "IN" ? Number(t.amount) : -Number(t.amount)), 0),
    [cashless],
  );
  const actualCageResult = cashMovementTzs - cashlessNetTzs;
  const systemResult = Number(systemResultInput) || Number(shift.system_shift_result || 0);
  const difference = actualCageResult - systemResult;

  const persistClosingCash = async (currency: string, denom: number, qty: number) => {
    await upsertInv.mutateAsync({
      shift_id: shift.id,
      inventory_type: "closing",
      currency, denomination: denom, quantity: qty,
      rate_to_tzs: rateMap[currency] || (currency === "TZS" ? 1 : 0),
    });
  };

  // Mid-shift cash check (persists banks + mobile + cash in JSONB so they hydrate on next mount)
  const recordMidCheck = () => {
    saveCheck.mutate({
      shift_id: shift.id,
      count_type: "check",
      denominations: {
        cash: closingCash,
        bank: closingBanks,
        mobile: closingMobile,
        cards: { count: closingCards, value_tzs: cardDepositTzs },
        rateMap,
        totals: {
          total_tzs: closingTotalTzs,
          bank_tzs: bankTotalTzs(closingBanks, rateMap),
          mobile_tzs: mobileTotal(closingMobile),
        },
      },
      total_tzs: closingTotalTzs,
      note: "Mid-shift check",
    });
  };


  // Closing preview dialog (Live Game-style: review before submit-for-review).
  const [showClosingPreview, setShowClosingPreview] = useState(false);

  const openClosingPreview = () => {
    if (!systemResultInput.trim()) {
      alert("Enter the System Result before previewing the closing.");
      return;
    }
    setShowClosingPreview(true);
  };

  const confirmSubmitForReview = () => {
    setSystem.mutate({ shift_id: shift.id, system_shift_result: Number(systemResultInput) || 0 });
    updateCards.mutate({ shift_id: shift.id, closing_card_count: closingCards });
    submit.mutate({
      shift_id: shift.id,
      closing_total_tzs: closingTotalTzs,
      closing_denominations: {
        cash: closingCash,
        cards: { count: closingCards, value_tzs: cardDepositTzs },
        rateMap,
      },
      cashier_note: cashierNote,
    }, { onSuccess: () => setShowClosingPreview(false) });
  };

  // Manager approve
  const [showApprove, setShowApprove] = useState(false);
  const [managerComment, setManagerComment] = useState("");
  const [viewerCheck, setViewerCheck] = useState<Tables<"cash_counts"> | null>(null);
  const needsComment = Math.abs(difference) > 0;

  const doApprove = (managerId: string) => {
    approve.mutate({
      shift_id: shift.id,
      manager_id: managerId,
      manager_comment: managerComment || (needsComment ? "" : "Approved with zero difference"),
    });
    setShowApprove(false);
    setManagerComment("");
  };

  // Cashless entry
  const [clProvider, setClProvider] = useState<"AIRTEL" | "MPESA" | "TIGO" | "HALOTEL">("MPESA");
  const [clDirection, setClDirection] = useState<"IN" | "OUT">("IN");
  const [clAmount, setClAmount] = useState<number>(0);
  const [clName, setClName] = useState("");
  const [clRef, setClRef] = useState("");

  // Per-provider net totals (signed: IN positive, OUT negative) for current shift cashless rows.
  const cashlessByProvider = useMemo(() => {
    const m: Record<string, number> = {};
    cashless.forEach((t: any) => {
      const sign = t.direction === "IN" ? 1 : -1;
      m[t.provider] = (m[t.provider] || 0) + sign * Number(t.amount || 0);
    });
    return m;
  }, [cashless]);

  const submitCashless = () => {
    if (!clAmount || !clName.trim()) return;
    createCashless.mutate({
      shift_id: shift.id,
      direction: clDirection, provider: clProvider,
      amount: clAmount, player_name: clName, reference: clRef,
    });
    setClAmount(0); setClName(""); setClRef("");
  };

  // Expense entry
  const [expCategory, setExpCategory] = useState<string>("other");
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDesc, setExpDesc] = useState("");
  const submitExpense = () => {
    if (!expAmount || !expDesc.trim()) return;
    createExpense.mutate({
      slots_shift_id: shift.id,
      category: expCategory,
      amount: expAmount,
      description: expDesc,
    });
    setExpAmount(0); setExpDesc("");
  };
  const totalSlotsExpenses = useMemo(
    () => slotsExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0),
    [slotsExpenses],
  );

  const isReadyForReview = shift.status === "ready_for_review";


  return (
    <PageShell>
      <PageHeader
        icon={Coins}
        title="Cage Slots"
        subtitle={`Shift ${shift.shift_type.toUpperCase()} · Opened ${fmtDateTime(shift.opened_at)}`}
        date
        context={
          <Badge variant={isReadyForReview ? "default" : "outline"} className="uppercase text-[10px]">
            {shift.status.replace("_", " ")}
          </Badge>
        }
      >
        {shift.status === "open" && (
          <>
            <Button
              onClick={recordMidCheck}
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 border-amber-500/60 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
              disabled={saveCheck.isPending}
            >
              <FileText className="w-3.5 h-3.5" /> Check
            </Button>
            <Button
              onClick={openClosingPreview}
              size="sm"
              className="gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={submit.isPending}
            >
              <Send className="w-3.5 h-3.5" /> Closing
            </Button>
          </>
        )}
        {isReadyForReview && (
          <Button onClick={() => setShowApprove(true)} size="sm" className="gap-1.5 h-8" disabled={approve.isPending}>
            <Save className="w-3.5 h-3.5" /> Close Shift
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => navigate(`/cage-slots/report/${shift.id}`)} className="gap-1.5 h-8">
          <Printer className="w-3.5 h-3.5" /> Report
        </Button>
      </PageHeader>

      {/* Manager review banner — shown after cashier submits for review */}
      {isReadyForReview && (
        <div className="mb-3 rounded-md border-2 border-amber-500/60 bg-amber-500/10 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                Shift Submitted · Awaiting Manager
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cashier has submitted the closing. A manager must authenticate to close this shift.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-3 max-w-md">
                <Stat label="Actual" value={actualCageResult} signed />
                <Stat label="System" value={systemResult} signed />
                <Stat label="Difference" value={difference} signed emphasize />
              </div>
            </div>
            <Button
              onClick={() => setShowApprove(true)}
              size="lg"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold whitespace-nowrap"
              disabled={approve.isPending}
            >
              <Save className="w-5 h-5" /> Close Shift (Manager)
            </Button>
          </div>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
        <SummaryCard label="Opening (TZS)" value={openingTotalTzs} />
        <SummaryCard label="Closing (TZS)" value={closingTotalTzs} />
        <SummaryCard label="Cashless Net" value={cashlessNetTzs} signed />
        <SummaryCard label="Actual Cage Result" value={actualCageResult} signed />
        <SummaryCard label="Difference" value={difference} signed emphasize />
      </div>

      <Tabs defaultValue="closing" className="space-y-2">
        <TabsList>
          <TabsTrigger value="closing">Shift Result</TabsTrigger>
          <TabsTrigger value="cashless">Cashless ({cashless.length})</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({slotsExpenses.length})</TabsTrigger>
        </TabsList>


        <TabsContent value="closing" className="space-y-2">
          {/* Combined: Sys Result + Cards on one compact strip, then full cash grid. */}
          <PageSection title="System Result · Cards">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_2fr] gap-3 items-end">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">System Result (TZS)</p>
                <NumberInput
                  value={systemResultInput}
                  onChange={v => setSystemResultInput(String(v))}
                  onBlur={() => setSystem.mutate({ shift_id: shift.id, system_shift_result: Number(systemResultInput) || 0 })}
                  className="no-spin h-9 w-full text-right font-mono text-base"
                  placeholder="0"
                />
              </div>
              <Stat label={`Cards Open (× TZS ${formatNumberSpaces(cardDepositTzs)})`} value={cards?.opening_card_count ?? 0} />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Cards Closing</p>
                <NumberInput
                  value={closingCards || ""}
                  onChange={v => setClosingCards(Number(v) || 0)}
                  onBlur={() => updateCards.mutate({ shift_id: shift.id, closing_card_count: closingCards })}
                  className="no-spin h-9 w-full text-right font-mono"
                />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Cards Miss</p>
                <p className={`font-mono font-bold text-base ${(cards?.miss_card_count ?? (closingCards - (cards?.opening_card_count ?? 0))) < 0 ? "cms-amount-negative" : ""}`}>
                  {(cards?.miss_card_count ?? (closingCards - (cards?.opening_card_count ?? 0)))} ·&nbsp;
                  <span className="text-muted-foreground text-sm">
                    TZS {formatNumberSpaces(((cards?.miss_card_count ?? (closingCards - (cards?.opening_card_count ?? 0)))) * cardDepositTzs)}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Cashier note (optional)</p>
              <Textarea
                value={cashierNote}
                onChange={e => setCashierNote(e.target.value)}
                className="text-sm"
                rows={2}
                placeholder="Anything the manager should know about this shift…"
              />
            </div>
          </PageSection>

          {/* Same grid as Live Game cage, scaled down ~30% for compactness. */}
          <div className="cms-panel p-3">
            <div style={{ zoom: 0.7 }}>
              <CashCountGrid
                chips={{}}
                onChipsChange={() => { /* slots cage has no chips */ }}
                cash={closingCash}
                onCashChange={(cur, next) => {
                  const prev = closingCash[cur] || {};
                  setClosingCash(c => ({ ...c, [cur]: next }));
                  const denoms = CASH_DENOMS[cur] || [];
                  for (const d of denoms) {
                    if ((next[d] || 0) !== (prev[d] || 0)) {
                      persistClosingCash(cur, d, next[d] || 0);
                    }
                  }
                }}
                banks={closingBanks}
                onBanksChange={setClosingBanks}
                mobile={closingMobile}
                onMobileChange={setClosingMobile}
                rates={rateMap}
                hideChips
              />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Banks &amp; Mobile balances are saved into the next Check (use the Check button at the top).
            </p>
          </div>

          {/* Checks history (was a separate tab) */}
          <PageSection title={`Checks (${checks.length})`}>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground border-b border-border">
                <tr><th className="text-left py-1.5">When</th><th className="text-left">Kind</th><th className="text-right">Total (TZS)</th><th className="text-left">Note</th></tr>
              </thead>
              <tbody>
                {checks.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-3">·</td></tr>}
                {checks.map(c => {
                  const d: any = c.denominations || {};
                  const t: any = d.totals || {};
                  const isOpening = !!(d.is_opening || t.is_opening);
                  const isClosing = !!(d.is_closing || t.is_closing);
                  const isReview = !!(d.is_review || t.is_review);
                  const kind = isOpening ? "Opening" : isClosing ? "Closing" : isReview ? "Review" : "Check";
                  const cls =
                    kind === "Opening" ? "bg-primary/15 text-primary" :
                    kind === "Closing" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" :
                    kind === "Review"  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                                         "bg-muted text-muted-foreground";
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setViewerCheck({ ...(c as any), total: (c as any).total_tzs } as Tables<"cash_counts">)}
                      className="border-b border-border/50 cursor-pointer hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-1.5 font-mono text-[10px] text-muted-foreground">{fmtDateTime(c.created_at)}</td>
                      <td><span className={`cms-chip text-[9px] h-4 px-1.5 uppercase ${cls}`}>{kind}</span></td>
                      <td className="text-right font-mono">{formatNumberSpaces(Number(c.total_tzs))}</td>
                      <td className="text-muted-foreground">{c.note || "·"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </PageSection>
          <CashCheckViewerDialog
            open={!!viewerCheck}
            onOpenChange={(o) => { if (!o) setViewerCheck(null); }}
            check={viewerCheck}
          />
        </TabsContent>

        <TabsContent value="cashless">
          <PageSection title="Cashless Transactions for this Shift">
            {/* Grey per-provider hint: signed net totals already recorded in this shift. */}
            {Object.keys(cashlessByProvider).length > 0 && (
              <div className="mb-2 text-[11px] text-muted-foreground font-mono flex flex-wrap gap-x-3 gap-y-1">
                {(["MPESA","AIRTEL","TIGO","HALOTEL"] as const).map(p => {
                  const v = cashlessByProvider[p];
                  if (!v) return null;
                  return (
                    <span key={p}>
                      {p}: <span className={v < 0 ? "cms-amount-negative" : ""}>{v < 0 ? "−" : ""}{formatNumberSpaces(Math.abs(v))}</span>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3 items-end">
              <select value={clDirection} onChange={e => setClDirection(e.target.value as any)} className="h-9 rounded border border-border bg-background px-2 text-sm">
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </select>
              <select value={clProvider} onChange={e => setClProvider(e.target.value as any)} className="h-9 rounded border border-border bg-background px-2 text-sm">
                <option value="MPESA">MPESA</option>
                <option value="AIRTEL">AIRTEL</option>
                <option value="TIGO">TIGO</option>
                <option value="HALOTEL">HALOTEL</option>
              </select>
              <Input placeholder="Player / name" value={clName} onChange={e => setClName(e.target.value)} className="h-9" />
              <NumberInput placeholder="Amount" value={clAmount || ""} onChange={v => setClAmount(Number(v) || 0)} className="no-spin h-9 text-right font-mono" />
              <Input placeholder="Ref" value={clRef} onChange={e => setClRef(e.target.value)} className="h-9" />
              <Button onClick={submitCashless} size="sm" className="h-9">Add</Button>
            </div>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground border-b border-border">
                <tr><th className="text-left py-1.5">When</th><th>Dir</th><th>Provider</th><th className="text-left">Player</th><th className="text-right">Amount</th><th>Ref</th></tr>
              </thead>
              <tbody>
                {cashless.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-3">·</td></tr>}
                {cashless.map((t: any) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="py-1.5">{fmtDateTime(t.created_at)}</td>
                    <td className="text-center"><Badge variant={t.direction === "IN" ? "default" : "secondary"}>{t.direction}</Badge></td>
                    <td className="text-center">{t.provider}</td>
                    <td>{t.player_name}</td>
                    <td className="text-right font-mono">{formatNumberSpaces(t.amount)}</td>
                    <td className="text-center text-muted-foreground">{t.reference || "·"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PageSection>
        </TabsContent>

        <TabsContent value="transfers">
          <SlotsTransfersForm shiftId={shift.id} />
        </TabsContent>

        <TabsContent value="expenses">
          <PageSection title={`Slots Cage Expenses · Total ${formatNumberSpaces(totalSlotsExpenses)} TZS`}>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr_auto] gap-2 mb-3 items-end">
              <select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="h-9 rounded border border-border bg-background px-2 text-sm">
                <option value="utilities">Utilities</option>
                <option value="maintenance">Maintenance</option>
                <option value="supplies">Supplies</option>
                <option value="salary">Salary</option>
                <option value="other">Other</option>
              </select>
              <NumberInput placeholder="Amount" value={expAmount || ""} onChange={v => setExpAmount(Number(v) || 0)} className="no-spin h-9 text-right font-mono" />
              <Input placeholder="Description" value={expDesc} onChange={e => setExpDesc(e.target.value)} className="h-9" />
              <Button onClick={submitExpense} size="sm" className="h-9 gap-1.5" disabled={createExpense.isPending}>
                <Receipt className="w-3.5 h-3.5" /> Add Expense
              </Button>
            </div>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground border-b border-border">
                <tr><th className="text-left py-1.5">When</th><th className="text-left">Category</th><th className="text-left">Description</th><th className="text-right">Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {slotsExpenses.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-3">·</td></tr>}
                {slotsExpenses.map((e: any) => (
                  <tr key={e.id} className="border-b border-border/50">
                    <td className="py-1.5 font-mono text-[10px] text-muted-foreground">{fmtDateTime(e.created_at)}</td>
                    <td className="uppercase text-[10px]">{e.category}</td>
                    <td>{e.description}</td>
                    <td className="text-right font-mono">{formatNumberSpaces(Number(e.amount))}</td>
                    <td className="text-center">
                      <Badge variant={e.approved ? "default" : "outline"} className="text-[10px]">
                        {e.approved ? "Approved" : "Pending"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PageSection>
        </TabsContent>

      </Tabs>


      {comments.length > 0 && (
        <PageSection title="Comments & Reversals">
          <ul className="space-y-2">
            {comments.map(c => (
              <li key={c.id} className="text-xs border-l-2 border-primary/50 pl-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline" className="text-[10px] uppercase">{c.comment_type.replace("_", " ")}</Badge>
                  <span>{fmtDateTime(c.created_at)}</span>
                </div>
                <p className="text-foreground mt-0.5">{c.comment_text}</p>
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      {/* Closing preview modal — Live Game-style review before submit-for-review */}
      {showClosingPreview && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowClosingPreview(false)}>
          <div className="bg-card border border-border rounded-md shadow-lg p-5 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Closing Preview · Shift {shift.shift_type.toUpperCase()}</h3>
              <Badge variant="outline" className="text-[10px]">REVIEW BEFORE SUBMIT</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <Stat label="Opening (TZS)" value={openingTotalTzs} />
              <Stat label="Closing (TZS)" value={closingTotalTzs} />
              <Stat label="Cash Movement" value={cashMovementTzs} signed />
              <Stat label="Cashless Net" value={cashlessNetTzs} signed />
              <Stat label="System Result" value={systemResult} signed />
              <Stat label="Actual Cage Result" value={actualCageResult} signed />
            </div>

            <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase text-muted-foreground tracking-wider">Difference (Actual − System)</span>
                <span className={`font-mono font-bold text-lg ${difference < 0 ? "cms-amount-negative" : difference > 0 ? "cms-amount-positive" : ""}`}>
                  {difference > 0 ? "+" : ""}{formatNumberSpaces(difference)}
                </span>
              </div>
              {Math.abs(difference) > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  Non-zero difference — manager will need to approve with a comment.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-md border border-border p-2">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Cards</p>
                <p className="font-mono">Open: {cards?.opening_card_count ?? 0} · Close: {closingCards}</p>
              </div>
              <div className="rounded-md border border-border p-2">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Cashless / Expenses</p>
                <p className="font-mono">{cashless.length} cashless · {slotsExpenses.length} expenses</p>
              </div>
            </div>

            {cashierNote && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Cashier note</p>
                <p className="text-xs whitespace-pre-wrap border border-border rounded p-2 bg-muted/30">{cashierNote}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowClosingPreview(false)}>
                <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" /> Back to Edit
              </Button>
              <Button
                size="sm"
                onClick={confirmSubmitForReview}
                disabled={submit.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" /> Submit for Review
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Approve modal */}
      {showApprove && (
        <>
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowApprove(false)}>
            <div className="bg-card border border-border rounded-md shadow-lg p-4 max-w-md w-full space-y-3" onClick={e => e.stopPropagation()}>
              <h3 className="font-semibold">Approve & Close Slots Shift</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="Actual" value={actualCageResult} signed />
                <Stat label="System" value={systemResult} signed />
                <Stat label="Difference" value={difference} signed emphasize />
              </div>
              {needsComment && (
                <div>
                  <p className="text-xs text-destructive font-semibold mb-1">Difference is non-zero — manager comment is required.</p>
                  <Textarea value={managerComment} onChange={e => setManagerComment(e.target.value)} rows={3} placeholder="Reason / explanation…" />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowApprove(false)}>Cancel</Button>
                <ConfirmApproveButton needsComment={needsComment} hasComment={!!managerComment.trim()} onConfirm={doApprove} />
              </div>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
};

const ConfirmApproveButton = ({ needsComment, hasComment, onConfirm }: {
  needsComment: boolean; hasComment: boolean; onConfirm: (managerId: string) => void;
}) => {
  const [show, setShow] = useState(false);
  const disabled = needsComment && !hasComment;
  return (
    <>
      <Button size="sm" disabled={disabled} onClick={() => setShow(true)}>Authorize & Close</Button>
      <ManagerOverrideDialog
        open={show}
        onClose={() => setShow(false)}
        onConfirm={(managerId) => { setShow(false); onConfirm(managerId); }}
        title="Approve Slots Shift"
        description="Manager authentication is required to close this shift."
        actionType="CAGE_SLOTS_CLOSE"
      />
    </>
  );
};

const ClosingCashEditor = ({ currency, values, opening, onChange, onPersist }: {
  currency: string;
  values: Record<number, number>;
  opening: Record<number, number>;
  onChange: (v: Record<number, number>) => void;
  onPersist: (currency: string, denom: number, qty: number) => void;
}) => {
  const denoms = CASH_DENOMS[currency] || [];
  return (
    <div className="space-y-2">
      <CashDenomInput
        values={values}
        onChange={(next) => {
          onChange(next);
          // persist only changed denom
          for (const d of denoms) {
            if ((next[d] || 0) !== (values[d] || 0)) {
              onPersist(currency, d, next[d] || 0);
            }
          }
        }}
        denoms={denoms}
        currency={currency}
      />
      <div className="text-[10px] text-muted-foreground flex items-center justify-between border-t border-border pt-1">
        <span>Opening:</span>
        <span className="font-mono">
          {currency} {formatNumberSpaces(denoms.reduce((s, d) => s + d * (opening[d] || 0), 0))}
        </span>
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, signed, emphasize }: {
  label: string; value: number; signed?: boolean; emphasize?: boolean;
}) => {
  const isNeg = value < 0;
  const colorCls = !signed ? "" : (isNeg ? "cms-amount-negative" : value > 0 ? "cms-amount-positive" : "");
  return (
    <div className={`rounded-md border ${emphasize ? "border-primary/50 bg-primary/5" : "border-border bg-card"} px-3 py-2`}>
      <p className="text-[9px] uppercase text-muted-foreground tracking-wider">{label}</p>
      <p className={`text-base font-mono font-bold ${colorCls}`}>
        {signed && value > 0 ? "+" : ""}{formatNumberSpaces(value)}
      </p>
    </div>
  );
};

const Stat = ({ label, value, signed, emphasize }: { label: string; value: number; signed?: boolean; emphasize?: boolean }) => (
  <div>
    <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
    <p className={`font-mono font-bold ${emphasize ? "text-base" : "text-sm"} ${signed && value < 0 ? "cms-amount-negative" : signed && value > 0 ? "cms-amount-positive" : ""}`}>
      {signed && value > 0 ? "+" : ""}{formatNumberSpaces(value)}
    </p>
  </div>
);

export default ActiveSlotsShiftView;
