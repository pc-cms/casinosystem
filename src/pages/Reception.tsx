import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import {
  Search, UserPlus, LogIn, LogOut, ShieldAlert, Camera,
  User, Ban, CheckCircle2, XCircle, CreditCard, AlertTriangle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ============ HOOKS ============

const usePlayers = () => {
  const { casinoId } = useAuth();
  return useQuery({
    queryKey: ["players", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("players")
        .select("*, player_cards(*), player_tags(*)")
        .eq("casino_id", casinoId)
        .order("last_name");
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });
};

const useVisitsToday = () => {
  const { casinoId } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["casino_visits", casinoId, today],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("casino_visits")
        .select("*, players(first_name, last_name, nickname, photo_url, status, id_number)")
        .eq("casino_id", casinoId)
        .eq("date", today);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
    refetchInterval: 10000,
  });
};

/** Check if a player profile is incomplete (missing photo, full name, or ID) */
const isProfileIncomplete = (player: any): string[] => {
  const missing: string[] = [];
  if (!player.photo_url) missing.push("photo");
  if (!player.first_name || !player.last_name) missing.push("name");
  if (!player.id_number) missing.push("ID document");
  return missing;
};

const Reception = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "checkin";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reception</h1>
          <p className="text-sm text-muted-foreground">Entry control · Player registration</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => setSearchParams({ tab: v })}>
        <TabsList className="mb-4">
          <TabsTrigger value="checkin" className="gap-1.5">
            <LogIn className="w-3.5 h-3.5" /> Check-in
          </TabsTrigger>
          <TabsTrigger value="register" className="gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Register
          </TabsTrigger>
          <TabsTrigger value="update" className="gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Update Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkin"><CheckInTab /></TabsContent>
        <TabsContent value="register"><RegisterTab /></TabsContent>
        <TabsContent value="update"><UpdateDataTab /></TabsContent>
      </Tabs>
    </div>
  );
};

