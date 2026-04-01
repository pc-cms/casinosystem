import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumberSpaces, formatInputWithSpaces, parseSpacedNumber, DEFAULT_EXCHANGE_RATES } from "@/lib/currency";
import { Landmark } from "lucide-react";

export const BANK_FIELDS = ["crdb_tzs", "crdb_usd", "nbc_tzs", "nbc_usd"] as const;
export type BankField = typeof BANK_FIELDS[number];

const BANK_LABELS: Record<BankField, string> = {
  crdb_tzs: "CRDB TZS",
  crdb_usd: "CRDB USD",
  nbc_tzs: "NBC TZS",
  nbc_usd: "NBC USD",
};

export type BankState = Record<BankField, number>;

export const emptyBankState = (): BankState => ({ crdb_tzs: 0, crdb_usd: 0, nbc_tzs: 0, nbc_usd: 0 });

const USD_RATE = DEFAULT_EXCHANGE_RATES["USD"] || 2500;

export const getBankTotalTzs = (s: BankState) =>
  (s.crdb_tzs || 0) + (s.crdb_usd || 0) * USD_RATE + (s.nbc_tzs || 0) + (s.nbc_usd || 0) * USD_RATE;

const isUsd = (f: BankField) => f.endsWith("_usd");

export const BankSection = ({
  state,
  onChange,
}: {
  state: BankState;
  onChange: (next: BankState) => void;
}) => {
  const totalTzs = getBankTotalTzs(state);

  const handleChange = (field: BankField, raw: string) => {
    const val = parseSpacedNumber(raw);
    if (val < 0) return;
    onChange({ ...state, [field]: val });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Landmark className="w-4 h-4" /> Bank Accounts
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground">USD ×{formatNumberSpaces(USD_RATE)}</span>
            <span className="font-mono text-xs font-semibold text-foreground">
              TZS {formatNumberSpaces(totalTzs)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BANK_FIELDS.map(f => {
            const usd = isUsd(f);
            const tzsEquiv = usd ? (state[f] || 0) * USD_RATE : 0;
            return (
              <div key={f} className="border border-border rounded p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{BANK_LABELS[f]}</span>
                  {usd && <span className="text-[8px] text-muted-foreground">USD</span>}
                </div>
                <input
                  type="text"
                  className="font-mono text-xs h-7 w-full rounded border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={state[f] ? formatInputWithSpaces(String(state[f])) : ""}
                  onChange={e => handleChange(f, e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                />
                {usd && state[f] > 0 && (
                  <div className="text-[9px] font-mono text-muted-foreground text-right">
                    ≈TZS {formatNumberSpaces(tzsEquiv)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
