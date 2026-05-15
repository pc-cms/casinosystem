/**
 * PendingServersPanel — список заявок от on-prem серверов.
 * Super admin аппрувит/реджектит, выбирая казино.
 */
import { useState } from "react";
import { usePendingServers, approveServer, rejectServer, type PendingServer } from "@/hooks/use-pending-servers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, CheckCircle2, XCircle, Clock, KeyRound } from "lucide-react";
import { toast } from "sonner";

const fmtTime = (ts: string | null) => ts
  ? new Date(ts).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "—";

const useCasinosList = () => useQuery({
  queryKey: ["all-casinos-list"],
  queryFn: async () => {
    const { data } = await supabase.from("casinos").select("id, name, slug").order("name");
    return data ?? [];
  },
});

const StatusBadge = ({ s }: { s: PendingServer["status"] }) => {
  const map: Record<PendingServer["status"], { v: "default" | "destructive" | "secondary" | "outline"; label: string }> = {
    pending: { v: "outline", label: "pending" },
    approved: { v: "default", label: "approved" },
    rejected: { v: "destructive", label: "rejected" },
    expired: { v: "secondary", label: "expired" },
    consumed: { v: "default", label: "consumed ✓" },
  };
  const { v, label } = map[s];
  return <Badge variant={v} className="text-[10px]">{label}</Badge>;
};

const Row = ({ row, casinos }: { row: PendingServer; casinos: { id: string; name: string }[] }) => {
  const [casinoId, setCasinoId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const onApprove = async () => {
    if (!casinoId) return toast.error("Select casino first");
    setBusy(true);
    try { await approveServer(row.id, casinoId); toast.success("Server approved"); }
    catch (e) { toast.error(`Approve failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };
  const onReject = async () => {
    setBusy(true);
    try { await rejectServer(row.id); toast.success("Server rejected"); }
    catch (e) { toast.error(`Reject failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  const sys = row.system_info as { ubuntu?: string; ram_gb?: number; disk_gb?: number; docker?: string } | null;

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-3 py-2">
        <div className="font-mono text-base font-bold tracking-wider">{row.pairing_code ? `${row.pairing_code.slice(0, 4)}-${row.pairing_code.slice(4)}` : "—"}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3" />expires {fmtTime(row.expires_at)}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="font-medium">{row.server_name}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{row.hostname ?? "—"}</div>
      </td>
      <td className="px-3 py-2 font-mono text-xs">{row.server_ip ?? "—"}</td>
      <td className="px-3 py-2 text-[10px] text-muted-foreground">
        {sys?.ubuntu && <div>Ubuntu {sys.ubuntu}</div>}
        {sys?.ram_gb && <div>{sys.ram_gb} GB RAM</div>}
        {sys?.disk_gb && <div>{sys.disk_gb} GB disk</div>}
        {sys?.docker && <div>Docker {sys.docker}</div>}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{fmtTime(row.created_at)}</td>
      <td className="px-3 py-2"><StatusBadge s={row.status} /></td>
      <td className="px-3 py-2">
        {row.status === "pending" ? (
          <div className="flex items-center gap-2">
            <Select value={casinoId} onValueChange={setCasinoId}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Bind to casino" /></SelectTrigger>
              <SelectContent>
                {casinos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="default" disabled={busy || !casinoId} onClick={onApprove} className="h-8 gap-1">
              <CheckCircle2 className="w-3 h-3" />Approve
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={onReject} className="h-8 gap-1">
              <XCircle className="w-3 h-3" />Reject
            </Button>
          </div>
        ) : row.status === "approved" ? (
          <span className="text-xs text-emerald-500">Awaiting server pickup…</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
};

export const PendingServersPanel = () => {
  const { data: rows = [] } = usePendingServers();
  const { data: casinos = [] } = useCasinosList();

  return (
    <div className="cms-panel p-4">
      <div className="flex items-center gap-2 mb-3">
        <KeyRound className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-card-foreground">Pending Server Registrations</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">realtime</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2">Pairing code</th>
              <th className="text-left px-3 py-2">Server</th>
              <th className="text-left px-3 py-2">IP</th>
              <th className="text-left px-3 py-2">System</th>
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => <Row key={r.id} row={r} casinos={casinos} />)}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-center py-6 text-sm text-muted-foreground">
                <Server className="w-5 h-5 inline mr-2 opacity-50" />No pending registrations
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
