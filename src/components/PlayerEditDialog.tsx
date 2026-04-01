import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Camera, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PlayerEditDialogProps {
  player: {
    id: string;
    first_name: string;
    last_name: string;
    nickname?: string;
    photo_url?: string | null;
    id_number?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PlayerEditDialog = ({ player, open, onOpenChange }: PlayerEditDialogProps) => {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Reset form when player changes
  const resetForm = () => {
    if (player) {
      setFirstName(player.first_name || "");
      setLastName(player.last_name || "");
      setIdNumber(player.id_number || "");
      setPhotoUrl(player.photo_url || null);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !player) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `players/${player.id}/photo.${ext}`;
      const { error: upErr } = await supabase.storage.from("player-photos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("player-photos").getPublicUrl(path);
      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from("players").update({ photo_url: url }).eq("id", player.id);
      setPhotoUrl(url);
      toast.success("Photo updated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!player) return;
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      if (firstName && firstName !== player.first_name) updates.first_name = firstName;
      if (lastName && lastName !== player.last_name) updates.last_name = lastName;
      if (idNumber !== (player.id_number || "")) updates.id_number = idNumber;
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("players").update(updates).eq("id", player.id);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["players"] });
      toast.success("Player updated");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const incomplete = player && (!player.photo_url && !photoUrl || !player.first_name || !player.last_name || !player.id_number);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Player
            {incomplete && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
          </DialogTitle>
        </DialogHeader>

        {player && (
          <div className="space-y-4">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {(photoUrl || player.photo_url) ? (
                  <img src={photoUrl || player.photo_url!} className="w-full h-full object-cover" alt="" />
                ) : (
                  <User className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <Label htmlFor="photo-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" className="gap-1 text-xs" asChild disabled={uploading}>
                    <span>
                      <Camera className="w-3 h-3" /> {uploading ? "Uploading…" : "Upload Photo"}
                    </span>
                  </Button>
                </Label>
                <input id="photo-upload" type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
              </div>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">First Name</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last Name</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} className="h-9" />
              </div>
            </div>

            {/* ID */}
            <div className="space-y-1">
              <Label className="text-xs">ID Number</Label>
              <Input value={idNumber} onChange={e => setIdNumber(e.target.value)} className="h-9 font-mono" placeholder="Passport / ID" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerEditDialog;
