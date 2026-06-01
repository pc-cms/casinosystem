/**
 * Slots Cash Desk Tips — full page (replaces SlotsTipsCdDialog modal).
 * Two shift sections (Day 13:00–21:10, Evening 21:11–05:00) with IN log and
 * OUT cash-out per bucket. Read-only when shift is not open.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CardSkeleton } from "@/components/LoadingSkeletons";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { Gift, ArrowDownToLine, ArrowUpFromLine, ArrowLeft } from "lucide-react";
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateTime } from "@/lib/format-date";
import { useActiveCageSlotsShift } from "@/hooks/use-cage-slots";
import { useSlotsTipsCd, useCreateSlotsTipsCd } from "@/hooks/use-slots-tips-cd";
import { useSlotsTipsCdPayouts } from "@/hooks/use-slots-tips-cd-payouts";
import SlotsTipsCdPayoutDialog from "@/components/cage-slots/SlotsTipsCdPayoutDialog";
import { tipsBucketOf, TIPS_BUCKET_LABEL, type TipsBucket } from "@/lib/slots-tips-bucket";

const SlotsTipsCdPage = () => {
  const nav = useNavigate();
  const { data: shift, isLoading } = useActiveCageSlotsShift();
  const shiftId = shift?.id;
  const readOnly = !shift || shift.status !== "open";

  const { data: tips = [] } = useSlotsTipsCd(shiftId);
  const { data: payouts = [] } = useSlotsTipsCdPayouts(shiftId);
  const create = useCreateSlotsTipsCd();
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [addToBucket, setAddToBucket] = useState<TipsBucket>(() => tipsBucketOf(new Date().toISOString()));
  const [payoutBucket, setPayoutBucket] = useState<TipsBucket | null>(null);

  useEffect(() => {
    if (!isLoading && !shift) nav("/cage-slots", { replace: true });
  }, [isLoading, shift, nav]);

  const tipsWithBucket = (tips as any[]).map((t) => ({ ...t, bucket: tipsBucketOf(t.created_at) as TipsBucket }));
  const inBy = (b: TipsBucket) =>
    tipsWithBucket.filter((t) => t.bucket === b).reduce((s, t) => s + Number(t.amount || 0), 0);
  const payoutBy = (b: TipsBucket) => (payouts as any[]).find((p) => p.bucket === b) || null;

  const totalIn = inBy("day") + inBy("evening");
  const totalOut = (payouts as any[]).reduce((s, p) => s + Number(p.amount || 0), 0);

  const submit = async () => {
    if (!shiftId) return;
    const amt = Number(amount) || 0;
    if (amt <= 0) return;
    await create.mutateAsync({ shift_id: shiftId, amount: amt, note });
    setAmount("");
    setNote("");
  };

  if (isLoading || !shift) {
    return (
      <PageShell>
        <PageHeader icon={Gift} title="Tips CD · Cash Desk Tips" subtitle="Loading…" />
        <CardSkeleton count={2} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        icon={Gift}
        title="Tips CD · Cash Desk Tips"
        subtitle="Each shift has an IN log (collected tips) and an OUT cash-out (actual payout). Print report includes only IN."
      >
        <Button variant="outline" size="sm" onClick={() => nav("/cage-slots")} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back to Cage Slots
        </Button>
      </PageHeader>

      <div className="space-y-5">
        {!readOnly && (
          <div className="cms-panel p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Add IN entry</p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr_auto] gap-3 items-end">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Shift</p>
                <div className="grid grid-cols-2 gap-1">
                  {(["day", "evening"] as TipsBucket[]).map((b) => (
                    <Button
                      key={b}
                      size="sm"
                      variant={addToBucket === b ? "default" : "outline"}
                      onClick={() => setAddToBucket(b)}
                      className="h-9 text-[11px] uppercase"
                    >
                      {b}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Amount (TZS)</p>
                <NumberInput value={amount} onChange={setAmount} min={0} />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Note (optional)</p>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. dealer pool" />
              </div>
              <Button onClick={submit} disabled={!Number(amount) || create.isPending} size="lg">Add</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Bucket is auto-derived from time of entry; the selector is informational only.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(["day", "evening"] as TipsBucket[]).map((bucket) => {
            const rows = tipsWithBucket.filter((t) => t.bucket === bucket);
            const inTotal = inBy(bucket);
            const paid = payoutBy(bucket);
            const outTotal = paid ? Number(paid.amount || 0) : 0;
            const delta = paid ? outTotal - Number(paid.collected_amount ?? inTotal) : 0;
            return (
              <div key={bucket} className="cms-panel p-0 overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center justify-between">
                  <p className="text-sm font-bold uppercase tracking-wider">{TIPS_BUCKET_LABEL[bucket]}</p>
                  <Gift className="w-4 h-4 text-muted-foreground" />
                </div>

                <div className="grid grid-cols-2 divide-x divide-border">
                  {/* ============ IN column ============ */}
                  <div className="flex flex-col">
                    <div className="px-3 py-2 flex items-center justify-between bg-emerald-500/5 border-b border-border">
                      <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300">
                        <ArrowDownToLine className="w-3.5 h-3.5" /> IN
                      </span>
                      <span className="font-mono text-base font-bold tabular-nums">{formatNumberSpaces(inTotal)}</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <tbody>
                          {rows.length === 0 && (
                            <tr><td colSpan={2} className="text-center text-muted-foreground py-4">·</td></tr>
                          )}
                          {rows.map((t: any) => (
                            <tr key={t.id} className="border-b border-border/50">
                              <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                                {fmtDateTime(t.created_at)}
                                {t.note ? <span className="ml-1 text-muted-foreground/80">· {t.note}</span> : null}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono">{formatNumberSpaces(Number(t.amount))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ============ OUT column ============ */}
                  <div className="flex flex-col">
                    <div className="px-3 py-2 flex items-center justify-between bg-pink-500/5 border-b border-border">
                      <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-pink-700 dark:text-pink-300">
                        <ArrowUpFromLine className="w-3.5 h-3.5" /> OUT
                      </span>
                      <span className="font-mono text-base font-bold tabular-nums">{formatNumberSpaces(outTotal)}</span>
                    </div>
                    <div className="p-4 flex-1 flex flex-col items-center justify-center gap-3 text-center">
                      {paid ? (
                        <>
                          <p className="font-mono font-extrabold text-3xl tabular-nums">
                            {formatNumberSpaces(outTotal)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Collected {formatNumberSpaces(Number(paid.collected_amount ?? inTotal))}
                            {delta !== 0 && (
                              <span className={`ml-1 font-semibold ${delta > 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                                (Δ {delta > 0 ? "+" : ""}{formatNumberSpaces(delta)})
                              </span>
                            )}
                          </p>
                          {paid.note && (
                            <p className="text-[10px] text-muted-foreground italic max-w-full truncate">{paid.note}</p>
                          )}
                          <span className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">Paid out</span>
                        </>
                      ) : readOnly ? (
                        <p className="text-xs text-muted-foreground">Not paid out</p>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPayoutBucket(bucket)}
                          className="h-11 px-3 w-full border-2 border-pink-500/60 text-pink-700 dark:text-pink-300 hover:bg-pink-500/10"
                        >
                          <ArrowUpFromLine className="w-4 h-4 mr-1.5 shrink-0" />
                          <span className="truncate">Cash Out {bucket === "day" ? "Day" : "Evening"}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {(totalIn > 0 || totalOut > 0) && (
          <div className="cms-panel p-3 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                <ArrowDownToLine className="w-3.5 h-3.5" /> Total IN
              </span>
              <span className="font-mono font-bold">{formatNumberSpaces(totalIn)} TZS</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
                <ArrowUpFromLine className="w-3.5 h-3.5" /> Total OUT
              </span>
              <span className="font-mono font-bold">{formatNumberSpaces(totalOut)} TZS</span>
            </div>
          </div>
        )}
      </div>

      {payoutBucket && shiftId && (
        <SlotsTipsCdPayoutDialog
          open={!!payoutBucket}
          onOpenChange={(v) => !v && setPayoutBucket(null)}
          shiftId={shiftId}
          bucket={payoutBucket}
          collectedAmount={inBy(payoutBucket)}
        />
      )}
    </PageShell>
  );
};

export default SlotsTipsCdPage;
