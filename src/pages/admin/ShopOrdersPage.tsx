import { Package, Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format-date";

const fmt = (n: number) => (n ?? 0).toLocaleString("fr-FR").replace(/,/g, " ");

const ShopOrdersPage = () => {
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["shop_orders_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_orders")
        .select("*, shop_items(name), players(first_name, last_name)")
        .order("ordered_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "issued" | "cancelled" }) => {
      const patch: any = { status };
      if (status === "issued") {
        patch.fulfilled_at = new Date().toISOString();
        patch.fulfilled_by = (await supabase.auth.getUser()).data.user?.id;
      } else {
        patch.cancelled_at = new Date().toISOString();
        patch.cancelled_by = (await supabase.auth.getUser()).data.user?.id;
      }
      const { error } = await supabase.from("shop_orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "issued" ? "Order issued" : "Order cancelled");
      qc.invalidateQueries({ queryKey: ["shop_orders_admin"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const queued = orders.filter((o: any) => o.status === "queued");
  const history = orders.filter((o: any) => o.status !== "queued");

  const renderTable = (rows: any[], showActions: boolean) => (
    <DataTable>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-xs uppercase">
            <th className="text-left p-2">Ordered</th>
            <th className="text-left p-2">Player</th>
            <th className="text-left p-2">Item</th>
            <th className="text-right p-2">Qty</th>
            <th className="text-right p-2">Total</th>
            <th className="text-left p-2">Status</th>
            {showActions && <th className="text-right p-2">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={showActions ? 7 : 6} className="p-4 text-center text-muted-foreground">No orders</td></tr>}
          {rows.map((o) => (
            <tr key={o.id} className="border-b border-border/50 hover:bg-muted/20">
              <td className="p-2 text-xs text-muted-foreground">{fmtDateTime(o.ordered_at)}</td>
              <td className="p-2">{o.players ? `${o.players.first_name ?? ""} ${o.players.last_name ?? ""}`.trim() : "—"}</td>
              <td className="p-2">{o.shop_items?.name ?? "—"}</td>
              <td className="p-2 text-right font-mono">{o.qty}</td>
              <td className="p-2 text-right font-mono">{fmt(o.total_credits)}</td>
              <td className="p-2">
                <Badge variant={o.status === "queued" ? "default" : o.status === "issued" ? "secondary" : "destructive"} className="text-xs">
                  {o.status}
                </Badge>
              </td>
              {showActions && (
                <td className="p-2 text-right space-x-1">
                  <Button size="sm" onClick={() => setStatus.mutate({ id: o.id, status: "issued" })} disabled={setStatus.isPending}>
                    <Check className="size-3.5" /> Issue
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: o.id, status: "cancelled" })} disabled={setStatus.isPending}>
                    <X className="size-3.5" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </DataTable>
  );

  return (
    <PageShell>
      <PageHeader icon={Package} title="Shop Orders" subtitle="Player rewards fulfilment queue" />
      <PageSection title={`Queued (${queued.length})`} bodyClassName="p-0">
        {isLoading ? <div className="p-4 text-center text-muted-foreground">Loading…</div> : renderTable(queued, true)}
      </PageSection>
      <PageSection title="History" bodyClassName="p-0">
        {renderTable(history, false)}
      </PageSection>
    </PageShell>
  );
};

export default ShopOrdersPage;