// ============ CHECK-IN TAB ============
const CheckInTab = () => {
  const { casinoId, user } = useAuth();
  const { data: players = [] } = usePlayers();
  const { data: visits = [] } = useVisitsToday();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [incompleteWarning, setIncompleteWarning] = useState<string[] | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  const activePlayers = useMemo(() => {
    const checkedInIds = new Set(
      visits.filter(v => !v.checked_out_at).map(v => v.player_id)
    );
    return checkedInIds;
  }, [visits]);

  const filtered = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return players.filter(p =>
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      p.nickname?.toLowerCase().includes(q) ||
      p.player_cards?.some((c: any) => c.card_number.includes(query)) ||
      p.player_cards?.some((c: any) => c.rfid_uid?.includes(query))
    ).slice(0, 20);
  }, [query, players]);

  const handleSelectPlayer = (player: any) => {
    setSelectedPlayer(player);
    const missing = isProfileIncomplete(player);
    setIncompleteWarning(missing.length > 0 ? missing : null);
  };

  const checkIn = useMutation({
    mutationFn: async (playerId: string) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      if (activePlayers.has(playerId)) throw new Error("Player already checked in");
      const player = players.find(p => p.id === playerId);
      if (player?.status === "blacklist") throw new Error("BLACKLISTED — entry denied");

      const { error } = await supabase.from("casino_visits").insert({
        casino_id: casinoId,
        player_id: playerId,
        date: today,
        checked_in_by: user.id,
        position: "hall",
      });
      if (error) throw error;
      await logAction(casinoId, "player", "PLAYER_CHECKED_IN", { player_id: playerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["casino_visits"] });
      setSelectedPlayer(null);
      setIncompleteWarning(null);
      setQuery("");
      toast.success("Player checked in → In Hall");
    },
    onError: (e) => toast.error(e.message),
  });

  const checkOut = useMutation({
    mutationFn: async (playerId: string) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("casino_visits")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("casino_id", casinoId)
        .eq("player_id", playerId)
        .eq("date", today)
        .is("checked_out_at", null);
      if (error) throw error;
      await logAction(casinoId, "player", "PLAYER_CHECKED_OUT", { player_id: playerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["casino_visits"] });
      setSelectedPlayer(null);
      setIncompleteWarning(null);
      toast.success("Player checked out");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedPlayer(null); setIncompleteWarning(null); }}
          placeholder="Search player or scan RFID..."
          className="pl-10 font-mono text-lg h-12"
          autoFocus
        />
      </div>

      {query && filtered.length > 0 && !selectedPlayer && (
        <div className="cms-panel divide-y divide-border max-h-[400px] overflow-y-auto">
          {filtered.map(p => {
            const isIn = activePlayers.has(p.id);
            const isBlacklisted = p.status === "blacklist";
            const incomplete = isProfileIncomplete(p);
            return (
              <button
                key={p.id}
                onClick={() => handleSelectPlayer(p)}
                className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {p.photo_url ? (
                    <img src={p.photo_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <User className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {p.first_name} {p.last_name}
                    {p.nickname && <span className="text-muted-foreground ml-1">({p.nickname})</span>}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {p.player_cards?.[0]?.card_number || "No card"}
                  </p>
                </div>
                {incomplete.length > 0 && (
                  <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                )}
                {isBlacklisted ? (
                  <Badge variant="destructive" className="shrink-0">BLACKLISTED</Badge>
                ) : isIn ? (
                  <Badge className="bg-primary/15 text-primary border-primary/30 shrink-0">IN</Badge>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {query && filtered.length === 0 && (
        <div className="cms-panel p-8 text-center text-muted-foreground">
          <p>No players found</p>
          <p className="text-xs mt-1">Try a different search or register a new player</p>
        </div>
      )}

      {selectedPlayer && (
        <>
          {/* Incomplete profile warning */}
          {incompleteWarning && incompleteWarning.length > 0 && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-500">Update data required</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Missing: {incompleteWarning.join(", ")}. Player can still enter — please update after check-in.
                </p>
              </div>
            </div>
          )}
          <PlayerConfirmCard
            player={selectedPlayer}
            isCheckedIn={activePlayers.has(selectedPlayer.id)}
            onCheckIn={() => checkIn.mutate(selectedPlayer.id)}
            onCheckOut={() => checkOut.mutate(selectedPlayer.id)}
            onCancel={() => { setSelectedPlayer(null); setIncompleteWarning(null); }}
            isPending={checkIn.isPending || checkOut.isPending}
          />
        </>
      )}
    </div>
  );
};

const PlayerConfirmCard = ({
  player, isCheckedIn, onCheckIn, onCheckOut, onCancel, isPending,
}: {
  player: any;
  isCheckedIn: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onCancel: () => void;
  isPending: boolean;
}) => {
  const isBlacklisted = player.status === "blacklist";

  return (
    <div className={`cms-panel p-6 space-y-4 ${isBlacklisted ? "border-destructive/50 bg-destructive/5" : ""}`}>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {player.photo_url ? (
            <img src={player.photo_url} className="w-full h-full object-cover" alt="" />
          ) : (
            <User className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">
            {player.first_name} {player.last_name}
          </h2>
          {player.nickname && (
            <p className="text-sm text-muted-foreground">"{player.nickname}"</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {isBlacklisted ? (
              <Badge variant="destructive" className="gap-1">
                <Ban className="w-3 h-3" /> BLACKLISTED
              </Badge>
            ) : isCheckedIn ? (
              <Badge className="bg-primary/15 text-primary border-primary/30 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Currently IN
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <XCircle className="w-3 h-3" /> Not in casino
              </Badge>
            )}
          </div>
          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
            <span>Card: {player.player_cards?.[0]?.card_number || "—"}</span>
            <span>Phone: {player.phone || "—"}</span>
          </div>
        </div>
      </div>

      {isBlacklisted && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
          <p className="text-sm font-medium text-destructive flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Entry DENIED — Player is blacklisted
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        {isBlacklisted ? null : isCheckedIn ? (
          <Button onClick={onCheckOut} disabled={isPending} className="flex-1 gap-1.5" variant="secondary">
            <LogOut className="w-4 h-4" /> Check Out
          </Button>
        ) : (
          <Button onClick={onCheckIn} disabled={isPending} className="flex-1 gap-1.5">
            <LogIn className="w-4 h-4" /> Confirm Check-in
          </Button>
        )}
      </div>
    </div>
  );
};

// ============ REGISTER TAB ============
const RegisterTab = () => {
  const { casinoId, user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    first_name: "", last_name: "", nickname: "", phone: "", id_number: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.first_name || !form.last_name || !casinoId || !user) return;
    setSubmitting(true);
    try {
      const { data: player, error } = await supabase
        .from("players")
        .insert({
          casino_id: casinoId,
          first_name: form.first_name,
          last_name: form.last_name,
          nickname: form.nickname,
          phone: form.phone,
          id_number: form.id_number as any,
        })
        .select()
        .single();
      if (error) throw error;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${casinoId}/${player.id}/photo.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("player-documents")
          .upload(path, photoFile, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from("player-documents")
            .getPublicUrl(path);
          await supabase.from("players").update({ photo_url: urlData.publicUrl }).eq("id", player.id);
        }
      }

      for (const doc of docFiles) {
        const ext = doc.name.split(".").pop();
        const path = `${casinoId}/${player.id}/docs/${Date.now()}.${ext}`;
        await supabase.storage.from("player-documents").upload(path, doc);
      }

      const { data: cardNum } = await supabase.rpc("generate_card_number" as any);
      await supabase.from("player_cards").insert({
        player_id: player.id,
        card_number: cardNum || `CMS${Date.now().toString().slice(-6)}+`,
        card_type: "manual",
        issued_by: user.id,
      });

      await logAction(casinoId, "player", "PLAYER_CREATED", {
        player_id: player.id,
        name: `${form.first_name} ${form.last_name}`,
        source: "reception",
      });

      queryClient.invalidateQueries({ queryKey: ["players"] });
      setForm({ first_name: "", last_name: "", nickname: "", phone: "", id_number: "" });
      setPhotoFile(null);
      setDocFiles([]);
      toast.success("Player registered successfully");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <div className="cms-panel p-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">New Player Registration</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">First Name *</label>
            <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Last Name *</label>
            <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Nickname</label>
          <Input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Phone</label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">ID / Passport Number</label>
            <Input value={form.id_number} onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))} placeholder="ID or passport #" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Photo</label>
          <Input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={e => setPhotoFile(e.target.files?.[0] || null)}
            className="text-xs"
          />
          {photoFile && (
            <p className="text-[10px] text-muted-foreground">{photoFile.name}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Document Scans (ID, passport)</label>
          <Input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={e => setDocFiles(Array.from(e.target.files || []))}
            className="text-xs"
          />
          {docFiles.length > 0 && (
            <p className="text-[10px] text-muted-foreground">{docFiles.length} file(s) selected</p>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={!form.first_name || !form.last_name || submitting} className="w-full gap-1.5">
          <UserPlus className="w-4 h-4" /> Register Player
        </Button>
      </div>
    </div>
  );
};

// ============ UPDATE DATA TAB ============
const UpdateDataTab = () => {
  const { casinoId } = useAuth();
  const { data: players = [] } = usePlayers();
  const { data: visits = [] } = useVisitsToday();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "last_visit">("last_visit");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Map player_id -> latest check-in time from today's visits
  const visitMap = useMemo(() => {
    const map = new Map<string, string>();
    visits.forEach((v: any) => {
      const existing = map.get(v.player_id);
      if (!existing || v.checked_in_at > existing) map.set(v.player_id, v.checked_in_at);
    });
    return map;
  }, [visits]);

  const incomplete = useMemo(() => {
    let list = players
      .filter(p => isProfileIncomplete(p).length > 0)
      .map(p => ({
        ...p,
        missing: isProfileIncomplete(p),
        lastVisit: visitMap.get(p.id) || null,
      }));

    // Filter by search
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(p =>
        p.first_name?.toLowerCase().includes(q) ||
        p.last_name?.toLowerCase().includes(q) ||
        p.nickname?.toLowerCase().includes(q) ||
        p.player_cards?.some((c: any) => c.card_number?.includes(query))
      );
    }

    // Sort
    if (sortBy === "last_visit") {
      list.sort((a, b) => {
        if (a.lastVisit && !b.lastVisit) return -1;
        if (!a.lastVisit && b.lastVisit) return 1;
        if (a.lastVisit && b.lastVisit) return b.lastVisit.localeCompare(a.lastVisit);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return list;
  }, [players, query, sortBy, visitMap]);

  const handlePhotoUpload = async (playerId: string, file: File) => {
    if (!casinoId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${casinoId}/${playerId}/photo.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("player-documents")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage
        .from("player-documents")
        .getPublicUrl(path);
      const { error } = await supabase.from("players").update({ photo_url: urlData.publicUrl }).eq("id", playerId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["players"] });
      toast.success("Photo updated");
      setEditingId(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFieldUpdate = async (playerId: string, field: string, value: string) => {
    try {
      const { error } = await supabase.from("players").update({ [field]: value } as any).eq("id", playerId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["players"] });
      toast.success("Updated");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search player..."
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortBy(s => s === "newest" ? "last_visit" : "newest")}
          className="text-xs shrink-0"
        >
          {sortBy === "last_visit" ? "Last Visit ↓" : "Newest ↓"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {incomplete.length} players with incomplete profiles
      </p>

      {incomplete.length === 0 ? (
        <div className="cms-panel p-8 text-center text-muted-foreground">
          {query ? "No matching players" : "All player profiles are complete"}
        </div>
      ) : (
        <div className="cms-panel divide-y divide-border max-h-[600px] overflow-y-auto">
          {incomplete.map(p => (
            <div key={p.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {p.photo_url ? (
                    <img src={p.photo_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <User className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {p.first_name} {p.last_name}
                    {p.nickname && <span className="text-muted-foreground ml-1">({p.nickname})</span>}
                  </p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {p.missing.map((m: string) => (
                      <Badge key={m} variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-500 gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> {m}
                      </Badge>
                    ))}
                    {p.lastVisit && (
                      <span className="text-[10px] text-primary font-mono">IN today</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingId(editingId === p.id ? null : p.id)}
                  className="shrink-0 text-xs gap-1"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Edit
                </Button>
              </div>

              {/* Inline edit panel */}
              {editingId === p.id && (
                <div className="mt-3 ml-13 space-y-3 pl-[52px]">
                  {p.missing.includes("photo") && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Upload Photo</label>
                      <Input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={uploading}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(p.id, file);
                        }}
                        className="text-xs"
                      />
                    </div>
                  )}
                  {p.missing.includes("name") && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">First Name</label>
                        <Input
                          defaultValue={p.first_name}
                          onBlur={e => {
                            if (e.target.value && e.target.value !== p.first_name) handleFieldUpdate(p.id, "first_name", e.target.value);
                          }}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Last Name</label>
                        <Input
                          defaultValue={p.last_name}
                          onBlur={e => {
                            if (e.target.value && e.target.value !== p.last_name) handleFieldUpdate(p.id, "last_name", e.target.value);
                          }}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}
                  {p.missing.includes("ID document") && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">ID / Passport Number</label>
                      <Input
                        defaultValue={p.id_number || ""}
                        onBlur={e => {
                          if (e.target.value) handleFieldUpdate(p.id, "id_number", e.target.value);
                        }}
                        placeholder="Enter ID number"
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reception;
