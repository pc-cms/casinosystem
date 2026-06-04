import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PlayerSearch from "@/components/cage/PlayerSearch";
import PlayerInfoCard from "@/components/cage/PlayerInfoCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatNumberSpaces } from "@/lib/currency";
import type { Tables } from "@/integrations/supabase/types";
import { QrCode } from "lucide-react";

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
  const [mode, setMode] = useState<"search" | "qr">("search");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState("");
  const [qrPlayer, setQrPlayer] = useState<any>(null);
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ amount: number; breakdown: any[]; player?: any } | null>(null);

  const player = players.find((p) => p.id === playerId);

  const reset = () => { setPlayerId(null); setQrToken(""); setQrPlayer(null); setAmount(0); setResult(null); setMode("search"); };

  useEffect(() => { if (!open) reset(); }, [open]);

  const handleRedeemSearch = async () => {
    if (!playerId || amount <= 0) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_promo_fifo", {
      p_player_id: playerId, p_casino_id: casinoId, p_amount: amount,
      p_cage_id: null as any, p_cashier_id: cashierId, p_shift_id: shiftId, p_payout_type: "chips",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    setResult({ amount: r.amount, breakdown: r.breakdown || [] });
    toast.success(`Issued ${formatNumberSpaces(r.amount)} promo chips`);
  };

  const handleRedeemQr = async () => {
    if (!qrToken.trim() || amount <= 0) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("cashier-redeem-by-qr", {
        body: { qr_token: qrToken.trim(), amount, casino_id: casinoId, cage_id: null, shift_id: shiftId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const r = (data as any).result;
      setResult({ amount: r.amount, breakdown: r.breakdown || [], player: (data as any).player });
      toast.success(`Issued ${formatNumberSpaces(r.amount)} promo chips`);
    } catch (e: any) {
      toast.error(e.message || "qr_redeem_failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Promo IN · Redeem player credits</DialogTitle>
        </DialogHeader>

        {!result ? (
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="search">Player search</TabsTrigger>
              <TabsTrigger value="qr"><QrCode className="w-3.5 h-3.5 mr-1" /> Scan QR</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-3">
              <div>
                <Label>Player</Label>
                <PlayerSearch players={players as any} value={playerId ?? ""} onChange={(id) => setPlayerId(id || null)} />
                {player && <div className="mt-2"><PlayerInfoCard player={player as any} tables={tables} /></div>}
              </div>
              <div>
                <Label>Amount (TZS credits)</Label>
                <NumberInput value={amount} onChange={(v) => setAmount(Number(v) || 0)} />
              </div>
              <p className="text-xs text-muted-foreground">FIFO from active grants (nearest expiry first). Daily per-casino cap enforced.</p>
            </TabsContent>

            <TabsContent value="qr" className="space-y-3">
              <div>
                <Label>Player QR token</Label>
                <Input
                  autoFocus
                  value={qrToken}
                  onChange={(e) => setQrToken(e.target.value)}
                  placeholder="Scan / paste token from player's Premier Club app"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Player shows QR in their Wallet. Use any phone scanner that fills the input, or paste the decoded text.
                </p>
              </div>
              <div>
                <Label>Amount (TZS credits)</Label>
                <NumberInput value={amount} onChange={(v) => setAmount(Number(v) || 0)} />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Issued {formatNumberSpaces(result.amount)} credits as chips</p>
            {result.player && (
              <p className="text-xs text-muted-foreground">For {result.player.first_name} {result.player.last_name}</p>
            )}
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
              {mode === "search" ? (
                <Button onClick={handleRedeemSearch} disabled={!playerId || amount <= 0 || busy}>
                  {busy ? "Processing…" : "Redeem"}
                </Button>
              ) : (
                <Button onClick={handleRedeemQr} disabled={!qrToken.trim() || amount <= 0 || busy}>
                  {busy ? "Processing…" : "Redeem via QR"}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
