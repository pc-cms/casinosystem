import { useState, useEffect, useRef } from "react";
import { Search, Plus, UserCheck, UserX, CreditCard, Tag } from "lucide-react";
import { useCMS } from "@/lib/cms-context";
import { TAG_OPTIONS, type Player } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const Players = () => {
  const { players, addPlayer, updatePlayerStatus, updatePlayerTags, addPlayerCard, searchPlayers, getPlayerStats } = useCMS();
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = query ? searchPlayers(query) : players;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !showAdd && !selectedPlayer) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "n" && e.altKey) {
        e.preventDefault();
        setShowAdd(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showAdd, selectedPlayer]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Players</h1>
          <p className="text-sm text-muted-foreground">{players.length} registered</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> New Player <span className="cms-kbd ml-2">Alt+N</span>
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, nickname, or card..."
          className="pl-10 font-mono"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 cms-kbd">/</span>
      </div>

      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Player</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Nickname</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Card</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Tags</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Result</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(player => {
              const stats = getPlayerStats(player.id);
              return (
                <tr
                  key={player.id}
                  onClick={() => setSelectedPlayer(player)}
                  className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-card-foreground">{player.firstName} {player.lastName}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{player.nickname}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {player.cards.find(c => c.active)?.cardNumber || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={player.status === "active" ? "cms-status-active" : "cms-status-blacklist"}>
                      <span className={`w-1.5 h-1.5 rounded-full ${player.status === "active" ? "bg-success" : "bg-danger"}`} />
                      {player.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {player.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-[10px] font-mono">{tag}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono text-sm font-medium ${stats.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                      €{Math.abs(stats.result).toLocaleString()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">No players found</p>
        )}
      </div>

      <AddPlayerDialog open={showAdd} onClose={() => setShowAdd(false)} />
      {selectedPlayer && (
        <PlayerDetailDialog
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          onStatusChange={(s) => { updatePlayerStatus(selectedPlayer.id, s); setSelectedPlayer({ ...selectedPlayer, status: s }); }}
          onTagsChange={(t) => { updatePlayerTags(selectedPlayer.id, t); setSelectedPlayer({ ...selectedPlayer, tags: t }); }}
          onAddCard={() => { addPlayerCard(selectedPlayer.id); }}
        />
      )}
    </div>
  );
};

const AddPlayerDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { addPlayer } = useCMS();
  const [form, setForm] = useState({ firstName: "", lastName: "", nickname: "", phone: "" });

  const handleSubmit = () => {
    if (!form.firstName || !form.lastName) return;
    addPlayer({ ...form, status: "active", tags: [], photo: null });
    setForm({ firstName: "", lastName: "", nickname: "", phone: "" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Player</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="First Name *" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} autoFocus />
          <Input placeholder="Last Name *" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
          <Input placeholder="Nickname" value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
          <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.firstName || !form.lastName}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PlayerDetailDialog = ({ player, onClose, onStatusChange, onTagsChange, onAddCard }: {
  player: Player; onClose: () => void;
  onStatusChange: (s: "active" | "blacklist") => void;
  onTagsChange: (t: string[]) => void;
  onAddCard: () => void;
}) => {
  const { getPlayerStats, getPlayerTransactions } = useCMS();
  const stats = getPlayerStats(player.id);
  const txs = getPlayerTransactions(player.id);

  const toggleTag = (tag: string) => {
    onTagsChange(player.tags.includes(tag) ? player.tags.filter(t => t !== tag) : [...player.tags, tag]);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{player.firstName} {player.lastName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="cms-panel p-3 text-center">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Drop</p>
              <p className="font-mono text-sm font-bold text-card-foreground">€{stats.totalBuy.toLocaleString()}</p>
            </div>
            <div className="cms-panel p-3 text-center">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Cashout</p>
              <p className="font-mono text-sm font-bold text-card-foreground">€{stats.totalCashout.toLocaleString()}</p>
            </div>
            <div className="cms-panel p-3 text-center">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Result</p>
              <p className={`font-mono text-sm font-bold ${stats.result >= 0 ? "cms-amount-positive" : "cms-amount-negative"}`}>
                €{Math.abs(stats.result).toLocaleString()}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Tag className="w-3 h-3" /> Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {TAG_OPTIONS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    player.tags.includes(tag)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Cards</p>
            <div className="space-y-1">
              {player.cards.map(card => (
                <div key={card.id} className="flex items-center justify-between text-xs font-mono py-1">
                  <span className="text-card-foreground">{card.cardNumber}</span>
                  <span className="text-muted-foreground">{card.type} · {card.active ? "Active" : "Inactive"}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={onAddCard}>
              <Plus className="w-3 h-3 mr-1" /> Issue Card
            </Button>
          </div>

          <div className="flex gap-2">
            {player.status === "active" ? (
              <Button variant="destructive" size="sm" onClick={() => onStatusChange("blacklist")}>
                <UserX className="w-3 h-3 mr-1" /> Blacklist
              </Button>
            ) : (
              <Button size="sm" onClick={() => onStatusChange("active")}>
                <UserCheck className="w-3 h-3 mr-1" /> Reactivate
              </Button>
            )}
          </div>

          {txs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Recent Transactions</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {txs.slice(0, 10).map(tx => (
                  <div key={tx.id} className="flex justify-between text-xs font-mono py-1 border-b border-border last:border-0">
                    <span className="text-muted-foreground">{tx.type.toUpperCase()} @ {tx.tableId}</span>
                    <span className={tx.type === "buy" ? "cms-amount-negative" : "cms-amount-positive"}>
                      €{tx.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Players;
