import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAction } from "@/lib/logging";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, CheckCircle2, Clock, ArrowUpDown, Eye } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import PlayerEditDialog from "@/components/PlayerEditDialog";
import CategoryBadge, { CATEGORY_PRIORITY, type PlayerCategory } from "@/components/player/CategoryBadge";
import FlagBadges from "@/components/player/FlagBadges";
import CategoryFilter from "@/components/player/CategoryFilter";

type SortKey = "name" | "in" | "out" | "type" | "category";
type TypeFilter = "all" | "slots" | "table" | "mix";

const InCasino = () => {
  const { casinoId, user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [sortKey, setSortKey] = useState<SortKey>("category");
  const [sortAsc, setSortAsc] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<Set<PlayerCategory>>(new Set(["diamond", "platinum", "gold", "guest"]));
  const [profilePlayer, setProfilePlayer] = useState<any>(null);

  const { data: visits = [] } = useQuery({
    queryKey: ["casino_visits", casinoId, today],
    queryFn: async () => {
      if (!casinoId) return [];
      const { data, error } = await supabase
        .from("casino_visits")
        .select("*, players(id, first_name, last_name, nickname, photo_url, status, player_type, phone, id_number, id_document_url, category)")
        .eq("casino_id", casinoId)
        .eq("date", today)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!casinoId,
    refetchInterval: 10000,
  });

  // Fetch tags for all players in visits
  const playerIds = useMemo(() => visits.map(v => v.player_id), [visits]);
  const { data: allTags = [] } = useQuery({
    queryKey: ["player_tags_guests", playerIds],
    queryFn: async () => {
      if (playerIds.length === 0) return [];
      const { data } = await supabase.from("player_tags").select("player_id, tag").in("player_id", playerIds);
      return data || [];
    },
    enabled: playerIds.length > 0,
  });

  const tagsByPlayer = useMemo(() => {
    const map = new Map<string, string[]>();
    allTags.forEach(t => {
      const list = map.get(t.player_id) || [];
      list.push(t.tag);
      map.set(t.player_id, list);
    });
    return map;
  }, [allTags]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sortFn = (a: any, b: any) => {
    const pA = a.players as any;
    const pB = b.players as any;
    let cmp = 0;
    switch (sortKey) {
      case "category": {
        const catA = (pA?.category as PlayerCategory) || "guest";
        const catB = (pB?.category as PlayerCategory) || "guest";
        cmp = CATEGORY_PRIORITY[catA] - CATEGORY_PRIORITY[catB];
        if (cmp === 0) {
          const nA = `${pA?.first_name || ""} ${pA?.last_name || ""}`.toLowerCase();
          const nB = `${pB?.first_name || ""} ${pB?.last_name || ""}`.toLowerCase();
          cmp = nA.localeCompare(nB);
        }
        break;
      }
      case "name": {
        const nA = `${pA?.first_name || ""} ${pA?.last_name || ""}`.toLowerCase();
        const nB = `${pB?.first_name || ""} ${pB?.last_name || ""}`.toLowerCase();
        cmp = nA.localeCompare(nB);
        break;
      }
      case "in":
        cmp = new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime();
        break;
      case "out":
        cmp = (a.checked_out_at ? new Date(a.checked_out_at).getTime() : 0) - (b.checked_out_at ? new Date(b.checked_out_at).getTime() : 0);
        break;
      case "type":
        cmp = (pA?.player_type || "").localeCompare(pB?.player_type || "");
        break;
    }
    return sortAsc ? cmp : -cmp;
  };

  const filterVisits = (list: any[]) => {
    let result = list;
    if (typeFilter !== "all") result = result.filter(v => (v.players as any)?.player_type === typeFilter);
    result = result.filter(v => {
      const cat = ((v.players as any)?.category as PlayerCategory) || "guest";
      return categoryFilter.has(cat);
    });
    return result;
  };

  const stillIn = useMemo(() => filterVisits(visits.filter(v => !v.checked_out_at)).sort(sortFn), [visits, sortKey, sortAsc, typeFilter, categoryFilter, allTags]);
  const checkedOut = useMemo(() => filterVisits(visits.filter(v => !!v.checked_out_at)).sort(sortFn), [visits, sortKey, sortAsc, typeFilter, categoryFilter, allTags]);

  const confirmExit = useMutation({
    mutationFn: async (visitId: string) => {
      if (!casinoId) throw new Error("No casino");
      const visit = visits.find(v => v.id === visitId);
      if (!visit) throw new Error("Visit not found");
      if (visit.checked_out_at) return;
      const { error } = await supabase
        .from("casino_visits")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("id", visitId);
      if (error) throw error;
      await logAction(casinoId, "player", "PLAYER_EXIT_CONFIRMED", { visit_id: visitId, player_id: visit.player_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["casino_visits"] });
      toast.success("Exit confirmed");
    },
    onError: (e) => toast.error(e.message),
  });

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <Button variant={sortKey === k ? "secondary" : "ghost"} size="sm" className="text-xs gap-1 h-7" onClick={() => toggleSort(k)}>
      {label}
      {sortKey === k && <ArrowUpDown className="w-3 h-3" />}
    </Button>
  );

  const typeLabels: Record<string, string> = { slots: "Slots", table: "Table", mix: "Mix" };
  const TypeBadge = ({ type }: { type: string }) => {
    const colors: Record<string, string> = {
      slots: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      table: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      mix: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    };
    return <Badge className={`${colors[type] || ""} text-[10px] shrink-0`}>{typeLabels[type] || type}</Badge>;
  };

  const VisitRow = ({ visit, showOut }: { visit: any; showOut?: boolean }) => {
    const p = visit.players as any;
    if (!p) return null;
    const category = (p.category as PlayerCategory) || "guest";
    const tags = tagsByPlayer.get(p.id) || [];
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {p.photo_url ? (
            <img src={p.photo_url} className="w-full h-full object-cover" alt="" />
          ) : (
            <User className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <CategoryBadge category={category} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {p.first_name} {p.last_name}
            {p.nickname && <span className="text-muted-foreground ml-1">({p.nickname})</span>}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {showOut ? (
              <>
                <span>In: {format(new Date(visit.checked_in_at), "HH:mm")}</span>
                <span>→ Out: {format(new Date(visit.checked_out_at!), "HH:mm")}</span>
              </>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                <span>In at {format(new Date(visit.checked_in_at), "HH:mm")}</span>
                <span>· {formatDistanceToNow(new Date(visit.checked_in_at), { addSuffix: false })}</span>
              </>
            )}
          </div>
        </div>
        <FlagBadges tags={tags} compact />
        {p.player_type && <TypeBadge type={p.player_type} />}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs shrink-0 gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => setProfilePlayer(p)}
        >
          <Eye className="w-3 h-3" /> Profile
        </Button>
        {!showOut && (
          <>
            <Badge className="bg-primary/15 text-primary border-primary/30 shrink-0 gap-1">
              <CheckCircle2 className="w-3 h-3" /> {visit.position?.toUpperCase() || "HALL"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="text-xs shrink-0 gap-1"
              onClick={() => confirmExit.mutate(visit.id)}
              disabled={confirmExit.isPending}
            >
              <LogOut className="w-3 h-3" /> Check Out
            </Button>
          </>
        )}
        {showOut && (
          <Badge variant="outline" className="shrink-0 text-xs gap-1">
            <LogOut className="w-3 h-3" /> OUT
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Guests</h1>
        <p className="text-sm text-muted-foreground">
          {stillIn.length} currently inside · {checkedOut.length} checked out today
        </p>
      </div>

      {/* Sort & Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground mr-1">Sort:</span>
        <SortBtn k="category" label="Category" />
        <SortBtn k="name" label="Name" />
        <SortBtn k="in" label="Check-in" />
        <SortBtn k="out" label="Check-out" />
        <SortBtn k="type" label="Type" />
        <div className="w-px h-5 bg-border mx-1" />
        <span className="text-xs text-muted-foreground mr-1">Type:</span>
        {(["all", "slots", "table", "mix"] as TypeFilter[]).map(t => (
          <Button key={t} variant={typeFilter === t ? "secondary" : "ghost"} size="sm" className="text-xs h-7" onClick={() => setTypeFilter(t)}>
            {t === "all" ? "All" : typeLabels[t]}
          </Button>
        ))}
        <div className="w-px h-5 bg-border mx-1" />
        <span className="text-xs text-muted-foreground mr-1">Category:</span>
        <CategoryFilter selected={categoryFilter} onChange={setCategoryFilter} />
      </div>

      {stillIn.length === 0 && checkedOut.length === 0 ? (
        <div className="cms-panel p-8 text-center text-muted-foreground">No visitors today</div>
      ) : (
        <div className="space-y-4">
          {stillIn.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Currently Inside</h3>
              <div className="cms-panel divide-y divide-border">
                {stillIn.map(visit => <VisitRow key={visit.id} visit={visit} />)}
              </div>
            </div>
          )}
          {checkedOut.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Checked Out</h3>
              <div className="cms-panel divide-y divide-border opacity-70">
                {checkedOut.map(visit => <VisitRow key={visit.id} visit={visit} showOut />)}
              </div>
            </div>
          )}
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

export default InCasino;
