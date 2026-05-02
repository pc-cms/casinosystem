import { useMemo, useState } from "react";
import { ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, Search, X } from "lucide-react";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { usePlayers } from "@/hooks/use-players";
import { useCreateChipTransferPair } from "@/hooks/use-chip-transfers";
import { formatNumberSpaces } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Direction = "out" | "in";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Locked player (the one we opened the dialog from). */
  player: { id: string; first_name: string; last_name: string; nickname?: string | null } | null;
  /** Optional pre-fill: which side this player is on. Defaults to "out" (gives chips). */
  defaultDirection?: Direction;
  /** Optional table context (e.g. opened from Floor Map). */
  tableId?: string | null;
  /** Visit-aware list of players currently in casino, used for fast suggestions. */
  presentPlayerIds?: Set<string>;
}

const QUICK_AMOUNTS = [100_000, 500_000, 1_000_000, 5_000_000];

const playerLabel = (p: { first_name: string; last_name: string; nickname?: string | null }) => {
  const full = `${p.first_name} ${p.last_name}`.trim();
  return p.nickname ? `${full} "${p.nickname}"` : full;
};

export const ChipTransferDialog = ({
  open,
  onOpenChange,
  player,
  defaultDirection = "out",
  tableId = null,
  presentPlayerIds,
}: Props) => {
  const { data: allPlayers = [] } = usePlayers();
  const create = useCreateChipTransferPair();

  const [direction, setDirection] = useState<Direction>(defaultDirection);
  const [counterpartyId, setCounterpartyId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Reset state on open/player change
  useMemo(() => {
    if (open) {
      setDirection(defaultDirection);
      setCounterpartyId(null);
      setAmount("");
      setNote("");
      setSearch("");
      setShowAll(false);
    }
  }, [open, player?.id, defaultDirection]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allPlayers as any[])
      .filter(p => {
        if (p.id === player?.id) return false;
        if (!showAll && presentPlayerIds && !presentPlayerIds.has(p.id)) return false;
        if (!q) return true;
        const hay = `${p.first_name} ${p.last_name} ${p.nickname ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 30);
  }, [allPlayers, search, showAll, presentPlayerIds, player?.id]);

  const counterparty = (allPlayers as any[]).find(p => p.id === counterpartyId) ?? null;
  const amtNum = Number(amount) || 0;

  // Pairing validation — mirrors DB-side guarantees so the user sees the reason BEFORE submit.
  const validation = useMemo(() => {
    if (!player) return { ok: false, reason: "No player selected" };
    if (!counterpartyId) {
      return { ok: false, reason: direction === "out"
        ? "Pick the recipient — chip transfers must be paired"
        : "Pick the donor — chip transfers must be paired" };
    }
    if (counterpartyId === player.id) {
      return { ok: false, reason: "Counterparty must be a different player" };
    }
    if (amtNum <= 0) return { ok: false, reason: "Enter an amount greater than zero" };
    return { ok: true, reason: "" as string };
  }, [player, counterpartyId, amtNum, direction]);

  const canSubmit = validation.ok && !create.isPending;

  const handleSubmit = async () => {
    if (!validation.ok || !player || !counterpartyId) {
      if (!validation.ok) toast.error(validation.reason);
      return;
    }
    // direction = "out": player gives chips to counterparty (player = from)
    // direction = "in":  player receives chips from counterparty (player = to)
    const from_player = direction === "out" ? player.id : counterpartyId;
    const to_player = direction === "out" ? counterpartyId : player.id;
    // Final defensive guard — DB enforces this too, but fail fast on the client.
    if (from_player === to_player) {
      toast.error("From and To players must differ");
      return;
    }
    try {
      await create.mutateAsync({
        from_player,
        to_player,
        amount: amtNum,
        table_id: tableId,
        note: note.trim(),
      });
      onOpenChange(false);
    } catch {
      // toast handled in hook
    }
  };

  if (!player) return null;

  const dirLabel = direction === "out"
    ? `${playerLabel(player)} → Other player`
    : `Other player → ${playerLabel(player)}`;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="inline-flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-primary" />
          Chip Transfer
        </span>
      }
      description={dirLabel}
      size="lg"
    >
      <div className="space-y-4">
        {/* Direction toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirection("out")}
            className={cn(
              "rounded-md border px-3 py-2.5 text-left transition-colors",
              direction === "out"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border bg-card hover:bg-muted/40"
            )}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <ArrowUpFromLine className="w-3.5 h-3.5" />
              Chip Out
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Player gives chips away</div>
          </button>
          <button
            type="button"
            onClick={() => setDirection("in")}
            className={cn(
              "rounded-md border px-3 py-2.5 text-left transition-colors",
              direction === "in"
                ? "border-success/40 bg-success/10 text-success"
                : "border-border bg-card hover:bg-muted/40"
            )}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <ArrowDownToLine className="w-3.5 h-3.5" />
              Chip In
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Player receives chips</div>
          </button>
        </div>

        {/* Counterparty selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">
              {direction === "out" ? "Recipient" : "Donor"}
            </Label>
            <button
              type="button"
              onClick={() => setShowAll(s => !s)}
              className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              {showAll ? "Only present players" : "Show all players"}
            </button>
          </div>

          {counterparty ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <div className="text-sm">
                <span className="font-semibold">{counterparty.first_name} {counterparty.last_name}</span>
                {counterparty.nickname && (
                  <span className="text-muted-foreground"> "{counterparty.nickname}"</span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCounterpartyId(null)} className="h-7 w-7 p-0">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search player..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="max-h-44 overflow-y-auto border border-border rounded-md divide-y divide-border bg-card">
                {candidates.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {showAll ? "No matching players" : "No present players match — toggle 'Show all players'"}
                  </div>
                ) : (
                  candidates.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setCounterpartyId(p.id)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                    >
                      <span>
                        <span className="font-semibold">{p.first_name} {p.last_name}</span>
                        {p.nickname && <span className="text-muted-foreground"> "{p.nickname}"</span>}
                      </span>
                      {presentPlayerIds?.has(p.id) && (
                        <Badge variant="outline" className="text-[9px] py-0 h-4 border-success/30 text-success">In</Badge>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <Label className="text-xs">Amount (TZS)</Label>
          <NumberInput value={amount} onChange={setAmount} placeholder="0" />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map(q => (
              <Button
                key={q}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[10px] font-mono"
                onClick={() => setAmount(String(q))}
              >
                +{formatNumberSpaces(q)}
              </Button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <Label className="text-xs">Note (optional)</Label>
          <Textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. observed at table 4"
            rows={2}
            className="text-xs resize-none"
          />
        </div>

        {/* Summary preview */}
        {counterparty && amtNum > 0 && (
          <div className="rounded-md bg-muted/30 border border-border px-3 py-2 text-xs">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Will record</div>
            <div className="font-mono">
              <span className="font-semibold">{playerLabel(direction === "out" ? player : counterparty)}</span>
              <span className="text-muted-foreground mx-1.5">→</span>
              <span className="font-semibold">{playerLabel(direction === "out" ? counterparty : player)}</span>
              <span className="text-muted-foreground mx-1.5">·</span>
              <span className="cms-amount-positive">{formatNumberSpaces(amtNum)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              No cash through cage. Affects NEP/Drop only.
            </div>
          </div>
        )}

        {/* Pairing requirement banner — shown until both sides + amount are valid */}
        {!validation.ok && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <span className="font-semibold shrink-0">Pairing required:</span>
            <span>{validation.reason} — every CHIP IN is created together with its matching CHIP OUT atomically. No partial records.</span>
          </div>
        )}
      </div>

      <ResponsiveDialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          title={!canSubmit && !create.isPending ? validation.reason : undefined}
        >
          {create.isPending ? "Recording…" : "Record Transfer"}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
};

export default ChipTransferDialog;
