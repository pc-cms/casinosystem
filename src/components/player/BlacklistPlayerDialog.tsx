import { useState } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Ban } from "lucide-react";
import { useSetPlayerStatus, useCreatePlayerNote } from "@/hooks/use-player-profile";
import { logAction } from "@/lib/logging";
import { useAuth } from "@/lib/auth-context";

interface Props {
  open: boolean;
  onClose: () => void;
  playerId: string;
  playerName: string;
}

export const BlacklistPlayerDialog = ({ open, onClose, playerId, playerName }: Props) => {
  const { casinoId } = useAuth();
  const [reason, setReason] = useState("");
  const setStatus = useSetPlayerStatus();
  const addNote = useCreatePlayerNote();

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    await setStatus.mutateAsync({ player_id: playerId, status: "blacklist" });
    await addNote.mutateAsync({
      player_id: playerId,
      content: `Added to blacklist. Reason: ${reason.trim()}`,
      note_type: "blacklist",
    });
    if (casinoId) {
      await logAction(casinoId, "player", "PLAYER_BLACKLISTED", {
        player_id: playerId,
        player_name: playerName,
        reason: reason.trim(),
      });
    }
    setReason("");
    onClose();
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Blacklist ${playerName}`}
      description="This action restricts entry and financial activity for this player. Reason is required and stored in player notes."
    >
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason</div>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this player being blacklisted?"
          rows={4}
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim() || setStatus.isPending}
          >
            <Ban className="w-4 h-4 mr-2" /> Blacklist Player
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
};

export default BlacklistPlayerDialog;
