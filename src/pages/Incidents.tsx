/**
 * Incidents — CCTV/Manager violation journal.
 * Inline row entry (no modal): draft row at the top of the table, save in place.
 * Roles: super_admin, manager, surveillance can post; pit/finance read-only.
 */
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, Check, ImageIcon, Loader2, RotateCcw, Search, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useIncidents, useCreateIncident, type IncidentInput } from "@/hooks/use-incidents";
import { usePitRota, useDealers } from "@/hooks/use-dealers";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { toast } from "sonner";

const DEPARTMENTS = ["game", "cash", "reception", "floor", "bar", "security", "other"];
const VIOLATION_TYPES = ["procedural", "financial", "disciplinary", "technical", "other"];

// Standing managers — always selectable, independent of rota.
const STANDING_MANAGERS = ["Peter", "Taras", "Daniyar"];

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

const cellInput = "h-7 px-1.5 text-xs font-mono border-0 bg-transparent focus-visible:bg-background focus-visible:ring-1 rounded-sm";

const Incidents = () => {
  const { roles } = useAuth();
  const canPost = roles.some(r => ["super_admin", "manager", "surveillance"].includes(r));

  const [search, setSearch] = useState("");
  const { data: incidents = [], isLoading } = useIncidents(null);
  const createMut = useCreateIncident();

  const [form, setForm] = useState<IncidentInput>(emptyForm());
  const [uploading, setUploading] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      managers: [...new Set([...STANDING_MANAGERS, ...byCategory.pitBosses])].sort(),
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
        subtitle={`Violation journal · ${filtered.length} entries · ${totalPts} pts`}
      >
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 w-56"
          />
        </div>
      </PageHeader>

      <PageSection title="Journal" card={false}>
        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left w-[110px]">Date</th>
                <th className="px-2 py-2 text-left w-[70px]">Time</th>
                <th className="px-2 py-2 text-left w-[110px]">CCTV</th>
                <th className="px-2 py-2 text-left w-[110px]">Manager</th>
                <th className="px-2 py-2 text-left w-[90px]">Dept</th>
                <th className="px-2 py-2 text-left w-[80px]">Table</th>
                <th className="px-2 py-2 text-left w-[110px]">Dealer</th>
                <th className="px-2 py-2 text-left w-[110px]">Inspector</th>
                <th className="px-2 py-2 text-left w-[110px]">Type</th>
                <th className="px-2 py-2 text-left">Incident *</th>
                <th className="px-2 py-2 text-left">Outcome</th>
                <th className="px-2 py-2 text-right w-[50px]">Pts</th>
                <th className="px-2 py-2 text-left">Comments</th>
                <th className="px-2 py-2 text-center w-[60px]">Photo</th>
                {canPost && <th className="px-2 py-2 text-center w-[70px]">Save</th>}
              </tr>
            </thead>
            <tbody>
              {/* Draft row — inline entry */}
              {canPost && (
                <tr className="border-t border-border bg-primary/5">
                  <td className="px-1 py-1">
                    <Input type="date" value={form.incident_date} onChange={e => setF("incident_date", e.target.value)} className={cellInput} />
                  </td>
                  <td className="px-1 py-1">
                    <Input type="time" value={form.incident_time} onChange={e => setF("incident_time", e.target.value)} className={cellInput} />
                  </td>
                  <td className="px-1 py-1">
                    <Input value={form.cctv_observer || ""} onChange={e => setF("cctv_observer", e.target.value)} placeholder="…" className={cellInput} />
                  </td>
                  <td className="px-1 py-1">
                    <Input list="incident-managers" value={form.manager || ""} onChange={e => setF("manager", e.target.value)} placeholder="…" className={cellInput} />
                    <datalist id="incident-managers">
                      {rotaNames.managers.map(n => <option key={n} value={n} />)}
                    </datalist>
                  </td>
                  <td className="px-1 py-1">
                    <select
                      value={form.department || ""}
                      onChange={e => setF("department", e.target.value)}
                      className={`${cellInput} w-full bg-transparent`}
                    >
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <Input value={form.table_name || ""} onChange={e => setF("table_name", e.target.value)} placeholder="…" className={cellInput} />
                  </td>
                  <td className="px-1 py-1">
                    <Input list="incident-dealers" value={form.dealer_name || ""} onChange={e => setF("dealer_name", e.target.value)} placeholder="…" className={cellInput} />
                    <datalist id="incident-dealers">
                      {rotaNames.dealers.map(n => <option key={n} value={n} />)}
                    </datalist>
                  </td>
                  <td className="px-1 py-1">
                    <Input list="incident-inspectors" value={form.inspector_name || ""} onChange={e => setF("inspector_name", e.target.value)} placeholder="…" className={cellInput} />
                    <datalist id="incident-inspectors">
                      {rotaNames.inspectors.map(n => <option key={n} value={n} />)}
                    </datalist>
                  </td>
                  <td className="px-1 py-1">
                    <select
                      value={form.violation_type || ""}
                      onChange={e => setF("violation_type", e.target.value)}
                      className={`${cellInput} w-full bg-transparent`}
                    >
                      {VIOLATION_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <Input value={form.incident} onChange={e => setF("incident", e.target.value)} placeholder="describe…" className={cellInput} />
                  </td>
                  <td className="px-1 py-1">
                    <Input value={form.outcome || ""} onChange={e => setF("outcome", e.target.value)} placeholder="…" className={cellInput} />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      type="number"
                      min={0}
                      value={form.points || 0}
                      onChange={e => setF("points", Number(e.target.value) || 0)}
                      className={`${cellInput} text-right`}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input value={form.comments || ""} onChange={e => setF("comments", e.target.value)} placeholder="…" className={cellInput} />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    {form.photo_url ? (
                      <div className="relative inline-block">
                        <img
                          src={form.photo_url}
                          alt=""
                          className="h-7 w-7 object-cover rounded cursor-pointer"
                          onClick={() => setViewPhoto(form.photo_url)}
                        />
                        <button
                          type="button"
                          onClick={() => setF("photo_url", null)}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center"
                        >
                          <X className="w-2 h-2" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground"
                        title="Attach photo"
                      >
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </td>
                  <td className="px-1 py-1">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={createMut.isPending || !form.incident.trim()}
                        className="h-7 w-7 p-0"
                        title="Save"
                      >
                        {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setForm(emptyForm())}
                        className="h-7 w-7 p-0"
                        title="Reset"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {isLoading ? (
                <tr><td colSpan={canPost ? 15 : 14} className="text-center py-8 text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={canPost ? 15 : 14} className="text-center py-8 text-muted-foreground">
                  {incidents.length === 0 ? "No incidents yet." : "No matches for the search."}
                </td></tr>
              ) : (
                filtered.map(i => (
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
                    {canPost && <td className="px-2 py-1.5"></td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

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
