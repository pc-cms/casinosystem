/**
 * ChipMovementReport — printable chips opening + closing report.
 *
 * Mirrors the legacy paper form: per-denomination grids for
 *   · Cash Desk Chips Opener
 *   · Opening Chips Diff (manual edits to opening chips)
 *   · Cash Desk Float Fill (chips received into cage during shift)
 *   · Cash Desk Float Credit (chips issued out of cage during shift)
 *   · Miss Chips
 *   · Cash Desk Chips Close
 *
 * Self-contained: fetches cage_transfers chips JSONB for the shift to compute
 * Float Fill / Credit per denomination. Designed to print as a second A4 page
 * after ShiftClosingReport.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CHIP_DENOMS, formatNumberSpaces } from "@/lib/currency";
import { useChipColors, resolveChipColor } from "@/hooks/use-chip-colors";
import { fmtDate } from "@/lib/format-date";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  shift: Tables<"shifts">;
  openingChips: Record<number, number>;
  /** Manual diff applied to opening chips (denom -> qty), if any */
  openingDiff?: Record<number, number>;
  closingChips: Record<number, number>;
  missPerDenom: Record<number, number>;
  businessDate: string;
  casinoName?: string;
  cashierName?: string;
  managerName?: string;
}

const ChipMovementReport = ({
  shift, openingChips, openingDiff = {}, closingChips, missPerDenom,
  businessDate, casinoName = "Casino", cashierName, managerName,
}: Props) => {
  const [fillByDenom, setFillByDenom] = useState<Record<number, number>>({});
  const [creditByDenom, setCreditByDenom] = useState<Record<number, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!shift?.id) return;
      const { data } = await supabase
        .from("cage_transfers")
        .select("transfer_type, chips")
        .eq("shift_id", shift.id)
        .in("transfer_type", ["fill", "credit"]);
      if (cancelled) return;
      const fill: Record<number, number> = {};
      const credit: Record<number, number> = {};
      (data || []).forEach((r: any) => {
        const target = r.transfer_type === "fill" ? fill : credit;
        const chips = (r.chips || {}) as Record<string, number>;
        Object.entries(chips).forEach(([d, q]) => {
          const dn = Number(d);
          target[dn] = (target[dn] || 0) + (Number(q) || 0);
        });
      });
      setFillByDenom(fill);
      setCreditByDenom(credit);
    })();
    return () => { cancelled = true; };
  }, [shift?.id]);

  const total = (m: Record<number, number>) =>
    CHIP_DENOMS.reduce((s, d) => s + d * (m[d] || 0), 0);

  const totals = useMemo(() => ({
    opener: total(openingChips),
    diff: total(openingDiff),
    fill: total(fillByDenom),
    credit: total(creditByDenom),
    miss: total(missPerDenom),
    close: total(closingChips),
  }), [openingChips, openingDiff, fillByDenom, creditByDenom, missPerDenom, closingChips]);

  return (
    <div id="chip-print-area" className="bg-white text-black p-6 font-sans text-[11px] leading-snug print:break-before-page">
      {/* Header */}
      <div className="grid grid-cols-3 gap-4 border-b-2 border-black pb-1.5 mb-3">
        <h1 className="text-base font-bold">{casinoName} — Chips Movement Report</h1>
        <div className="text-center">
          <span className="font-semibold mr-2">Date</span>
          <span className="border-b border-black px-2">{fmtDate(businessDate)}</span>
        </div>
        <div className="text-right">
          <span className="font-semibold mr-2">Cashier</span>
          <span className="border-b border-black px-2 uppercase">{cashierName || ""}</span>
        </div>
      </div>

      {/* Opening row: Opener | Diff | Float Fill */}
      <p className="font-semibold border-b border-black mb-2">Chips Opening Report</p>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <DenomTable title="Cash Desk Chips Opener" data={openingChips} total={totals.opener} />
        <DenomTable title="Opening Chips Diff" data={openingDiff} total={totals.diff} signed />
        <DenomTable title="Cash Desk Float Fill" data={fillByDenom} total={totals.fill} />
      </div>

      {/* Closing row: Float Credit | Miss | Close */}
      <p className="font-semibold border-b border-black mt-3 mb-2">Chips Closing Report</p>
      <div className="grid grid-cols-3 gap-4">
        <DenomTable title="Cash Desk Float Credit" data={creditByDenom} total={totals.credit} />
        <DenomTable title="Miss Chips" data={missPerDenom} total={totals.miss} signed />
        <DenomTable title="Cash Desk Chips Close" data={closingChips} total={totals.close} />
      </div>
      {/* Signatures intentionally omitted — they already appear on page 1
          (ShiftClosingReport). Repeating them here pushes content to page 3. */}
    </div>
  );
};

const DenomTable = ({ title, data, total, signed }: {
  title: string;
  data: Record<number, number>;
  total: number;
  signed?: boolean;
}) => {
  const { data: chipColorOverrides } = useChipColors();
  const fmtQty = (q: number) => {
    if (!q) return "";
    return signed && q !== 0 ? `${q > 0 ? "+" : ""}${q}` : String(q);
  };
  const fmtVal = (v: number) => {
    if (!v) return "";
    return signed && v !== 0 ? `${v > 0 ? "+" : "-"}${formatNumberSpaces(Math.abs(v))}` : formatNumberSpaces(v);
  };
  const fmtTotal = (v: number) => {
    if (v === 0) return "0";
    return v > 0 ? formatNumberSpaces(v) : `-${formatNumberSpaces(Math.abs(v))}`;
  };
  return (
    <div>
      <p className="font-semibold text-center border border-black bg-gray-100 py-0.5 text-[11px]">{title}</p>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-black px-1 py-0.5 text-left font-semibold">Den</th>
            <th className="border border-black px-1 py-0.5 text-right font-semibold">Qunnt</th>
            <th className="border border-black px-1 py-0.5 text-right font-semibold">Value</th>
          </tr>
        </thead>
        <tbody>
          {CHIP_DENOMS.map(d => {
            const q = data[d] || 0;
            const v = q * d;
            const c = resolveChipColor(d, chipColorOverrides);
            return (
              <tr key={d}>
                <td className="border border-black px-1 py-0.5 tabular-nums">
                  <span
                    className="inline-block rounded-full border border-black px-1.5 py-0 text-[9px] font-bold tabular-nums leading-tight"
                    style={{ background: c.bg, color: c.text, borderColor: c.edge, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as any}
                  >
                    {formatNumberSpaces(d)}
                  </span>
                </td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{fmtQty(q)}</td>
                <td className="border border-black px-1 py-0.5 text-right tabular-nums">{fmtVal(v)}</td>
              </tr>
            );
          })}
          <tr className="bg-gray-100 font-bold">
            <td className="border border-black px-1 py-0.5">Total</td>
            <td className="border border-black px-1 py-0.5" />
            <td className="border border-black px-1 py-0.5 text-right tabular-nums">{fmtTotal(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ChipMovementReport;
