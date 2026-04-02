import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { cacheBlacklist, getCachedBlacklist, getLocalPhotoUrl } from "@/lib/blacklist-cache";

const BlacklistPhoto = ({ playerId, photoUrl }: { playerId: string; photoUrl: string | null }) => {
  const [src, setSrc] = useState<string | null>(photoUrl);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!photoUrl) {
      // Try local cache
      getLocalPhotoUrl(playerId).then(url => {
        if (url) setSrc(url);
      });
    }
  }, [playerId, photoUrl]);

  if (!src) {
    return <Ban className="w-5 h-5 text-destructive" />;
  }

  return (
    <>
      {!loaded && <Ban className="w-5 h-5 text-destructive absolute" />}
      <img
        src={src}
        className={`w-full h-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
        alt=""
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          // Fallback to local cache
          getLocalPhotoUrl(playerId).then(url => {
            if (url) setSrc(url);
            else setLoaded(true);
          });
        }}
      />
    </>
  );
};

const Blacklist = () => {
  const { casinoId } = useAuth();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<{ player: any; action: "blacklist" | "reactivate" } | null>(null);

  const { data: players = [] } = useQuery({
    queryKey: ["players", casinoId],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("casino_id", casinoId)
        .order("last_name");
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
  });

  const blacklisted = useMemo(
    () => players.filter(p => p.status === "blacklist"),
    [players]
  );

  // Cache blacklist for offline access
  useEffect(() => {
    if (blacklisted.length > 0) {
      cacheBlacklist(
        blacklisted.map(p => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          nickname: p.nickname || "",
          photo_url: p.photo_url,
          hasLocalPhoto: false,
        }))
      );
    }
  }, [blacklisted]);

  // On mount, try to load from cache if offline
  const [cachedPlayers, setCachedPlayers] = useState<any[]>([]);
  useEffect(() => {
    if (!navigator.onLine || players.length === 0) {
      getCachedBlacklist().then(cached => {
        if (cached.length > 0 && blacklisted.length === 0) {
          setCachedPlayers(cached);
        }
      });
    }
  }, [blacklisted.length, players.length]);

  const displayList = blacklisted.length > 0 ? blacklisted : cachedPlayers;

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
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Blacklist</h1>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">{displayList.length} blacklisted players</p>
          {!navigator.onLine && cachedPlayers.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
              Offline cache
            </span>
          )}
        </div>
      </div>

      {displayList.length === 0 ? (
        <div className="cms-panel p-8 text-center text-muted-foreground">No blacklisted players</div>
      ) : (
        <div className="cms-panel divide-y divide-border">
          {displayList.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center overflow-hidden shrink-0 relative">
                <BlacklistPhoto playerId={p.id} photoUrl={p.photo_url} />
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
                disabled={!navigator.onLine}
              >
                Reactivate
              </Button>
            </div>
          ))}
        </div>
      )}

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

export default Blacklist;
