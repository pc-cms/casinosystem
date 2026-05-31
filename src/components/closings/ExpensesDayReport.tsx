/**
 * Printable expenses report for a single business day.
 * A4 portrait, single page, monospaced columns. Lives inside PrintPortal.
 */
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDate, fmtDateTime } from "@/lib/format-date";

interface ExpenseRow {
  id: string;
  created_at: string;
  source?: string | null;
  cage_type?: string | null;
  category?: string | null;
  category_code?: string | null;
  amount: number;
  description?: string | null;
  player_name?: string | null;
  players?: { first_name?: string | null; last_name?: string | null } | null;
  approved?: boolean | null;
}

interface Props {
  casinoName: string;
  businessDate: string;
  rows: ExpenseRow[];
}

const labelSource = (r: ExpenseRow): string => {
  const s = String(r.source || "").toLowerCase();
  if (s === "office") return "OFFICE";
  if (s === "slots") return "SLOTS";
  if (r.cage_type === "slots") return "SLOTS";
  return "LIVE";
};

const ExpensesDayReport = ({ casinoName, businessDate, rows }: Props) => {
  const totals = rows.reduce(
    (acc, r) => {
      const src = labelSource(r);
      const amt = Number(r.amount || 0);
      acc.total += amt;
      acc[src] = (acc[src] || 0) + amt;
      return acc;
    },
    { total: 0 } as Record<string, number>,
  );

  return (
    <div
      className="expenses-print-area bg-white text-black p-3"
      style={{ width: "194mm", minHeight: "281mm", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
    >
      <div className="text-center mb-3">
        <div className="text-lg font-bold">{casinoName}</div>
        <div className="text-sm">Expenses · {fmtDate(businessDate)}</div>
      </div>

      <table className="w-full text-[10pt] border-collapse">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="text-left py-1 pr-1">Time</th>
            <th className="text-left pr-1">Source</th>
            <th className="text-left pr-1">Category</th>
            <th className="text-right pr-1">Amount</th>
            <th className="text-left pr-1">Description</th>
            <th className="text-left pr-1">Player</th>
            <th className="text-center">Apr</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={7} className="text-center py-4 text-gray-500">No expenses</td></tr>
          ) : rows.map(r => {
            const player = r.players ? `${r.players.first_name || ""} ${r.players.last_name || ""}`.trim() : r.player_name || "";
            return (
              <tr key={r.id} className="border-b border-gray-300 align-top">
                <td className="py-0.5 pr-1 whitespace-nowrap">{fmtDateTime(r.created_at).slice(-5)}</td>
                <td className="pr-1 font-bold">{labelSource(r)}</td>
                <td className="pr-1 uppercase">{r.category_code || r.category}</td>
                <td className="pr-1 text-right">{formatNumberSpaces(Number(r.amount || 0))}</td>
                <td className="pr-1">{r.description || ""}</td>
                <td className="pr-1">{player || "—"}</td>
                <td className="text-center">{r.approved ? "✓" : ""}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-bold">
            <td colSpan={3} className="pt-1 pr-1 text-right">TOTAL</td>
            <td className="pt-1 pr-1 text-right">{formatNumberSpaces(totals.total)}</td>
            <td colSpan={3} />
          </tr>
          {(["LIVE", "SLOTS", "OFFICE"] as const).map(k =>
            totals[k] ? (
              <tr key={k} className="text-[9pt]">
                <td colSpan={3} className="pr-1 text-right">{k}</td>
                <td className="pr-1 text-right">{formatNumberSpaces(totals[k])}</td>
                <td colSpan={3} />
              </tr>
            ) : null,
          )}
        </tfoot>
      </table>

      <div className="grid grid-cols-2 gap-6 mt-12 text-xs">
        <div><p className="border-t border-black pt-1 text-center">Cashier Signature</p></div>
        <div><p className="border-t border-black pt-1 text-center">Manager Signature</p></div>
      </div>
    </div>
  );
};

export default ExpensesDayReport;
