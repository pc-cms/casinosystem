import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePlayers } from "@/hooks/use-casino-data";
import { logAction } from "@/lib/logging";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import PlayerEditDialog from "@/components/PlayerEditDialog";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import {
  Search, UserPlus, LogIn, LogOut, ShieldAlert, Camera,
  User, Ban, CheckCircle2, XCircle, CreditCard, AlertTriangle, Eye,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import CategoryBadge, { type PlayerCategory } from "@/components/player/CategoryBadge";
import FlagBadges from "@/components/player/FlagBadges";
import { useIsMobile } from "@/hooks/use-mobile";
import { getBusinessDate } from "@/lib/business-day";
import { compressImage, thumbnailPath } from "@/lib/image-compress";

const useVisitsToday = () => {
  const { casinoId } = useAuth();
  const today = getBusinessDate();
  return useQuery({
    queryKey: ["casino-visits-today", casinoId, today],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("casino_visits")
        .select("*, players(first_name, last_name, nickname, photo_url, status, id_number, category, player_type)")
        .eq("casino_id", casinoId)
        .eq("date", today);
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
    refetchInterval: 30000,
    staleTime: 1000 * 15,
  });
};

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
  const isMobile = useIsMobile();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "c" && tab !== "checkin") { e.preventDefault(); setSearchParams({ tab: "checkin" }); }
      else if (key === "r" && tab !== "register") { e.preventDefault(); setSearchParams({ tab: "register" }); }
      else if (key === "u" && tab !== "update") { e.preventDefault(); setSearchParams({ tab: "update" }); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [tab, setSearchParams]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Reception</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Entry control · Player registration</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={v => setSearchParams({ tab: v })}>
        <TabsList className="mb-3 sm:mb-4 w-full sm:w-auto grid grid-cols-3 sm:flex">
          <TabsTrigger value="checkin" className="gap-1 text-xs sm:text-sm">
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Check-in</span>
            <span className="sm:hidden">In/Out</span>
            {!isMobile && <span className="cms-kbd ml-1">C</span>}
          </TabsTrigger>
          <TabsTrigger value="register" className="gap-1 text-xs sm:text-sm">
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Register</span>
            <span className="sm:hidden">New</span>
            {!isMobile && <span className="cms-kbd ml-1">R</span>}
          </TabsTrigger>
          <TabsTrigger value="update" className="gap-1 text-xs sm:text-sm">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Update Data</span>
            <span className="sm:hidden">Update</span>
            {!isMobile && <span className="cms-kbd ml-1">U</span>}
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
  const [profilePlayer, setProfilePlayer] = useState<any>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const today = getBusinessDate();

  const activePlayers = useMemo(() => {
    return new Set(visits.filter(v => !v.checked_out_at).map(v => v.player_id));
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
    const flags = player.player_tags?.map((t: any) => t.tag) || [];
    if (flags.length > 0 && player.status !== "blacklist") {
      toast.warning(`⚠️ Player flagged: ${flags.join(", ")}`, { duration: 5000 });
    }
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
      queryClient.invalidateQueries({ queryKey: ["casino-visits-today"] });
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
      queryClient.invalidateQueries({ queryKey: ["casino-visits-today"] });
      setSelectedPlayer(null);
      setIncompleteWarning(null);
      toast.success("Player checked out");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedPlayer(null); setIncompleteWarning(null); }}
          placeholder="Search player or scan RFID..."
          className="pl-10 font-mono text-base sm:text-lg h-12"
          autoFocus
        />
      </div>

      {query && filtered.length > 0 && !selectedPlayer && (
        <div className="cms-panel divide-y divide-border max-h-[60vh] overflow-y-auto">
          {filtered.map(p => {
            const isIn = activePlayers.has(p.id);
            const isBlacklisted = p.status === "blacklist";
            const incomplete = isProfileIncomplete(p);
            return (
              <button
                key={p.id}
                onClick={() => handleSelectPlayer(p)}
                className="flex items-center gap-2 sm:gap-3 w-full px-3 sm:px-4 py-3 text-left hover:bg-muted/50 transition-colors active:bg-muted"
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
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {p.player_cards?.[0]?.card_number || "No card"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                  <CategoryBadge category={((p as any).category as PlayerCategory) || "guest"} />
                  {incomplete.length > 0 && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
                  {isBlacklisted ? (
                    <Badge variant="destructive" className="text-[10px] shrink-0">BL</Badge>
                  ) : isIn ? (
                    <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] shrink-0">IN</Badge>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {query && filtered.length === 0 && (
        <div className="cms-panel p-6 sm:p-8 text-center text-muted-foreground">
          <p>No players found</p>
          <p className="text-xs mt-1">Try a different search or register a new player</p>
        </div>
      )}

      {selectedPlayer && (
        <>
          {incompleteWarning && incompleteWarning.length > 0 && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-500">Update data required</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Missing: {incompleteWarning.join(", ")}
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
            onViewProfile={() => setProfilePlayer(selectedPlayer)}
            isPending={checkIn.isPending || checkOut.isPending}
          />
        </>
      )}

      <PlayerEditDialog
        player={profilePlayer}
        open={!!profilePlayer}
        onOpenChange={(v) => { if (!v) setProfilePlayer(null); }}
      />
    </div>
  );
};

const PlayerConfirmCard = ({
  player, isCheckedIn, onCheckIn, onCheckOut, onCancel, onViewProfile, isPending,
}: {
  player: any;
  isCheckedIn: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onCancel: () => void;
  onViewProfile: () => void;
  isPending: boolean;
}) => {
  const isBlacklisted = player.status === "blacklist";

  return (
    <div className={`cms-panel p-4 sm:p-6 space-y-3 sm:space-y-4 ${isBlacklisted ? "border-destructive/50 bg-destructive/5" : ""}`}>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {player.photo_url ? (
            <img src={player.photo_url} className="w-full h-full object-cover" alt="" />
          ) : (
            <User className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge category={((player as any).category as PlayerCategory) || "guest"} size="md" />
            <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
              {player.first_name} {player.last_name}
            </h2>
          </div>
          {player.nickname && (
            <p className="text-sm text-muted-foreground truncate">"{player.nickname}"</p>
          )}
          {player.player_tags?.length > 0 && !isBlacklisted && (
            <div className="mt-1">
              <FlagBadges tags={player.player_tags.map((t: any) => t.tag)} compact />
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
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
          <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span>Card: {player.player_cards?.[0]?.card_number || "—"}</span>
            <span>Phone: {player.phone || "—"}</span>
          </div>
        </div>
      </div>

      {isBlacklisted && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
          <p className="text-sm font-medium text-destructive flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Entry DENIED — Blacklisted
          </p>
        </div>
      )}

      <div className="flex gap-2 flex-col sm:flex-row">
        <div className="flex gap-2 flex-1">
          <Button variant="outline" onClick={onCancel} className="flex-1 h-11">Cancel</Button>
          <Button variant="ghost" onClick={onViewProfile} className="h-11 gap-1 shrink-0" size="sm">
            <Eye className="w-4 h-4" /> Profile
          </Button>
        </div>
        {isBlacklisted ? null : isCheckedIn ? (
          <Button onClick={onCheckOut} disabled={isPending} className="flex-1 gap-1.5 h-11" variant="secondary">
            <LogOut className="w-4 h-4" /> Check Out
          </Button>
        ) : (
          <Button onClick={onCheckIn} disabled={isPending} className="flex-1 gap-1.5 h-11">
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
  const isMobile = useIsMobile();
  const [form, setForm] = useState({
    first_name: "", last_name: "", nickname: "", phone: "", id_number: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    } else {
      setPhotoPreview(null);
    }
  };

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
        const compressed = await compressImage(photoFile);
        // Upload thumbnail (fast, used in lists)
        const thumbPath = `${casinoId}/${player.id}/photo_thumb.jpg`;
        await supabase.storage.from("player-photos").upload(thumbPath, compressed.thumbnail, { upsert: true, contentType: "image/jpeg" });
        // Upload original (full quality, used in profile view)
        const origExt = photoFile.name.split(".").pop() || "jpg";
        const origPath = `${casinoId}/${player.id}/photo_original.${origExt}`;
        await supabase.storage.from("player-photos").upload(origPath, compressed.original, { upsert: true });
        // Set photo_url to thumbnail for fast loading
        const { data: urlData } = supabase.storage.from("player-photos").getPublicUrl(thumbPath);
        await supabase.from("players").update({ photo_url: urlData.publicUrl }).eq("id", player.id);
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
      setPhotoPreview(null);
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
      <div className="cms-panel p-4 sm:p-6 space-y-4">
        <h3 className="text-base sm:text-lg font-semibold text-foreground">New Player Registration</h3>

        {/* Photo capture - prominent on mobile */}
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0">
            {photoPreview ? (
              <img src={photoPreview} className="w-full h-full object-cover" alt="" />
            ) : (
              <User className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <label htmlFor="reg-photo" className="cursor-pointer block">
              <Button variant="outline" className="gap-1.5 w-full h-11" asChild>
                <span><Camera className="w-4 h-4" /> {photoFile ? "Retake Photo" : "Take Photo"}</span>
              </Button>
            </label>
            <input
              id="reg-photo"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            {photoFile && (
              <p className="text-[10px] text-muted-foreground truncate">{photoFile.name}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">First Name *</label>
            <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className="h-11" autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Last Name *</label>
            <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className="h-11" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Nickname</label>
          <Input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} className="h-11" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Phone</label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-11" type="tel" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">ID / Passport</label>
            <Input value={form.id_number} onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))} placeholder="ID or passport #" className="h-11" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">ID Document Scan</label>
          <label htmlFor="reg-doc" className="cursor-pointer block">
            <Button variant="outline" className="gap-1.5 w-full h-11" asChild>
              <span><Camera className="w-4 h-4" /> {docFiles.length > 0 ? `${docFiles.length} file(s)` : "Scan Document"}</span>
            </Button>
          </label>
          <input
            id="reg-doc"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={e => setDocFiles(Array.from(e.target.files || []))}
            className="hidden"
          />
        </div>

        <Button onClick={handleSubmit} disabled={!form.first_name || !form.last_name || submitting} className="w-full gap-1.5 h-12 text-base">
          <UserPlus className="w-5 h-5" /> Register Player
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
  const [profilePlayer, setProfilePlayer] = useState<any>(null);
  const isMobile = useIsMobile();

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

    if (query) {
      const q = query.toLowerCase();
      list = list.filter(p =>
        p.first_name?.toLowerCase().includes(q) ||
        p.last_name?.toLowerCase().includes(q) ||
        p.nickname?.toLowerCase().includes(q) ||
        p.player_cards?.some((c: any) => c.card_number?.includes(query))
      );
    }

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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search player..."
            className="pl-10 h-11"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortBy(s => s === "newest" ? "last_visit" : "newest")}
          className="text-xs shrink-0 h-11"
        >
          {sortBy === "last_visit" ? "Visit ↓" : "New ↓"}
        </Button>
      </div>

      <p className="text-xs sm:text-sm text-muted-foreground">
        {incomplete.length} incomplete profiles
      </p>

      {incomplete.length === 0 ? (
        <div className="cms-panel p-6 sm:p-8 text-center text-muted-foreground">
          {query ? "No matching players" : "All profiles complete"}
        </div>
      ) : (
        <div className="cms-panel divide-y divide-border max-h-[65vh] overflow-y-auto">
          {incomplete.map(p => (
            <button
              key={p.id}
              onClick={() => setProfilePlayer(p)}
              className="flex items-center gap-2 sm:gap-3 w-full px-3 sm:px-4 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors"
            >
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
              <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      <PlayerEditDialog
        player={profilePlayer}
        open={!!profilePlayer}
        onOpenChange={(v) => { if (!v) setProfilePlayer(null); }}
      />
    </div>
  );
};

export default Reception;
