/**
 * SlotsConsolidatedReport — printable A4 layout matching the paper
 * "ACE Slots Consolidating Cash Desk Report". No PP block.
 *
 * Pure presentational component — pass aggregated numbers in props.
 */
import { formatNumberSpaces } from "@/lib/currency";
import { fmtDateOnly } from "@/lib/format-date";

const CURRENCIES = ["TZS", "USD", "EUR", "GBP", "KES"] as const;
const PROVIDERS: Array<{ key: string; label: string }> = [
  { key: "MPESA",   label: "M Pesa" },
  { key: "TIGO",    label: "T Pesa" },
  { key: "HALOTEL", label: "H Pesa" },
  { key: "AIRTEL",  label: "Airtel Money" },
];

export type SlotsConsolidatedProps = {
  casinoName: string;
  businessDate: string;
  shiftType: string;                         // "day" | "night"
  cardsOpener: number;
  cardsCloser: number | null;
  systemShiftResult: number;
  /** Per-currency native amounts (NOT TZS-converted). */
  openerByCurrency: Record<string, number>;  // {TZS, USD, EUR, GBP, KES, OTHER_TZS}
  closerByCurrency: Record<string, number>;
  openerCashTotalTzs: number;
  closerCashTotalTzs: number;
  openerCashlessByProvider: Record<string, number>;   // {MPESA, TIGO, HALOTEL, AIRTEL}
  closerCashlessByProvider: Record<string, number>;
  openerCashlessTotalTzs: number;
  closerCashlessTotalTzs: number;
  cashFlowFill: number;          // Ace Fill (in)
  cashFlowCredit: number;        // Collection (out)
  cashDeskCardsFill: number;     // optional
  cashDeskCardsCredit: number;   // optional
  missCards: number;             // count units, negative possible
  casinoExpenses: number;
  tipsCollection: number;
  aceBalance: number;
  /** Per-provider IN / OUT transaction totals for the shift. */
  cashlessDepositByProvider: Record<string, number>;
  cashlessWithdrawByProvider: Record<string, number>;
};

const Cell = ({ value, align = "right", emphasize = false }: { value: number | string; align?: "left" | "right" | "center"; emphasize?: boolean }) => {
  const display =
    typeof value === "number"
      ? (value === 0 ? "" : formatNumberSpaces(value))
      : value;
  return (
    <td className={`border border-black px-1.5 py-0.5 ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${emphasize ? "font-bold bg-gray-200" : ""}`}>
      {display}
    </td>
  );
};

const Row = ({ label, value, bold }: { label: string; value: number | string; bold?: boolean }) => (
  <tr>
    <td className={`border border-black px-1.5 py-0.5 ${bold ? "font-semibold bg-gray-100" : ""}`}>{label}</td>
    <Cell value={value} emphasize={bold} />
  </tr>
);

