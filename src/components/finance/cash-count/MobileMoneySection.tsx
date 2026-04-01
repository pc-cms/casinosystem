import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumberSpaces, formatInputWithSpaces, parseSpacedNumber } from "@/lib/currency";
import { Smartphone } from "lucide-react";

export const MOBILE_PROVIDERS = ["mpesa", "tigo", "airtel", "halo"] as const;
export type MobileProvider = typeof MOBILE_PROVIDERS[number];

const PROVIDER_LABELS: Record<MobileProvider, string> = {
  mpesa: "M-Pesa",
  tigo: "Tigo Pesa",
  airtel: "Airtel Money",
  halo: "Halo Pesa",
};

export type MobileMoneyState = Record<MobileProvider, number>;

export const emptyMobileMoney = (): MobileMoneyState => ({ mpesa: 0, tigo: 0, airtel: 0, halo: 0 });

export const getMobileTotal = (s: MobileMoneyState) =>
  MOBILE_PROVIDERS.reduce((sum, p) => sum + (s[p] || 0), 0);

export const MobileMoneySection = ({
  state,
  onChange,
}: {
  state: MobileMoneyState;
  onChange: (next: MobileMoneyState) => void;
}) => {
  const total = getMobileTotal(state);

  const handleChange = (provider: MobileProvider, raw: string) => {
    const val = parseSpacedNumber(raw);
    if (val < 0) return;
    onChange({ ...state, [provider]: val });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Smartphone className="w-4 h-4" /> Mobile Money
          </CardTitle>
          <span className="font-mono text-xs font-semibold text-foreground">
            TZS {formatNumberSpaces(total)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {MOBILE_PROVIDERS.map(p => (
            <div key={p} className="border border-border rounded p-2 space-y-1">
              <span className="text-xs font-semibold text-foreground">{PROVIDER_LABELS[p]}</span>
              <input
                type="text"
                className="font-mono text-xs h-7 w-full rounded border border-border bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={state[p] ? formatInputWithSpaces(String(state[p])) : ""}
                onChange={e => handleChange(p, e.target.value)}
                placeholder="0"
                inputMode="numeric"
              />
              {state[p] > 0 && (
                <div className="text-[9px] font-mono text-muted-foreground text-right">
                  TZS {formatNumberSpaces(state[p])}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
