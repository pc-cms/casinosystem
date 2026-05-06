/**
 * Incidents — CCTV/Manager violation journal.
 * Captures: date/time, observer, manager, department, table, dealer, inspector,
 * violation type, incident description, outcome, points, comments.
 * Roles: super_admin, manager, surveillance can post; pit/finance read-only.
 */
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, ImageIcon, Loader2, Plus, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useIncidents, useCreateIncident, type IncidentInput } from "@/hooks/use-incidents";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { toast } from "sonner";

const DEPARTMENTS = ["game", "cash", "reception", "floor", "bar", "security", "other"];
const VIOLATION_TYPES = ["procedural", "financial", "disciplinary", "technical", "other"];

const todayDate = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

const emptyForm = (): IncidentInput => ({
  incident_date: todayDate(),
  incident_time: nowTime(),
  cctv_observer: "",
  manager: "",
  department: "game",
  employees: "",
  table_name: "",
  dealer_name: "",
  inspector_name: "",
  violation_type: "procedural",
  incident: "",
  outcome: "",
  points: 0,
  comments: "",
});

const Incidents = () => {
  const { roles } = useAuth();
  const canPost = roles.some(r => ["super_admin", "manager", "surveillance"].includes(r));

  const [days, setDays] = useState(30);
  const { data: incidents = [], isLoading } = useIncidents(days);
  const createMut = useCreateIncident();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<IncidentInput>(emptyForm());

  const totalPts = useMemo(() => incidents.reduce((s, i) => s + (i.points || 0), 0), [incidents]);

  const setF = <K extends keyof IncidentInput>(k: K, v: IncidentInput[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.incident.trim()) {
      toast.error("Incident description is required");
      return;
    }
    try {
      await createMut.mutateAsync(form);
      toast.success("Incident logged");
      setOpen(false);
      setForm(emptyForm());
    } catch (e: any) {
      toast.error(e.message || "Failed to log");
    }
  };

  return (
    <PageShell>
      <PageHeader
        icon={AlertTriangle}
        title="Incidents"
        subtitle={`Violation journal · Last ${days} days · ${incidents.length} entries · ${totalPts} pts`}
      >
        <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
        {canPost && (
          <Button onClick={() => { setForm(emptyForm()); setOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> New incident
          </Button>
        )}
      </PageHeader>

      <PageSection title="Journal" card={false}>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
        ) : incidents.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground text-sm">
            No incidents in the selected period.
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Time</th>
                  <th className="px-2 py-2 text-left">CCTV</th>
                  <th className="px-2 py-2 text-left">Manager</th>
                  <th className="px-2 py-2 text-left">Dept</th>
                  <th className="px-2 py-2 text-left">Table</th>
                  <th className="px-2 py-2 text-left">Dealer</th>
                  <th className="px-2 py-2 text-left">Inspector</th>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-left">Incident</th>
                  <th className="px-2 py-2 text-left">Outcome</th>
                  <th className="px-2 py-2 text-right">Pts</th>
                  <th className="px-2 py-2 text-left">Comments</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(i => (
                  <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-2 py-1.5 whitespace-nowrap">{i.incident_date}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{i.incident_time?.slice(0, 5)}</td>
                    <td className="px-2 py-1.5">{i.cctv_observer || "·"}</td>
                    <td className="px-2 py-1.5">{i.manager || "·"}</td>
                    <td className="px-2 py-1.5">{i.department || "·"}</td>
                    <td className="px-2 py-1.5">{i.table_name || "·"}</td>
                    <td className="px-2 py-1.5">{i.dealer_name || "·"}</td>
                    <td className="px-2 py-1.5">{i.inspector_name || "·"}</td>
                    <td className="px-2 py-1.5">
                      {i.violation_type ? (
                        <Badge variant="outline" className="text-[10px]">{i.violation_type}</Badge>
                      ) : "·"}
                    </td>
                    <td className="px-2 py-1.5 max-w-[260px] whitespace-normal break-words">{i.incident}</td>
                    <td className="px-2 py-1.5 max-w-[200px] whitespace-normal break-words">{i.outcome || "·"}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{i.points || 0}</td>
                    <td className="px-2 py-1.5 max-w-[260px] whitespace-normal break-words text-muted-foreground">
                      {i.comments || "·"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>

      <ResponsiveDialog open={open} onOpenChange={setOpen} title="New incident" size="3xl">
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date</label>
              <Input type="date" value={form.incident_date} onChange={e => setF("incident_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Time</label>
              <Input type="time" value={form.incident_time} onChange={e => setF("incident_time", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Points</label>
              <Input
                type="number"
                min={0}
                value={form.points}
                onChange={e => setF("points", Number(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">CCTV observer</label>
              <Input value={form.cctv_observer || ""} onChange={e => setF("cctv_observer", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Manager</label>
              <Input value={form.manager || ""} onChange={e => setF("manager", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Department</label>
              <Select value={form.department || ""} onValueChange={v => setF("department", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Table</label>
              <Input value={form.table_name || ""} onChange={e => setF("table_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Dealer</label>
              <Input value={form.dealer_name || ""} onChange={e => setF("dealer_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Inspector</label>
              <Input value={form.inspector_name || ""} onChange={e => setF("inspector_name", e.target.value)} />
            </div>

            <div className="space-y-1 md:col-span-1">
              <label className="text-xs text-muted-foreground">Violation type</label>
              <Select value={form.violation_type || ""} onValueChange={v => setF("violation_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VIOLATION_TYPES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">Employees</label>
              <Input value={form.employees || ""} onChange={e => setF("employees", e.target.value)} />
            </div>

            <div className="space-y-1 md:col-span-3">
              <label className="text-xs text-muted-foreground">Incident *</label>
              <Textarea
                rows={2}
                value={form.incident}
                onChange={e => setF("incident", e.target.value)}
                placeholder="Describe the violation"
              />
            </div>
            <div className="space-y-1 md:col-span-3">
              <label className="text-xs text-muted-foreground">Outcome</label>
              <Textarea
                rows={2}
                value={form.outcome || ""}
                onChange={e => setF("outcome", e.target.value)}
                placeholder="What was done in response"
              />
            </div>
            <div className="space-y-1 md:col-span-3">
              <label className="text-xs text-muted-foreground">Comments</label>
              <Textarea
                rows={2}
                value={form.comments || ""}
                onChange={e => setF("comments", e.target.value)}
              />
            </div>
          </div>

          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || !form.incident.trim()}>
              Log incident
            </Button>
          </ResponsiveDialogFooter>
        </div>
      </ResponsiveDialog>
    </PageShell>
  );
};

export default Incidents;