const SlotsConsolidatedReport = ({
  casinoName, businessDate, shiftType,
  cardsOpener, cardsCloser, systemShiftResult,
  openerByCurrency, closerByCurrency, openerCashTotalTzs, closerCashTotalTzs,
  openerCashlessByProvider, closerCashlessByProvider, openerCashlessTotalTzs, closerCashlessTotalTzs,
  cashFlowFill, cashFlowCredit, cashDeskCardsFill, cashDeskCardsCredit,
  missCards, casinoExpenses, tipsCollection, aceBalance,
  cashlessDepositByProvider, cashlessWithdrawByProvider,
}: SlotsConsolidatedProps) => {
  const shiftLabel = shiftType.toUpperCase() === "DAY" ? "Day Shift" : "Night Shift";
  const depositTotal = Object.values(cashlessDepositByProvider).reduce((s, v) => s + Number(v || 0), 0);
  const withdrawTotal = Object.values(cashlessWithdrawByProvider).reduce((s, v) => s + Number(v || 0), 0);
  const openerTotal = openerCashTotalTzs + openerCashlessTotalTzs;
  const closerTotal = closerCashTotalTzs + closerCashlessTotalTzs;

  return (
    <div className="bg-white text-black p-4" style={{ fontFamily: "Arial, sans-serif", fontSize: "11px", width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
      {/* ============ TITLE ROW ============ */}
      <table className="w-full border-collapse mb-1">
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1 font-bold text-sm" colSpan={4}>
              {casinoName} ACE Slots Consolidating Cash Desk Report
            </td>
            <td className="border border-black px-2 py-1 font-semibold text-center w-24">Date</td>
            <td className="border border-black px-2 py-1 text-center w-32">{fmtDateOnly(businessDate)}</td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1 font-semibold w-24">Cards Opener</td>
            <td className="border border-black px-2 py-1 text-center w-16 font-bold">{cardsOpener}</td>
            <td className="border border-black px-2 py-1 font-semibold w-24">Cards Closer</td>
            <td className="border border-black px-2 py-1 text-center w-16 font-bold">{cardsCloser ?? ""}</td>
            <td className="border border-black px-2 py-1 font-semibold text-center">Shift</td>
            <td className="border border-black px-2 py-1 text-center font-bold">{shiftLabel}</td>
          </tr>
        </tbody>
      </table>

      {/* ============ CASH FLOW: OPENER | CLOSER ============ */}
      <div className="grid grid-cols-2 gap-1 mb-1">
        {/* OPENER */}
        <table className="w-full border-collapse">
          <thead>
            <tr><th colSpan={2} className="border border-black bg-gray-200 px-2 py-1 text-left">Cash Flow Opener</th></tr>
          </thead>
          <tbody>
            {CURRENCIES.map(c => <Row key={c} label={c} value={Number(openerByCurrency[c] || 0)} />)}
            <Row label="Other in TZS" value={Number(openerByCurrency.OTHER_TZS || 0)} />
            <Row label="Total Cash" value={openerCashTotalTzs} bold />
            {PROVIDERS.map(p => <Row key={p.key} label={p.label} value={Number(openerCashlessByProvider[p.key] || 0)} />)}
            <Row label="Total Cashless" value={openerCashlessTotalTzs} bold />
          </tbody>
          <tfoot>
            <tr>
              <td className="border border-black bg-gray-300 px-2 py-1 font-bold">Total Opener</td>
              <td className="border border-black bg-gray-300 px-2 py-1 text-right font-bold">{formatNumberSpaces(openerTotal)}</td>
            </tr>
          </tfoot>
        </table>

        {/* CLOSER */}
        <table className="w-full border-collapse">
          <thead>
            <tr><th colSpan={2} className="border border-black bg-gray-200 px-2 py-1 text-left">Cash Flow Closer</th></tr>
          </thead>
          <tbody>
            {CURRENCIES.map(c => <Row key={c} label={c} value={Number(closerByCurrency[c] || 0)} />)}
            <Row label="Other in TZS" value={Number(closerByCurrency.OTHER_TZS || 0)} />
            <Row label="Total Cash" value={closerCashTotalTzs} bold />
            {PROVIDERS.map(p => <Row key={p.key} label={p.label} value={Number(closerCashlessByProvider[p.key] || 0)} />)}
            <Row label="Total Cashless" value={closerCashlessTotalTzs} bold />
          </tbody>
          <tfoot>
            <tr>
              <td className="border border-black bg-gray-300 px-2 py-1 font-bold">Total Closer</td>
              <td className="border border-black bg-gray-300 px-2 py-1 text-right font-bold">{formatNumberSpaces(closerTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ============ RIGHT METRICS / SYSTEM RESULT ============ */}
      <table className="w-full border-collapse mb-1">
        <tbody>
          <tr>
            <td className="border border-black bg-gray-200 px-2 py-1 font-semibold w-1/3">System Shift Result</td>
            <td className="border border-black px-2 py-1 text-right font-bold">{formatNumberSpaces(systemShiftResult)}</td>
            <td className="border border-black bg-gray-200 px-2 py-1 font-semibold w-1/4">Casino Expenses</td>
            <td className="border border-black px-2 py-1 text-right">{formatNumberSpaces(casinoExpenses)}</td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1">Cash Flow FILL</td>
            <td className="border border-black px-2 py-1 text-right">{cashFlowFill ? formatNumberSpaces(cashFlowFill) : ""}</td>
            <td className="border border-black px-2 py-1">Tips Collection</td>
            <td className="border border-black px-2 py-1 text-right">{tipsCollection ? formatNumberSpaces(tipsCollection) : ""}</td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1">Cash Flow CREDIT</td>
            <td className="border border-black px-2 py-1 text-right">{cashFlowCredit ? formatNumberSpaces(cashFlowCredit) : ""}</td>
            <td className="border border-black px-2 py-1">Miss Cards</td>
            <td className="border border-black px-2 py-1 text-right">{missCards !== 0 ? missCards : ""}</td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1">Cash Desk Cards FILL</td>
            <td className="border border-black px-2 py-1 text-right">{cashDeskCardsFill ? formatNumberSpaces(cashDeskCardsFill) : ""}</td>
            <td className="border border-black bg-gray-200 px-2 py-1 font-semibold">ACE Balance</td>
            <td className="border border-black px-2 py-1 text-right font-bold">{formatNumberSpaces(aceBalance)}</td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1">Cash Desk Cards CREDIT</td>
            <td className="border border-black px-2 py-1 text-right">{cashDeskCardsCredit ? formatNumberSpaces(cashDeskCardsCredit) : ""}</td>
            <td className="border border-black px-2 py-1" colSpan={2}></td>
          </tr>
        </tbody>
      </table>

      {/* ============ CASH LESS SHIFT TRANSACTIONS ============ */}
      <table className="w-full border-collapse mb-1">
        <thead>
          <tr><th colSpan={3} className="border border-black bg-gray-200 px-2 py-1 text-left">Cash Less Shift Transactions</th></tr>
          <tr>
            <th className="border border-black px-2 py-1 text-left w-1/3">Provider</th>
            <th className="border border-black px-2 py-1 text-right">Cash Less Deposit</th>
            <th className="border border-black px-2 py-1 text-right">Cash Less Withdraw</th>
          </tr>
        </thead>
        <tbody>
          {PROVIDERS.map(p => (
            <tr key={p.key}>
              <td className="border border-black px-2 py-1">{p.label}</td>
              <td className="border border-black px-2 py-1 text-right">
                {Number(cashlessDepositByProvider[p.key] || 0) ? formatNumberSpaces(Number(cashlessDepositByProvider[p.key])) : ""}
              </td>
              <td className="border border-black px-2 py-1 text-right">
                {Number(cashlessWithdrawByProvider[p.key] || 0) ? formatNumberSpaces(Number(cashlessWithdrawByProvider[p.key])) : ""}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border border-black px-2 py-1 font-bold bg-gray-100">Total</td>
            <td className="border border-black px-2 py-1 text-right font-bold bg-gray-100">{formatNumberSpaces(depositTotal)}</td>
            <td className="border border-black px-2 py-1 text-right font-bold bg-gray-100">{formatNumberSpaces(withdrawTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* ============ SIGNATURES ============ */}
      <table className="w-full border-collapse mt-6">
        <tbody>
          <tr>
            <td className="px-2 py-1 w-1/2">
              <div className="font-semibold mb-1">Closing Shift Cashier:</div>
              <div>Name: ____________________________</div>
              <div className="mt-3">Signature: ________________________</div>
            </td>
            <td className="px-2 py-1 w-1/2">
              <div className="font-semibold mb-1">Closing Shift Manager:</div>
              <div>Name: ____________________________</div>
              <div className="mt-3">Signature: ________________________</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default SlotsConsolidatedReport;
