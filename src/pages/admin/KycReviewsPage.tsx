import { useState } from "react";
import { ShieldCheck, Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format-date";

const KycReviewsPage = () => {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<{ id: string; approve: boolean } | null>(null);
  const [notes, setNotes] = useState("");

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["kyc_reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_reviews")
        .select("id, player_id, casino_id, source, status, ai_result, am_decision_at, am_notes, created_at, players(full_name, phone)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  const decide = useMutation({
    mutationFn: async () => {
      if (!decision) return;
      const { error } = await supabase.rpc("kyc_decide", {
        p_review_id: decision.id,
        p_approve: decision.approve,
        p_notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(decision?.approve ? "Approved" : "Rejected — bonus reversed");
      setDecision(null);
      setNotes("");
      qc.invalidateQueries({ queryKey: ["kyc_reviews"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const pending = reviews.filter((r) => r.status === "pending");
  const decided = reviews.filter((r) => r.status !== "pending");

  return (
    <PageShell>
      <PageHeader icon={ShieldCheck} title="KYC Reviews" subtitle="Approve or reject player verifications" />

      <PageSection title={`Pending (${pending.length})`} bodyClassName="p-0">
        <DataTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs uppercase">
                <th className="text-left p-2">Player</th>
                <th className="text-left p-2">Phone</th>
                <th className="text-left p-2">Source</th>
                <th className="text-left p-2">AI</th>
                <th className="text-left p-2">Submitted</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && pending.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No pending reviews</td></tr>}
              {pending.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="p-2 font-medium">{r.players?.full_name ?? "—"}</td>
                  <td className="p-2 text-xs">{r.players?.phone ?? "—"}</td>
                  <td className="p-2"><Badge variant="outline" className="text-xs">{r.source}</Badge></td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {r.ai_result ? (r.ai_result.confidence ? `${(r.ai_result.confidence * 100).toFixed(0)}%` : "✓") : "—"}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="outline" className="mr-2" onClick={() => setDecision({ id: r.id, approve: true })}>
                      <Check className="size-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDecision({ id: r.id, approve: false })}>
                      <X className="size-3.5" /> Reject
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </PageSection>

      <PageSection title="History" bodyClassName="p-0">
        <DataTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs uppercase">
                <th className="text-left p-2">Player</th>
                <th className="text-left p-2">Source</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Decided</th>
                <th className="text-left p-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {decided.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No history</td></tr>}
              {decided.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="p-2">{r.players?.full_name ?? "—"}</td>
                  <td className="p-2 text-xs">{r.source}</td>
                  <td className="p-2">
                    <Badge variant={r.status === "approved" ? "default" : "destructive"} className="text-xs">{r.status}</Badge>
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">{r.am_decision_at ? fmtDateTime(r.am_decision_at) : "—"}</td>
                  <td className="p-2 text-xs">{r.am_notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTable>
      </PageSection>

      <ResponsiveDialog
        open={!!decision}
        onOpenChange={(o) => !o && setDecision(null)}
        title={decision?.approve ? "Approve verification" : "Reject verification"}
        description={decision?.approve ? "Confirm approval." : "Rejecting will reverse any verification bonus already credited."}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes (optional)</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason / reference" />
        </div>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => setDecision(null)}>Cancel</Button>
          <Button
            variant={decision?.approve ? "default" : "destructive"}
            onClick={() => decide.mutate()}
            disabled={decide.isPending}
          >
            {decide.isPending ? "Saving…" : decision?.approve ? "Approve" : "Reject"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialog>
    </PageShell>
  );
};

export default KycReviewsPage;
