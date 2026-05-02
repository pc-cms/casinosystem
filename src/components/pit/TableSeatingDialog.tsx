import { useMemo, useState } from "react";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Badge } from "@/components/ui/badge";
import { Search, Play, ArrowRight, LogOut, Pencil, X } from "lucide-react";
import { formatNumberSpaces } from "@/lib/currency";
import CategoryBadge from "@/components/player/CategoryBadge";
import type { SeatedPlayer } from "./SeatedPlayerChip";
import type { FloorTable } from "./FloorTableCard";
import { cn } from "@/lib/utils";

interface OtherTableEntry {
  table: FloorTable;
  players: SeatedPlayer[];
}

interface CandidatePlayer {
  id: string;
  first_name: string;
  last_name: string;
  nickname?: string | null;
  category: SeatedPlayer["category"];
  isCheckedIn: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  table: FloorTable | null;
  seated: SeatedPlayer[];
  otherTables: OtherTableEntry[];
  candidates: CandidatePlayer[]; // players not currently seated at any table
  onPlace: (playerId: string, avgBet: number) => void;
  onMove: (playerId: string, avgBet: number) => void; // move from other table to this
  onUpdateBet: (playerId: string, avgBet: number) => void;
  onStop: (playerId: string) => void;
  isPending: boolean;
  prefilledPlayerId?: string | null; // for drop
}

