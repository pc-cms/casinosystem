import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import ManagerOverrideDialog from "@/components/ManagerOverrideDialog";
import { Ban, ShieldAlert, UserCheck } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "sonner";
import { cacheBlacklist, getCachedBlacklist, getLocalPhotoUrl } from "@/lib/blacklist-cache";

const BlacklistPhoto = ({ playerId, photoUrl }: { playerId: string; photoUrl: string | null }) => {
  const [src, setSrc] = useState<string | null>(photoUrl);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!photoUrl) {
      getLocalPhotoUrl(playerId).then(url => { if (url) setSrc(url); });
    }
  }, [playerId, photoUrl]);

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-destructive/10">
        <Ban className="w-12 h-12 text-destructive" />
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
          <Ban className="w-12 h-12 text-destructive" />
        </div>
      )}
      <img
        src={src}
        className={`w-full h-full object-cover transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
        alt=""
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
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
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<{ player: any; action: "blacklist" | "reactivate" } | null>(null);

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("last_name");
      if (error) throw error;
      return data;
    },
  });

  const blacklisted = useMemo(
    () => players.filter(p => p.status === "blacklist"),
    [players]
  );

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

  const [cachedPlayers, setCachedPlayers] = useState<any[]>([]);
  useEffect(() => {
    if (!navigator.onLine || players.length === 0) {
      getCachedBlacklist().then(cached => {
        if (cached.length > 0 && blacklisted.length === 0) setCachedPlayers(cached);
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
    <PageShell>
      <PageHeader
        icon={ShieldAlert}
        title="Blacklist"
        subtitle={`${displayList.length} blacklisted${!navigator.onLine && cachedPlayers.length > 0 ? " · Offline cache" : ""}`}
        date
      />

      {displayList.length === 0 ? (
        <div className="cms-panel p-8 text-center text-muted-foreground">No blacklisted players</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {displayList.map(p => (
            <div
              key={p.id}
              className="rounded-md border-2 border-destructive bg-destructive/5 dark:bg-destructive/10 overflow-hidden flex flex-col"
            >
              <div className="relative w-full aspect-square ring-2 ring-destructive ring-inset overflow-hidden bg-destructive/10">
                <BlacklistPhoto playerId={p.id} photoUrl={p.photo_url} />
                <div className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                  <Ban className="w-2.5 h-2.5" /> BL
                </div>
              </div>
              <div className="p-2 space-y-1.5">
                <div>
                  <p className="text-sm font-bold text-foreground leading-tight truncate">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{p.nickname || "—"}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs gap-1"
                  onClick={() => setPendingAction({ player: p, action: "reactivate" })}
                  disabled={!navigator.onLine}
                >
                  <UserCheck className="w-3 h-3" /> Reactivate
                </Button>
              </div>
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
    </PageShell>
  );
};

export default Blacklist;
