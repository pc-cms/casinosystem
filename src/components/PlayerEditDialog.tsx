import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Camera, User, FileImage, StickyNote, Send, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import CategoryBadge, { ALL_CATEGORIES, type PlayerCategory } from "@/components/player/CategoryBadge";
import FlagBadges from "@/components/player/FlagBadges";
import { useIsMobile } from "@/hooks/use-mobile";

interface PlayerEditDialogProps {
  player: {
    id: string;
    first_name: string;
    last_name: string;
    nickname?: string;
    phone?: string;
    photo_url?: string | null;
    id_number?: string;
    id_document_url?: string | null;
    player_type?: string;
    category?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NOTE_TYPES = ["info", "vip", "warning", "suspicious", "incident"] as const;
const NOTE_TYPE_COLORS: Record<string, string> = {
  info: "border-l-blue-500",
  vip: "border-l-amber-500",
  warning: "border-l-orange-500",
  suspicious: "border-l-red-500",
  incident: "border-l-destructive",
};

const PlayerEditDialog = ({ player, open, onOpenChange }: PlayerEditDialogProps) => {
  const isMobile = useIsMobile();
  const { user, roles, isManager, casinoId } = useAuth();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [playerType, setPlayerType] = useState("table");
  const [category, setCategory] = useState<PlayerCategory>("normal");
  const [uploading, setUploading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState<string>("info");
  const [addingNote, setAddingNote] = useState(false);

  const canSeeNotes = roles.some(r => ["pit", "security", "manager"].includes(r)) || isManager;
  const canEditCategory = isManager;

  useEffect(() => {
    if (player && open) {
      setFirstName(player.first_name || "");
      setLastName(player.last_name || "");
      setNickname(player.nickname || "");
      setPhone(player.phone || "");
      setIdNumber(player.id_number || "");
      setPlayerType(player.player_type || "table");
      setCategory((player.category as PlayerCategory) || "normal");
      setPhotoUrl(player.photo_url || null);
      setNewNote("");
      setNoteType("info");

      // Generate signed URL for private document bucket
      if (player.id_document_url && !player.id_document_url.startsWith("http")) {
        supabase.storage.from("player-documents").createSignedUrl(player.id_document_url, 3600)
          .then(({ data }) => setDocUrl(data?.signedUrl || null));
      } else {
        setDocUrl(player.id_document_url || null);
      }
    }
  }, [player, open]);

  const { data: notes = [], refetch: refetchNotes } = useQuery({
    queryKey: ["player_notes", player?.id],
    queryFn: async () => {
      if (!player) return [];
      const { data, error } = await supabase
        .from("player_notes")
        .select("*")
        .eq("player_id", player.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!player && open && canSeeNotes,
  });

  const { data: playerTags = [] } = useQuery({
    queryKey: ["player_tags_dialog", player?.id],
    queryFn: async () => {
      if (!player) return [];
      const { data } = await supabase.from("player_tags").select("tag").eq("player_id", player.id);
      return (data || []).map(t => t.tag);
    },
    enabled: !!player && open,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_for_notes"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name");
      return data || [];
    },
    enabled: open && notes.length > 0,
  });

  const getAuthorName = (userId: string) => {
    const p = profiles.find((pr: any) => pr.user_id === userId);
    return p ? (p as any).display_name : "Staff";
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

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !player) return;
    setUploadingDoc(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${casinoId}/${player.id}/docs/id_document.${ext}`;
      const { error: upErr } = await supabase.storage.from("player-documents").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      // Store the storage path (not a public URL) — we generate signed URLs on read
      const storagePath = path;
      await supabase.from("players").update({ id_document_url: storagePath } as any).eq("id", player.id);
      // Generate a temporary signed URL for immediate display
      const { data: signedData } = await supabase.storage.from("player-documents").createSignedUrl(storagePath, 3600);
      setDocUrl(signedData?.signedUrl || storagePath);
      toast.success("ID document uploaded");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleAddNote = async () => {
    if (!player || !newNote.trim() || !user) return;
    setAddingNote(true);
    try {
      const { data: playerData } = await supabase.from("players").select("casino_id").eq("id", player.id).single();
      if (!playerData) throw new Error("Player not found");
      const { error } = await supabase.from("player_notes").insert({
        player_id: player.id,
        casino_id: playerData.casino_id,
        content: newNote.trim(),
        created_by: user.id,
        note_type: noteType,
      } as any);
      if (error) throw error;
      setNewNote("");
      setNoteType("info");
      refetchNotes();
      toast.success("Note added");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddingNote(false);
    }
  };

  const handleSave = async () => {
    if (!player) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      if (firstName && firstName !== player.first_name) updates.first_name = firstName;
      if (lastName && lastName !== player.last_name) updates.last_name = lastName;
      if (nickname !== (player.nickname || "")) updates.nickname = nickname;
      if (phone !== (player.phone || "")) updates.phone = phone;
      if (idNumber !== (player.id_number || "")) updates.id_number = idNumber;
      if (playerType !== (player.player_type || "table")) updates.player_type = playerType;
      if (canEditCategory && category !== ((player.category as PlayerCategory) || "normal")) updates.category = category;
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("players").update(updates).eq("id", player.id);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["players"] });
      queryClient.invalidateQueries({ queryKey: ["casino_visits"] });
      toast.success("Player updated");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasPhoto = photoUrl || player?.photo_url;
  const hasDoc = docUrl || player?.id_document_url;
  const hasId = idNumber || player?.id_number;
  const incomplete = player && (!hasPhoto || !hasDoc || !hasId);

  const formContent = player ? (
    <div className="space-y-4 px-1">
      {/* Flags */}
      {playerTags.length > 0 && (
        <div><FlagBadges tags={playerTags} /></div>
      )}

      {/* Photo & ID Document */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Profile Photo</Label>
          <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
            {(photoUrl || player.photo_url) ? (
              <img src={photoUrl || player.photo_url!} className="w-full h-full object-cover" alt="" />
            ) : (
              <User className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <Label htmlFor="photo-upload-m" className="cursor-pointer w-full">
            <Button variant="outline" size="sm" className="gap-1 text-xs w-full h-9" asChild disabled={uploading}>
              <span><Camera className="w-3.5 h-3.5" /> {uploading ? "…" : "Photo"}</span>
            </Button>
          </Label>
          <input id="photo-upload-m" type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">ID / Passport</Label>
          <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
            {(docUrl || player.id_document_url) ? (
              <img src={docUrl || player.id_document_url!} className="w-full h-full object-cover" alt="" />
            ) : (
              <FileImage className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <Label htmlFor="doc-upload-m" className="cursor-pointer w-full">
            <Button variant="outline" size="sm" className="gap-1 text-xs w-full h-9" asChild disabled={uploadingDoc}>
              <span><FileImage className="w-3.5 h-3.5" /> {uploadingDoc ? "…" : "ID Doc"}</span>
            </Button>
          </Label>
          <input id="doc-upload-m" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleDocUpload} />
        </div>
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">First Name</Label>
          <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Last Name</Label>
          <Input value={lastName} onChange={e => setLastName(e.target.value)} className="h-10" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nickname</Label>
          <Input value={nickname} onChange={e => setNickname(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-10" type="tel" />
        </div>
      </div>

      <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-3"}`}>
        <div className="space-y-1">
          <Label className="text-xs">ID / Passport</Label>
          <Input value={idNumber} onChange={e => setIdNumber(e.target.value)} className="h-10 font-mono" placeholder="Enter ID" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Player Type</Label>
          <Select value={playerType} onValueChange={setPlayerType}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="table">Table</SelectItem>
              <SelectItem value="slots">Slots</SelectItem>
              <SelectItem value="mix">Mix</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            Category
            {!canEditCategory && <Shield className="w-3 h-3 text-muted-foreground" />}
          </Label>
          <Select value={category} onValueChange={v => setCategory(v as PlayerCategory)} disabled={!canEditCategory}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALL_CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat} className="capitalize">{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      {canSeeNotes && (
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            <StickyNote className="w-3 h-3 text-muted-foreground" />
            <Label className="text-xs text-muted-foreground">Intelligence Notes ({notes.length})</Label>
          </div>
          <div className="flex gap-2">
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="h-10 w-[100px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOTE_TYPES.map(t => (
                  <SelectItem key={t} value={t} className="capitalize text-xs">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add note..."
              className="text-xs min-h-[44px] resize-none flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 self-end h-10 w-10 p-0"
              onClick={handleAddNote}
              disabled={!newNote.trim() || addingNote}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
          {notes.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {notes.map((note: any) => (
                <div key={note.id} className={`text-xs p-2 rounded bg-muted/50 border border-border border-l-2 ${NOTE_TYPE_COLORS[note.note_type] || NOTE_TYPE_COLORS.info}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[9px] font-mono uppercase text-muted-foreground">{note.note_type || "info"}</span>
                  </div>
                  <p className="text-card-foreground">{note.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {getAuthorName(note.created_by)} · {format(new Date(note.created_at), "dd MMM HH:mm")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  ) : null;

  const titleContent = (
    <span className="flex items-center gap-2">
      Edit Player
      {player && <CategoryBadge category={(player.category as PlayerCategory) || "normal"} size="md" />}
      {incomplete && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
    </span>
  );

  const footerContent = (
    <>
      <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none h-10">Cancel</Button>
      <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none h-10">{saving ? "Saving…" : "Save"}</Button>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>{titleContent}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 px-4 pb-2">
            {formContent}
          </div>
          <DrawerFooter className="flex-row gap-2">
            {footerContent}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titleContent}</DialogTitle>
        </DialogHeader>
        {formContent}
        <DialogFooter>
          {footerContent}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerEditDialog;
