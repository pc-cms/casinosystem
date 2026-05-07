import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveShift, useCloseShift } from "@/hooks/use-shift";
import { useTransactions, useExpenses, useGamingTables } from "@/hooks/use-casino-data";
import { useCageTransfers } from "@/hooks/use-cage-transfers";
import { useEffectiveBusinessDate } from "@/hooks/use-business-day-closure";
import { getBusinessDate } from "@/lib/business-day";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Square } from "lucide-react";
import CloseShiftDialog from "@/components/cage/CloseShiftDialog";

/**
 * Close Shift route. Two-step in-page flow lives inside CloseShiftDialog
 * (entry → manager review → manager password). No modal: it renders inline
 * so cancel/back are real navigation, not a dialog dismissal.
 */
const CloseShiftPage = () => {
  const nav = useNavigate();
  const { data: shift, isLoading } = useActiveShift();
  const { data: tables = [] } = useGamingTables();
  const { data: serverDate } = useEffectiveBusinessDate();
  const businessDate = serverDate || getBusinessDate();
  const { data: transactions = [] } = useTransactions(businessDate);
  const { data: expenses = [] } = useExpenses(businessDate);
  const { data: cageTransfers = [] } = useCageTransfers(shift?.id);
  const closeShift = useCloseShift();

  useEffect(() => {
    if (!isLoading && !shift) nav("/cage", { replace: true });
  }, [isLoading, shift, nav]);

  const isInTx = (t: string) => t === "buy" || t === "in";
  const isOutTx = (t: string) => t === "cashout" || t === "out";

  const data = useMemo(() => {
    if (!shift) return null;
    const sTx = transactions.filter(t => t.shift_id === shift.id);
    const sEx = expenses.filter(e => e.shift_id === shift.id);
    const totalIns = sTx.filter(t => isInTx(t.type)).reduce((s, t) => s + Number(t.amount), 0);
    const totalOuts = sTx.filter(t => isOutTx(t.type)).reduce((s, t) => s + Number(t.amount), 0);
    const totalExpenses = sEx.reduce((s, e) => s + Number(e.amount), 0);
    const addFloat = cageTransfers.filter(t => t.transfer_type === "add_float").reduce((s, t) => s + Number(t.amount), 0);
    const collection = cageTransfers.filter(t => t.transfer_type === "collection").reduce((s, t) => s + Number(t.amount), 0);
    const slotsOut = cageTransfers.filter(t => t.transfer_type === "slots_out").reduce((s, t) => s + Number(t.amount), 0);
    const slotsIn = cageTransfers.filter(t => t.transfer_type === "slots_in").reduce((s, t) => s + Number(t.amount), 0);
    const of = shift.opening_float as Record<string, unknown> | null;
    const totals = of?.totals as Record<string, number> | undefined;
    const openingFloat = totals?.total_tzs || 0;
    const expectedCash = openingFloat + totalIns + addFloat + slotsIn - totalOuts - collection - slotsOut - totalExpenses;
    const cashResult = totalIns - totalOuts;
    return {
      expectedCash, cashResult, totalIns, totalOuts, totalExpenses,
      external: addFloat + slotsIn - collection - slotsOut, openingFloat,
    };
  }, [shift, transactions, expenses, cageTransfers]);

  if (isLoading || !shift || !data) {
    return (
      <PageShell>
        <PageHeader icon={Square} title="Close Shift" subtitle="Loading…" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        icon={Square}
        title="Close Shift"
        subtitle="Cashier enters the closing cash desk · Manager confirms with password"
      />
      <CloseShiftDialog
        open={true}
        onClose={() => nav("/cage")}
        shift={shift}
        expectedBalance={data.expectedCash}
        cashResult={data.cashResult}
        totalBuyIns={data.totalIns}
        totalCashouts={data.totalOuts}
        totalExpenses={data.totalExpenses}
        externalCashMovement={data.external}
        openingFloat={data.openingFloat}
        tables={tables}
        loading={closeShift.isPending}
        onConfirm={(d) => {
          closeShift.mutate({
            shift_id: shift.id,
            closing_count: d.closingCount,
            closing_cash: d.closingCash,
            notes: d.notes,
            cash_result: d.cashResult,
            miss_total: d.missTotal,
            shift_result: d.shiftResult,
          }, { onSuccess: () => nav("/cage") });
        }}
      />
    </PageShell>
  );
};

export default CloseShiftPage;
