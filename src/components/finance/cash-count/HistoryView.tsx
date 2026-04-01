import { Card, CardContent } from "@/components/ui/card";
import { WALLET_LABELS, WalletType } from "@/hooks/use-finance";
import { formatNumberSpaces } from "@/lib/currency";
import { format } from "date-fns";

const EXTRA_LABELS: Record<string, string> = {
  cage_slot: "Cage Slot",
  cage_table: "Cage Table",
  mobile_money: "Mobile Money",
  bank_account: "Bank Accounts",
};

const getLabel = (wt: string) => WALLET_LABELS[wt as WalletType] || EXTRA_LABELS[wt] || wt;

export const HistoryView = ({ history }: { history: any[] }) => {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No cash counts recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      {history.map((snap: any) => (
        <Card key={snap.id}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">
                {format(new Date(snap.created_at), "dd MMM yyyy HH:mm")} · {getLabel(snap.wallet_type)} · {snap.currency}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Expected</span>
                <p className="font-mono font-semibold">TZS {formatNumberSpaces(snap.expected_balance)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Physical</span>
                <p className="font-mono font-semibold">TZS {formatNumberSpaces(snap.physical_total_tzs)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Discrepancy</span>
                <p className={`font-mono font-semibold ${snap.discrepancy === 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {snap.discrepancy > 0 ? "+" : ""}{formatNumberSpaces(snap.discrepancy)}
                </p>
              </div>
            </div>
            {snap.note && <p className="text-[10px] text-muted-foreground mt-1">{snap.note}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