const formatTime = (d: Date | null) => {
  if (!d) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const TableSeatingDialog = ({
  open, onOpenChange, table, seated, otherTables, candidates,
  onPlace, onMove, onUpdateBet, onStop, isPending, prefilledPlayerId,
}: Props) => {
  const [search, setSearch] = useState("");
  const [pickPlayerId, setPickPlayerId] = useState<string | null>(prefilledPlayerId ?? null);
  const [pickBet, setPickBet] = useState("");
  const [movePlayerId, setMovePlayerId] = useState<string | null>(null);
  const [moveBet, setMoveBet] = useState("");
  const [editPlayerId, setEditPlayerId] = useState<string | null>(null);
  const [editBet, setEditBet] = useState("");

  // Reset on close
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSearch(""); setPickPlayerId(null); setPickBet("");
      setMovePlayerId(null); setMoveBet("");
      setEditPlayerId(null); setEditBet("");
    }
    onOpenChange(v);
  };

  const filteredCandidates = useMemo(() => {
    const list = candidates.filter(p => !seated.some(s => s.id === p.id));
    if (!search) return list.filter(p => p.isCheckedIn).slice(0, 12);
    const q = search.toLowerCase();
    return list
      .filter(p => `${p.first_name} ${p.last_name} ${p.nickname ?? ""}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [candidates, search, seated]);

  if (!table) return null;
  const isClosed = table.status === "closed";
  const isRoulette = /roulette/i.test(table.game);
  const betPresets = isRoulette
    ? [1000, 2000, 5000, 10000, 25000, 50000]
    : [10000, 20000, 50000, 100000, 200000];

  const submitPlace = () => {
    if (!pickPlayerId || !pickBet) return;
    onPlace(pickPlayerId, Number(pickBet));
    setPickPlayerId(null); setPickBet(""); setSearch("");
  };

  const submitMove = () => {
    if (!movePlayerId || !moveBet) return;
    onMove(movePlayerId, Number(moveBet));
    setMovePlayerId(null); setMoveBet("");
  };

  const submitEdit = () => {
    if (!editPlayerId || !editBet) return;
    onUpdateBet(editPlayerId, Number(editBet));
    setEditPlayerId(null); setEditBet("");
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      size="2xl"
      title={
        <div className="flex items-center gap-2">
          <span className="font-mono">{table.name}</span>
          <Badge variant="outline" className="text-[10px]">{table.game}</Badge>
          {isClosed && <Badge variant="destructive" className="text-[10px]">CLOSED</Badge>}
        </div>
      }
      description={`${seated.length} player${seated.length !== 1 ? "s" : ""} seated`}
    >
      <div className="space-y-5">
        {/* Currently seated */}
        <section className="space-y-2">
          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">Currently seated</h4>
          {seated.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No players at this table.</p>
          ) : (
            <div className="space-y-1.5">
              {seated.map(p => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/20">
                  <CategoryBadge category={p.category} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-card-foreground truncate">
                      {p.first_name} {p.last_name}
                      {p.nickname && <span className="text-muted-foreground font-normal"> "{p.nickname}"</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Avg {formatNumberSpaces(p.avgBet)} · since {formatTime(p.startedAt)}
                      {p.dropR > 0 && ` · Drop R ${formatNumberSpaces(p.dropR)}`}
                    </p>
                  </div>
                  {editPlayerId === p.id ? (
                    <div className="flex items-center gap-1">
                      <NumberInput value={editBet} onChange={setEditBet} placeholder="Avg bet" className="w-28" />
                      <Button size="sm" onClick={submitEdit} disabled={!editBet || isPending}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditPlayerId(null); setEditBet(""); }}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" title="Edit avg bet"
                        onClick={() => { setEditPlayerId(p.id); setEditBet(String(p.avgBet || "")); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Stop session" onClick={() => onStop(p.id)} disabled={isPending}>
                        <LogOut className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Add player */}
        {!isClosed && (
          <section className="space-y-2">
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">Add player</h4>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search players (checked-in shown by default)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            {filteredCandidates.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">{search ? "No matches" : "No checked-in players available"}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {filteredCandidates.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setPickPlayerId(p.id); }}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] transition-colors",
                      pickPlayerId === p.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:bg-muted/50"
                    )}
                  >
                    <CategoryBadge category={p.category} />
                    <span className="font-medium">{p.first_name} {p.last_name}</span>
                    {!p.isCheckedIn && <span className="text-[9px] text-muted-foreground">(not in)</span>}
                  </button>
                ))}
              </div>
            )}
            {pickPlayerId && (
              <div className="flex items-center gap-2 pt-1">
                <label className="text-xs text-muted-foreground shrink-0">Avg Bet:</label>
                <NumberInput value={pickBet} onChange={setPickBet} placeholder="e.g. 5 000" className="w-40" />
                <Button size="sm" onClick={submitPlace} disabled={!pickBet || Number(pickBet) <= 0 || isPending} className="gap-1">
                  <Play className="w-3.5 h-3.5" /> Seat
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Move from other tables */}
        {!isClosed && otherTables.some(o => o.players.length > 0) && (
          <section className="space-y-2">
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">Move from another table</h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {otherTables.filter(o => o.players.length > 0).map(({ table: t, players }) => (
                <div key={t.id} className="space-y-0.5">
                  <p className="text-[10px] font-mono text-muted-foreground">{t.name} · {t.game}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {players.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setMovePlayerId(p.id); setMoveBet(String(p.avgBet || "")); }}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] transition-colors",
                          movePlayerId === p.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background hover:bg-muted/50"
                        )}
                      >
                        <CategoryBadge category={p.category} />
                        <span className="font-medium">{p.first_name} {p.last_name}</span>
                        <span className="text-[9px] font-mono text-muted-foreground">{formatNumberSpaces(p.avgBet)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {movePlayerId && (
              <div className="flex items-center gap-2 pt-1">
                <label className="text-xs text-muted-foreground shrink-0">New avg bet:</label>
                <NumberInput value={moveBet} onChange={setMoveBet} placeholder="e.g. 5 000" className="w-40" />
                <Button size="sm" onClick={submitMove} disabled={!moveBet || Number(moveBet) <= 0 || isPending} className="gap-1">
                  <ArrowRight className="w-3.5 h-3.5" /> Move
                </Button>
              </div>
            )}
          </section>
        )}
      </div>

      <ResponsiveDialogFooter>
        <Button variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
};

export default TableSeatingDialog;
