import { useState } from "react";
import { Plus, UserCheck, UserX, CreditCard, Tag } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useUpdatePlayerStatus, useAddPlayerTag, useRemovePlayerTag, useIssueCard } from "@/hooks/use-casino-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import CategoryBadge, { type PlayerCategory } from "@/components/player/CategoryBadge";
import FlagBadges from "@/components/player/FlagBadges";

const TAG_OPTIONS = ["VIP", "No Alcohol", "Alcohol Allowed", "Free Food", "High Roller", "Watch List"];

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
          <DialogTitle className="flex items-center gap-2">
            <CategoryBadge category={((player as any).category as PlayerCategory) || "guest"} size="md" />
            {player.first_name} {player.last_name}
            <span className="text-muted-foreground font-normal">({player.nickname})</span>
          </DialogTitle>
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

      <ManagerOverrideDialog
        open={!!pendingTagAction}
        onClose={() => setPendingTagAction(null)}
        onConfirm={() => { pendingTagAction?.(); setPendingTagAction(null); }}
        title="Edit Player Tags"
        description="Manager authentication required to modify player tags."
        actionType="EDIT_PLAYER_TAGS"
        actionDetails={{ player_id: player.id, player_name: `${player.first_name} ${player.last_name}` }}
      />

      <ManagerOverrideDialog
        open={!!pendingStatusAction}
        onClose={() => setPendingStatusAction(null)}
        onConfirm={() => { pendingStatusAction?.(); setPendingStatusAction(null); }}
        title="Change Player Status"
        description="Manager authentication required to change player status."
        actionType="CHANGE_PLAYER_STATUS"
        actionDetails={{ player_id: player.id, player_name: `${player.first_name} ${player.last_name}` }}
      />
    </Dialog>
  );
};

export default PlayerDetailDialog;
