import { useState, useEffect, useRef } from "react";
import { Search, Plus } from "lucide-react";
import { usePlayers, useCreatePlayer } from "@/hooks/use-casino-data";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import CategoryBadge, { CATEGORY_PRIORITY, type PlayerCategory } from "@/components/player/CategoryBadge";
import CategoryFilter from "@/components/player/CategoryFilter";
import FlagBadges from "@/components/player/FlagBadges";
import PlayerDetailDialog from "@/components/player/PlayerDetailDialog";

const Players = () => {
  const { data: players = [], isLoading } = usePlayers();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<Set<PlayerCategory>>(new Set(["diamond", "platinum", "gold", "guest"]));
  const [sortByCategory, setSortByCategory] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = (() => {
    let list = players;
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      list = list.filter(p =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.nickname.toLowerCase().includes(q) ||
        p.player_cards?.some(c => c.card_number.includes(debouncedQuery))
      );
    }
    list = list.filter(p => categoryFilter.has((p.category as PlayerCategory) || "guest"));
    if (sortByCategory) {
      list = [...list].sort((a, b) => {
        const catA = CATEGORY_PRIORITY[(a.category as PlayerCategory) || "guest"];
        const catB = CATEGORY_PRIORITY[(b.category as PlayerCategory) || "guest"];
        if (catA !== catB) return catA - catB;
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      });
    }
    return list;
  })();

  const selectedPlayer = players.find(p => p.id === selectedPlayerId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !showAdd && !selectedPlayerId) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "n" && e.altKey) { e.preventDefault(); setShowAdd(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showAdd, selectedPlayerId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Players</h1>
          <p className="text-sm text-muted-foreground">{players.length} registered · No deletion</p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> New Player <span className="cms-kbd ml-2">Alt+N</span>
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, nickname, or card number..." className="pl-10 font-mono" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 cms-kbd">/</span>
        </div>
        <CategoryFilter selected={categoryFilter} onChange={setCategoryFilter} />
        <Button variant={sortByCategory ? "secondary" : "ghost"} size="sm" className="text-xs h-7 shrink-0" onClick={() => setSortByCategory(!sortByCategory)}>
          Sort: Category
        </Button>
      </div>

      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["", "Player", "Nickname", "Card", "Status", "Tags"].map(h => (
                <th key={h || "cat"} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground text-sm py-8">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted-foreground text-sm py-8">No players found</td></tr>
            ) : (
              filtered.map(player => (
                <tr key={player.id} onClick={() => setSelectedPlayerId(player.id)}
                  className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <CategoryBadge category={((player as any).category as PlayerCategory) || "guest"} />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-card-foreground">{player.first_name} {player.last_name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{player.nickname}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {player.player_cards?.find(c => c.is_active)?.card_number || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={player.status === "active" ? "cms-status-active" : "cms-status-blacklist"}>
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${player.status === "active" ? "bg-success" : "bg-danger"}`} />
                      {player.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <FlagBadges tags={player.player_tags?.map(t => t.tag) || []} compact />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddPlayerDialog open={showAdd} onClose={() => setShowAdd(false)} />
      {selectedPlayer && (
        <PlayerDetailDialog player={selectedPlayer} onClose={() => setSelectedPlayerId(null)} />
      )}
    </div>
  );
};

const AddPlayerDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const createPlayer = useCreatePlayer();
  const [form, setForm] = useState({ first_name: "", last_name: "", nickname: "", phone: "" });

  const handleSubmit = () => {
    if (!form.first_name || !form.last_name) return;
    createPlayer.mutate(form, { onSuccess: () => { setForm({ first_name: "", last_name: "", nickname: "", phone: "" }); onClose(); } });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Player</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="First Name *" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} autoFocus />
          <Input placeholder="Last Name *" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
          <Input placeholder="Nickname" value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
          <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.first_name || !form.last_name || createPlayer.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Players;
