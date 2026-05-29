import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormGrid, FormField } from "@/components/ui/form-grid";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { toast } from "@/hooks/use-toast";
import { formatNumberSpaces } from "@/lib/currency";
import { useClosePosTab, type PaymentSplit, type PosTab } from "@/hooks/use-pos-tabs";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tab: PosTab | null;
  onClosed?: () => void;
}

export const CloseBillDialog = ({ open, onOpenChange, tab, onClosed }: Props) => {
  const closeMut = useClosePosTab();
  const [cash, setCash] = useState("0");
  const [card, setCard] = useState("0");
  const [compPlayer, setCompPlayer] = useState("0");
  const [compHouse, setCompHouse] = useState("0");
  const [playerCharge, setPlayerCharge] = useState("0");

  const total = tab?.total_tzs ?? 0;
  const hasPlayer = !!tab?.player_id;

  useEffect(() => {
    if (open && tab) {
      setCash(String(total));
      setCard("0");
      setCompPlayer("0");
      setCompHouse("0");
      setPlayerCharge("0");
    }
  }, [open, tab, total]);

  const sum = useMemo(() => {
    return (Number(cash) || 0) + (Number(card) || 0)
      + (Number(compPlayer) || 0) + (Number(compHouse) || 0)
      + (Number(playerCharge) || 0);
  }, [cash, card, compPlayer, compHouse, playerCharge]);

  const delta = sum - total;
  const valid = delta === 0 && total > 0;

  const handle = async () => {
    if (!tab) return;
    if (!valid) {
      toast({ title: "Split must sum to total", variant: "destructive" });
      return;
    }
    const split: PaymentSplit = {
      cash: Math.round(Number(cash) || 0),
      card: Math.round(Number(card) || 0),
      comp_player: Math.round(Number(compPlayer) || 0),
      comp_house: Math.round(Number(compHouse) || 0),
      player_charge: Math.round(Number(playerCharge) || 0),
    };
    if ((split.comp_player ?? 0) > 0 && !hasPlayer) {
      toast({ title: "Comp player not available for walk-in tabs", variant: "destructive" });
      return;
    }
    if ((split.player_charge ?? 0) > 0 && !hasPlayer) {
      toast({ title: "Charge to tab requires a player tab", variant: "destructive" });
      return;
    }
    try {
      await closeMut.mutateAsync({ tab_id: tab.id, total_tzs: total, payment_split: split });
      toast({ title: "Bill closed" });
      onOpenChange(false);
      onClosed?.();
    } catch (e: any) {
      toast({ title: "Failed to close", description: e?.message, variant: "destructive" });
    }
  };

  const fillCharge = () => {
    if (!hasPlayer) return;
    setCash("0"); setCard("0"); setCompPlayer("0"); setCompHouse("0");
    setPlayerCharge(String(total));
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Close bill" size="lg">
      <div className="space-y-4">
        <div className="rounded-md bg-muted/40 px-4 py-3 flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-2xl font-bold font-mono tabular-nums">
            {formatNumberSpaces(total)} <span className="text-sm">TZS</span>
          </span>
        </div>

        <FormGrid>
          <FormField span={6} label="Cash">
            <Input type="number" inputMode="numeric" value={cash}
              onChange={(e) => setCash(e.target.value)} className="text-lg" />
          </FormField>
          <FormField span={6} label="Card">
            <Input type="number" inputMode="numeric" value={card}
              onChange={(e) => setCard(e.target.value)} className="text-lg" />
          </FormField>
          <FormField span={6} label="Comp · player"
            hint={!hasPlayer ? "Only available for player tabs" : undefined}>
            <Input type="number" inputMode="numeric" value={compPlayer}
              onChange={(e) => setCompPlayer(e.target.value)}
              disabled={!hasPlayer} className="text-lg" />
          </FormField>
          <FormField span={6} label="Comp · house">
            <Input type="number" inputMode="numeric" value={compHouse}
              onChange={(e) => setCompHouse(e.target.value)} className="text-lg" />
          </FormField>
          <FormField
            span={12}
            label="Charge to player tab"
            hint={!hasPlayer ? "Walk-in tabs cannot be charged" : "Postpaid — settled later in Cage"}
          >
            <div className="flex gap-2">
              <Input type="number" inputMode="numeric" value={playerCharge}
                onChange={(e) => setPlayerCharge(e.target.value)}
                disabled={!hasPlayer} className="text-lg" />
              <Button type="button" variant="outline" disabled={!hasPlayer} onClick={fillCharge}>
                Full
              </Button>
            </div>
          </FormField>
        </FormGrid>

        <div className={`rounded-md px-4 py-2 flex items-center justify-between text-sm ${
          delta === 0
            ? "bg-cms-amount-positive/10 text-cms-amount-positive"
            : "bg-cms-amount-negative/10 text-cms-amount-negative"
        }`}>
          <span>Sum {formatNumberSpaces(sum)}</span>
          <span>
            {delta === 0 ? "Balanced" : `Δ ${delta > 0 ? "+" : ""}${formatNumberSpaces(delta)}`}
          </span>
        </div>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handle} disabled={!valid || closeMut.isPending}>
            {closeMut.isPending ? "Closing…" : "Confirm & close"}
          </Button>
        </ResponsiveDialogFooter>
      </div>
    </ResponsiveDialog>
  );
};

export default CloseBillDialog;
