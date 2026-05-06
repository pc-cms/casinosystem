/**
 * Incidents — CCTV/Manager violation journal.
 * Captures: date/time, observer, manager, department, table, dealer, inspector,
 * violation type, incident description, outcome, points, comments.
 * Roles: super_admin, manager, surveillance can post; pit/finance read-only.
 */
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, ImageIcon, Loader2, Plus, Search, X } from "lucide-react";
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
import { usePitRota, useDealers } from "@/hooks/use-dealers";
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
  photo_url: null,
});

const Incidents = () => {
  const { roles } = useAuth();
  const canPost = roles.some(r => ["super_admin", "manager", "surveillance"].includes(r));

  const [search, setSearch] = useState("");
  const { data: incidents = [], isLoading } = useIncidents(null);
  const createMut = useCreateIncident();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<IncidentInput>(emptyForm());
  const [uploading, setUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rota for selected incident date — provides dealer/inspector/manager dropdowns.
  const { data: rota = [] } = usePitRota(form.incident_date);
  const { data: allDealers = [] } = useDealers();

  const rotaNames = useMemo(() => {
    const byCategory = { dealers: new Set<string>(), inspectors: new Set<string>(), pitBosses: new Set<string>() };
    const dealersMap = new Map(allDealers.map((d: any) => [d.id, d]));
    for (const r of rota as any[]) {
      const d = dealersMap.get(r.dealer_id) as any;
      if (!d) continue;
      const name = d.name;
      if (d.is_pit_boss) byCategory.pitBosses.add(name);
      else if (d.category === "I") byCategory.inspectors.add(name);
      else byCategory.dealers.add(name);
    }
    return {
      dealers: [...byCategory.dealers].sort(),
      inspectors: [...byCategory.inspectors].sort(),
      pitBosses: [...byCategory.pitBosses].sort(),
    };
  }, [rota, allDealers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return incidents;
    const q = search.toLowerCase();
    return incidents.filter(i =>
      [i.dealer_name, i.inspector_name, i.manager, i.cctv_observer, i.violation_type, i.incident, i.outcome, i.comments, i.table_name, i.department, i.incident_date]
        .some(v => (v || "").toLowerCase().includes(q))
    );
  }, [incidents, search]);

  const totalPts = useMemo(() => filtered.reduce((s, i) => s + (i.points || 0), 0), [filtered]);

  const setF = <K extends keyof IncidentInput>(k: K, v: IncidentInput[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("incident-photos")
        .upload(path, compressed.thumbnail, { contentType: "image/jpeg", upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("incident-photos").getPublicUrl(path);
      setF("photo_url", publicUrl);
      toast.success("Photo attached");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
                  <th className="px-2 py-2 text-center">Photo</th>
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
                    <td className="px-2 py-1.5 text-center">
                      {i.photo_url ? (
                        <button
                          type="button"
                          onClick={() => setViewPhoto(i.photo_url)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 hover:bg-primary/20 text-primary"
                          title="View photo"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-muted-foreground">·</span>
                      )}
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
            <div className="space-y-1 md:col-span-3">
              <label className="text-xs text-muted-foreground">Photo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              {form.photo_url ? (
                <div className="relative inline-block">
                  <img
                    src={form.photo_url}
                    alt="Incident"
                    className="h-32 w-auto rounded-md border border-border cursor-pointer"
                    onClick={() => setViewPhoto(form.photo_url)}
                  />
                  <button
                    type="button"
                    onClick={() => setF("photo_url", null)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {uploading ? "Uploading…" : "Attach photo"}
                </Button>
              )}
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

      <Dialog open={!!viewPhoto} onOpenChange={(o) => !o && setViewPhoto(null)}>
        <DialogContent className="max-w-5xl p-0 bg-background border-border overflow-hidden">
          {viewPhoto && (
            <img
              src={viewPhoto}
              alt="Incident photo"
              className="w-full h-auto max-h-[90vh] object-contain bg-muted"
            />
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default Incidents;
