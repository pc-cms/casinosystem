import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import PlayerSearch from "@/components/cage/PlayerSearch";
import PlayerInfoCard from "@/components/cage/PlayerInfoCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatNumberSpaces } from "@/lib/currency";
import type { Tables } from "@/integrations/supabase/types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  players: Tables<"players">[];
  tables: Tables<"gaming_tables">[];
  shiftId: string;
  casinoId: string;
  cashierId: string;
};

export default function PromoInDialog({ open, onOpenChange, players, tables, shiftId, casinoId, cashierId }: Props) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ amount: number; breakdown: any[] } | null>(null);

  const player = players.find((p) => p.id === playerId);

  const reset = () => { setPlayerId(null); setAmount(0); setResult(null); };

  const handleRedeem = async () => {
    if (!playerId || amount <= 0) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_promo_fifo", {
      p_player_id: playerId,
      p_casino_id: casinoId,
      p_amount: amount,
      p_cage_id: null as any,
      p_cashier_id: cashierId,
      p_shift_id: shiftId,
      p_payout_type: "chips",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const r = data as any;
    setResult({ amount: r.amount, breakdown: r.breakdown || [] });
    toast.success(`Issued ${formatNumberSpaces(r.amount)} promo chips`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Promo IN · Redeem player credits</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <div>
              <Label>Player</Label>
              <PlayerSearch players={players as any} value={playerId ?? ""} onChange={(id) => setPlayerId(id || null)} />
              {player && <div className="mt-2"><PlayerInfoCard player={player as any} tables={tables} /></div>}
            </div>
            <div>
              <Label>Amount (TZS credits)</Label>
              <NumberInput value={amount} onChange={(v) => setAmount(Number(v) || 0)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Debits FIFO from active promo grants (nearest expiry first). Daily per-casino cap enforced.
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Issued {formatNumberSpaces(result.amount)} credits as chips</p>
            <div className="rounded-md border p-2 max-h-60 overflow-y-auto">
              <p className="text-xs uppercase text-muted-foreground mb-1">FIFO breakdown</p>
              <table className="w-full text-xs">
                <thead><tr><th className="text-left">Grant</th><th className="text-right">Used</th></tr></thead>
                <tbody>
                  {result.breakdown.map((b: any, i: number) => (
                    <tr key={i}><td className="font-mono">{b.grant_id?.slice(0, 8)}…</td><td className="text-right font-mono">{formatNumberSpaces(b.used)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleRedeem} disabled={!playerId || amount <= 0 || busy}>
                {busy ? "Processing…" : "Redeem"}
              </Button>
            </>
          ) : (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
