/**
 * Pitbook — communication channel between CCTV and Pit/Manager.
 * - CCTV posts observations (text + optional player/table tag).
 * - Pit / Manager see the feed and can acknowledge entries.
 * - Realtime updates via use-cctv-observations.
 */
import { useMemo, useState } from "react";
import { MessageSquare, Check, User as UserIcon, Table2, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCctvObservations,
  useCreateObservation,
  useAcknowledgeObservation,
} from "@/hooks/use-cctv-observations";
import { usePlayers, useGamingTables } from "@/hooks/use-casino-data";
import { toast } from "sonner";

const Pitbook = () => {
  const { roles, user } = useAuth();
  const isCctv = roles.includes("surveillance");
  const isManager = roles.includes("manager") || roles.includes("floor_manager") || roles.includes("super_admin");
  const isPit = roles.includes("pit");
  const canPost = isCctv || isManager;
  const canAck = isPit || isManager;

  const { data: observations = [], isLoading } = useCctvObservations(7);
  const createMut = useCreateObservation();
  const ackMut = useAcknowledgeObservation();

  const { data: players = [] } = usePlayers();
  const { data: tables = [] } = useGamingTables();

  const playerMap = useMemo(() => new Map(players.map((p: any) => [p.id, p])), [players]);
  const tableMap = useMemo(() => new Map(tables.map((t: any) => [t.id, t])), [tables]);

  const [content, setContent] = useState("");
  const [subjectType, setSubjectType] = useState<"general" | "player" | "table">("general");
  const [subjectId, setSubjectId] = useState<string>("");

  const handleSubmit = async () => {
    if (!content.trim()) return;
    try {
      await createMut.mutateAsync({
        content: content.trim(),
        subject_type: subjectType,
        player_id: subjectType === "player" ? subjectId || null : null,
        table_id: subjectType === "table" ? subjectId || null : null,
      });
      setContent("");
      setSubjectId("");
      setSubjectType("general");
      toast.success("Observation posted");
    } catch (e: any) {
      toast.error(e.message || "Failed to post");
    }
  };

  const handleAck = async (id: string) => {
    try {
      await ackMut.mutateAsync(id);
      toast.success("Acknowledged");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  const newCount = observations.filter(o => !o.acknowledged_at).length;

  return (
    <PageShell>
      <PageHeader
        icon={MessageSquare}
        title="Pitbook"
        subtitle="CCTV ↔ Pit communication · Last 7 days"
      >
        {newCount > 0 && (
          <Badge variant="default" className="text-[10px]">
            {newCount} new
          </Badge>
        )}
      </PageHeader>

      {canPost && (
        <PageSection title="New observation">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={subjectType} onValueChange={(v: any) => { setSubjectType(v); setSubjectId(""); }}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="player">Player</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                </SelectContent>
              </Select>

              {subjectType === "player" && (
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger className="w-64 h-9">
                    <SelectValue placeholder="Pick player…" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.slice(0, 200).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}{p.nickname ? ` "${p.nickname}"` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {subjectType === "table" && (
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="Pick table…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Textarea
              placeholder="Type observation for Pit…"
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={3}
              className="text-sm"
            />

            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={!content.trim() || createMut.isPending || (subjectType !== "general" && !subjectId)}
              >
                Post observation
              </Button>
            </div>
          </div>
        </PageSection>
      )}

      <PageSection title={`Feed (${observations.length})`} card={false}>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
        ) : observations.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground text-sm">
            No observations in the last 7 days.
          </div>
        ) : (
          <div className="space-y-2">
            {observations.map(o => {
              const acked = !!o.acknowledged_at;
              const isMine = o.observer_id === user?.id;
              const player = o.player_id ? playerMap.get(o.player_id) : null;
              const table = o.table_id ? tableMap.get(o.table_id) : null;
              return (
                <div
                  key={o.id}
                  className={`rounded-md border p-3 transition-colors ${
                    acked
                      ? "border-border bg-muted/30"
                      : "border-primary/40 bg-primary/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground font-mono">
                      <span>
                        {new Date(o.created_at).toLocaleString("en-GB", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      {o.subject_type === "player" && player && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <UserIcon className="w-3 h-3" />
                          {player.first_name} {player.last_name}
                        </Badge>
                      )}
                      {o.subject_type === "table" && table && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Table2 className="w-3 h-3" />
                          {table.name}
                        </Badge>
                      )}
                      {o.subject_type === "general" && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <MessageCircle className="w-3 h-3" />
                          General
                        </Badge>
                      )}
                      {isMine && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                    </div>
                    {acked ? (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Check className="w-3 h-3" /> Read
                      </Badge>
                    ) : canAck ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-[10px]"
                        onClick={() => handleAck(o.id)}
                        disabled={ackMut.isPending}
                      >
                        <Check className="w-3 h-3" /> Acknowledge
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">New</Badge>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{o.content}</p>
                </div>
              );
            })}
          </div>
        )}
      </PageSection>
    </PageShell>
  );
};

export default Pitbook;
