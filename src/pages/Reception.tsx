import { useState, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import {
  Search, UserPlus, LogIn, LogOut, ShieldAlert, Camera, Clock,
  User, Ban, CheckCircle2, XCircle, Grid3X3, CreditCard,
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
          <TabsTrigger value="active" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Active
          </TabsTrigger>
          <TabsTrigger value="register" className="gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Register
          </TabsTrigger>
          <TabsTrigger value="blacklist" className="gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Blacklist
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1.5">
            <Grid3X3 className="w-3.5 h-3.5" /> CCTV
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkin"><CheckInTab /></TabsContent>
        <TabsContent value="active"><ActivePlayersTab /></TabsContent>
        <TabsContent value="register"><RegisterTab /></TabsContent>
        <TabsContent value="blacklist"><BlacklistTab /></TabsContent>
        <TabsContent value="catalog"><CCTVCatalog /></TabsContent>
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

  const checkIn = useMutation({
    mutationFn: async (playerId: string) => {
      if (!casinoId || !user) throw new Error("Not authenticated");
      // Check not already in
      if (activePlayers.has(playerId)) throw new Error("Player already checked in");
      // Check not blacklisted
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
      setQuery("");
      toast.success("Player checked in");
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
      toast.success("Player checked out");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedPlayer(null); }}
          placeholder="Search player or scan RFID..."
          className="pl-10 font-mono text-lg h-12"
          autoFocus
        />
      </div>

      {/* Search results */}
      {query && filtered.length > 0 && !selectedPlayer && (
        <div className="cms-panel divide-y divide-border max-h-[400px] overflow-y-auto">
          {filtered.map(p => {
            const isIn = activePlayers.has(p.id);
            const isBlacklisted = p.status === "blacklist";
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlayer(p)}
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

      {/* Selected player confirmation */}
      {selectedPlayer && (
        <PlayerConfirmCard
          player={selectedPlayer}
          isCheckedIn={activePlayers.has(selectedPlayer.id)}
          onCheckIn={() => checkIn.mutate(selectedPlayer.id)}
          onCheckOut={() => checkOut.mutate(selectedPlayer.id)}
          onCancel={() => setSelectedPlayer(null)}
          isPending={checkIn.isPending || checkOut.isPending}
        />
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
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1">
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

// ============ ACTIVE PLAYERS TAB ============
const ActivePlayersTab = () => {
  const { data: visits = [] } = useVisitsToday();
  const { casinoId, user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const activeVisits = useMemo(
    () => visits.filter(v => !v.checked_out_at),
    [visits]
  );

  const checkOut = useMutation({
    mutationFn: async (playerId: string) => {
      if (!casinoId) throw new Error("No casino");
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
      toast.success("Player checked out");
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{activeVisits.length} players currently in casino</p>
      </div>

      {activeVisits.length === 0 ? (
        <div className="cms-panel p-8 text-center text-muted-foreground">No players currently in casino</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {activeVisits.map(visit => {
            const p = visit.players as any;
            if (!p) return null;
            return (
              <div key={visit.id} className="cms-panel p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {p.photo_url ? (
                      <img src={p.photo_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <User className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      In since {format(new Date(visit.checked_in_at), "HH:mm")} · {formatDistanceToNow(new Date(visit.checked_in_at), { addSuffix: false })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1 text-xs"
                  onClick={() => checkOut.mutate(visit.player_id)}
                  disabled={checkOut.isPending}
                >
                  <LogOut className="w-3 h-3" /> Check Out
                </Button>
              </div>
            );
          })}
        </div>
      )}
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
      // Create player
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

      // Upload photo
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

      // Upload document scans
      for (const doc of docFiles) {
        const ext = doc.name.split(".").pop();
        const path = `${casinoId}/${player.id}/docs/${Date.now()}.${ext}`;
        await supabase.storage.from("player-documents").upload(path, doc);
      }

      // Generate card
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

// ============ BLACKLIST TAB ============
const BlacklistTab = () => {
  const { data: players = [] } = usePlayers();
  const { isManager } = useAuth();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<{ player: any; action: "blacklist" | "reactivate" } | null>(null);

  const blacklisted = useMemo(
    () => players.filter(p => p.status === "blacklist"),
    [players]
  );

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "blacklist" }) => {
      const { error } = await supabase.from("players").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      toast.success("Player status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{blacklisted.length} blacklisted players</p>

      {blacklisted.length === 0 ? (
        <div className="cms-panel p-8 text-center text-muted-foreground">No blacklisted players</div>
      ) : (
        <div className="cms-panel divide-y divide-border">
          {blacklisted.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center overflow-hidden shrink-0">
                {p.photo_url ? (
                  <img src={p.photo_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <Ban className="w-5 h-5 text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{p.first_name} {p.last_name}</p>
                <p className="text-xs text-muted-foreground">{p.nickname || "—"}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs shrink-0"
                onClick={() => setPendingAction({ player: p, action: "reactivate" })}
              >
                Reactivate
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Manager override for blacklist changes */}
      <ManagerOverrideDialog
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction) {
            updateStatus.mutate({
              id: pendingAction.player.id,
              status: pendingAction.action === "blacklist" ? "blacklist" : "active",
            });
          }
          setPendingAction(null);
        }}
        title={pendingAction?.action === "blacklist" ? "Blacklist Player" : "Reactivate Player"}
        description="Manager authentication required to change blacklist status."
        actionType="CHANGE_PLAYER_STATUS"
        actionDetails={{
          player_id: pendingAction?.player?.id,
          player_name: pendingAction ? `${pendingAction.player.first_name} ${pendingAction.player.last_name}` : "",
          new_status: pendingAction?.action === "blacklist" ? "blacklist" : "active",
        }}
      />
    </div>
  );
};

// ============ CCTV CATALOG ============
const CCTVCatalog = () => {
  const { data: players = [] } = usePlayers();

  const blacklisted = useMemo(
    () => players.filter(p => p.status === "blacklist"),
    [players]
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Visual blacklist identification · {blacklisted.length} entries
      </p>

      {blacklisted.length === 0 ? (
        <div className="cms-panel p-8 text-center text-muted-foreground">No blacklisted players</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {blacklisted.map(p => (
            <div key={p.id} className="cms-panel overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {p.photo_url ? (
                  <img src={p.photo_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              <div className="p-2 text-center">
                <p className="text-sm font-medium text-foreground truncate">
                  {p.first_name} {p.last_name}
                </p>
                <Badge variant="destructive" className="text-[9px] mt-1">BLACKLISTED</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reception;
