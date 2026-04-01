import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInitializeWallets, WALLET_LABELS, WalletType } from "@/hooks/use-finance";
import { formatInputWithSpaces, parseSpacedNumber } from "@/lib/currency";
import { ShieldCheck } from "lucide-react";

const WALLET_TYPES: WalletType[] = ["main_cash", "office_safe", "rent_reserve", "license_reserve", "tax_reserve", "other_reserve"];

export const WalletSetup = () => {
  const [balances, setBalances] = useState<Record<string, string>>({});
  const init = useInitializeWallets();

  const handleSubmit = () => {
    const parsed: Partial<Record<WalletType, number>> = {};
    WALLET_TYPES.forEach(wt => {
      const val = parseSpacedNumber(balances[wt] || "0");
      if (val > 0) parsed[wt] = val;
    });
    init.mutate(parsed);
  };

  return (
    <Card className="max-w-lg mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Initialize Wallets
        </CardTitle>
        <p className="text-sm text-muted-foreground">Set starting balances for each wallet. You can leave any at 0.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {WALLET_TYPES.map(wt => (
          <div key={wt} className="flex items-center gap-3">
            <label className="text-sm w-32 text-foreground">{WALLET_LABELS[wt]}</label>
            <Input
              className="font-mono"
              placeholder="0"
              value={balances[wt] || ""}
              onChange={e => setBalances(prev => ({ ...prev, [wt]: formatInputWithSpaces(e.target.value) }))}
            />
          </div>
        ))}
        <Button onClick={handleSubmit} disabled={init.isPending} className="w-full mt-4">
          {init.isPending ? "Initializing..." : "Initialize Wallets"}
        </Button>
      </CardContent>
    </Card>
  );
};
