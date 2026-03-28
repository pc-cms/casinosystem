import { useState, useEffect, useRef } from "react";
import { Search, Plus, UserCheck, UserX, CreditCard, Tag } from "lucide-react";
import { usePlayers, useCreatePlayer, useUpdatePlayerStatus, useAddPlayerTag, useRemovePlayerTag, useIssueCard } from "@/hooks/use-casino-data";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";

const TAG_OPTIONS = ["VIP", "No Alcohol", "Alcohol Allowed", "Free Food", "High Roller", "Watch List"];

/**
 * PLAYER LOGIC (STRICT):
 * - Player always exists before transaction
 * - No duplicate players (enforced by search)
 * - No deletion
 * - Multiple cards per player, all valid
 * - RFID = input shortcut only
 * - Tags: max 5, conflicting tags enforced by DB trigger
 * - Tag editing: only via Manager Access
 */
const Players = () => {
  const { data: players = [], isLoading } = usePlayers();
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? players.filter(p =>
        p.first_name.toLowerCase().includes(query.toLowerCase()) ||
        p.last_name.toLowerCase().includes(query.toLowerCase()) ||
        p.nickname.toLowerCase().includes(query.toLowerCase()) ||
        p.player_cards?.some(c => c.card_number.includes(query))
      )
    : players;

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

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, nickname, or card number..." className="pl-10 font-mono" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 cms-kbd">/</span>
      </div>

      <div className="cms-panel overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {["Player", "Nickname", "Card", "Status", "Tags"].map(h => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-8">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted-foreground text-sm py-8">No players found</td></tr>
            ) : (
              filtered.map(player => (
                <tr key={player.id} onClick={() => setSelectedPlayerId(player.id)}
                  className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors">
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
                    <div className="flex gap-1 flex-wrap">
                      {player.player_tags?.map(t => (
                        <Badge key={t.id} variant="outline" className="text-[10px] font-mono">{t.tag}</Badge>
                      ))}
                    </div>
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

/**
 * Player detail: Tags require Manager Override to edit.
 */
const PlayerDetailDialog = ({ player, onClose }: { player: any; onClose: () => void }) => {
  const { isManager } = useAuth();
  const updateStatus = useUpdatePlayerStatus();
  const addTag = useAddPlayerTag();
  const removeTag = useRemovePlayerTag();
  const issueCard = useIssueCard();
  const [rfidInput, setRfidInput] = useState("");
  const [pendingTagAction, setPendingTagAction] = useState<(() => void) | null>(null);
  const [pendingStatusAction, setPendingStatusAction] = useState<(() => void) | null>(null);

  const currentTags = player.player_tags?.map((t: any) => t.tag) || [];

  const handleTagClick = (tag: string) => {
    if (!isManager) return;
    const action = currentTags.includes(tag)
      ? () => removeTag.mutate({ playerId: player.id, tag })
      : () => addTag.mutate({ playerId: player.id, tag });
    setPendingTagAction(() => action);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{player.first_name} {player.last_name} <span className="text-muted-foreground font-normal">({player.nickname})</span></DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="cms-panel p-3">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Phone</p>
              <p className="font-mono text-sm text-card-foreground">{player.phone || "—"}</p>
            </div>
            <div className="cms-panel p-3">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Status</p>
              <span className={player.status === "active" ? "cms-status-active" : "cms-status-blacklist"}>
                {player.status}
              </span>
            </div>
          </div>

          {/* Tags - Manager Access Only */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Tags (max 5) {!isManager && <span className="text-[10px] text-destructive ml-1">· Manager only</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TAG_OPTIONS.map(tag => (
                <button key={tag}
                  onClick={() => handleTagClick(tag)}
                  disabled={!isManager || (!currentTags.includes(tag) && currentTags.length >= 5)}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    currentTags.includes(tag)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 disabled:opacity-30"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Cards - Multiple cards, all valid */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Cards</p>
            <div className="space-y-1">
              {player.player_cards?.map((card: any) => (
                <div key={card.id} className="flex items-center justify-between text-xs font-mono py-1">
                  <span className="text-card-foreground">{card.card_number}</span>
                  <span className="text-muted-foreground">{card.card_type} · {card.is_active ? "Active" : "Inactive"}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input placeholder="RFID UID (optional)" value={rfidInput} onChange={e => setRfidInput(e.target.value)} className="text-xs h-8 font-mono" />
              <Button variant="outline" size="sm" className="text-xs h-8 shrink-0"
                onClick={() => { issueCard.mutate({ playerId: player.id, rfidUid: rfidInput || undefined }); setRfidInput(""); }}>
                <Plus className="w-3 h-3 mr-1" /> Issue
              </Button>
            </div>
          </div>

          {/* Status */}
          <div className="flex gap-2">
            {player.status === "active" ? (
              <Button variant="destructive" size="sm" onClick={() => {
                if (!isManager) return;
                setPendingStatusAction(() => () => updateStatus.mutate({ id: player.id, status: "blacklist" }));
              }} disabled={!isManager}>
                <UserX className="w-3 h-3 mr-1" /> Blacklist
              </Button>
            ) : (
              <Button size="sm" onClick={() => {
                if (!isManager) return;
                setPendingStatusAction(() => () => updateStatus.mutate({ id: player.id, status: "active" }));
              }} disabled={!isManager}>
                <UserCheck className="w-3 h-3 mr-1" /> Reactivate
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Manager Override for tag changes */}
      <ManagerOverrideDialog
        open={!!pendingTagAction}
        onClose={() => setPendingTagAction(null)}
        onConfirm={(managerId) => {
          pendingTagAction?.();
          setPendingTagAction(null);
        }}
        title="Edit Player Tags"
        description="Manager authentication required to modify player tags."
        actionType="EDIT_PLAYER_TAGS"
        actionDetails={{ player_id: player.id, player_name: `${player.first_name} ${player.last_name}` }}
      />
    </Dialog>
  );
};

export default Players;
