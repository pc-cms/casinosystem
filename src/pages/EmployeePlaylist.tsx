/**
 * Employee Playlist — Excel-like roster of every active employee in the casino.
 *
 * Accessible to Surveillance (CCTV), Manager, Floor Manager, Super Admin.
 * Shows: Name, Position, Department, Tenure (years in company), Birthday,
 * and a free-form Comment that any of the four roles can edit and save.
 */
import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cake, FileSpreadsheet, Search } from "lucide-react";
import { PageShell, PageSection } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useEmployees } from "@/hooks/use-payroll";
import { useAuth } from "@/lib/auth-context";
import { useCasino } from "@/lib/casino-context";
import { supabase } from "@/integrations/supabase/client";
import { downloadXlsx } from "@/lib/excel-export";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fmtDate = (d: string | null) => {
  if (!d) return "";
  const x = new Date(d);
  if (isNaN(x.getTime())) return "";
  return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`;
};

const tenureLabel = (start: string | null) => {
  if (!start) return "";
  const s = new Date(start);
  if (isNaN(s.getTime())) return "";
  const ms = Date.now() - s.getTime();
  if (ms < 0) return "";
  const days = Math.floor(ms / (24 * 3600 * 1000));
  const years = Math.floor(days / 365.25);
  const months = Math.floor((days - years * 365.25) / 30.4375);
  if (years <= 0 && months <= 0) return `${days}d`;
  if (years <= 0) return `${months}mo`;
  return months > 0 ? `${years}y ${months}mo` : `${years}y`;
};

const isBirthdaySoon = (b: string | null) => {
  if (!b) return false;
  const d = new Date(b);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  const next = new Date(today.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (next.getTime() < today.getTime() - 24 * 3600 * 1000) next.setUTCFullYear(today.getUTCFullYear() + 1);
  const diff = (next.getTime() - today.getTime()) / (24 * 3600 * 1000);
  return diff >= 0 && diff <= 14;
};

const isBirthdayToday = (b: string | null) => {
  if (!b) return false;
  const d = new Date(b);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return d.getUTCMonth() === today.getUTCMonth() && d.getUTCDate() === today.getUTCDate();
};

interface PlaylistNote {
  employee_id: string;
  note: string;
}

const usePlaylistNotes = () => {
  const { activeCasinoId } = useCasino();
  return useQuery({
    queryKey: ["employee_playlist_notes", activeCasinoId],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from("employee_playlist_notes")
        .select("employee_id, note")
        .eq("casino_id", activeCasinoId!);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: PlaylistNote) => { map[r.employee_id] = r.note ?? ""; });
      return map;
    },
    enabled: !!activeCasinoId,
  });
};

const useSaveNote = () => {
  const qc = useQueryClient();
  const { activeCasinoId } = useCasino();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ employee_id, note }: { employee_id: string; note: string }) => {
      const { error } = await supabase
        .from("employee_playlist_notes")
        .upsert({
          employee_id,
          casino_id: activeCasinoId!,
          note,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "employee_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee_playlist_notes"] }),
    onError: (e: any) => toast.error(e?.message ?? "Failed to save comment"),
  });
};

const NoteCell = ({ employeeId, value }: { employeeId: string; value: string }) => {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  const save = useSaveNote();

  useEffect(() => { setDraft(value); setDirty(false); }, [value]);

  const commit = useCallback(() => {
    if (!dirty) return;
    save.mutate({ employee_id: employeeId, note: draft }, {
      onSuccess: () => { setDirty(false); },
    });
  }, [dirty, draft, employeeId, save]);

  return (
    <Textarea
      value={draft}
      onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
      onBlur={commit}
      placeholder="Add comment…"
      rows={2}
      className={cn(
        "min-h-[44px] text-sm resize-y w-full",
        dirty && "border-primary/60",
      )}
    />
  );
};

export default function EmployeePlaylist() {
  const { data: employees = [], isLoading } = useEmployees();
  const { data: notes = {} } = usePlaylistNotes();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string>("all");

  const active = useMemo(
    () => employees.filter((e) => e.payroll_status === "active"),
    [employees],
  );

  const departments = useMemo(() => {
    const s = new Set(active.map((e) => e.department).filter(Boolean));
    return ["all", ...Array.from(s).sort()];
  }, [active]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active
      .filter((e) => dept === "all" || e.department === dept)
      .filter((e) => {
        if (!q) return true;
        const hay = `${e.full_name} ${e.position} ${e.department} ${notes[e.id] ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }, [active, dept, query, notes]);

  const upcomingBirthdays = useMemo(
    () => active
      .filter((e) => isBirthdaySoon(e.birthday))
      .sort((a, b) => {
        const ad = new Date(a.birthday!);
        const bd = new Date(b.birthday!);
        const today = new Date();
        const next = (d: Date) => {
          const n = new Date(today.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
          if (n.getTime() < today.getTime() - 24 * 3600 * 1000) n.setUTCFullYear(today.getUTCFullYear() + 1);
          return n.getTime();
        };
        return next(ad) - next(bd);
      })
      .slice(0, 8),
    [active],
  );

  const exportExcel = async () => {
    const rows: (string | number)[][] = [
      ["Name", "Position", "Department", "Tenure", "Contract Start", "Birthday", "Comment"],
      ...filtered.map((e) => [
        e.full_name ?? "",
        e.position ?? "",
        e.department ?? "",
        tenureLabel(e.contract_start ?? e.onboarding_date ?? e.employment_date),
        fmtDate(e.contract_start ?? e.onboarding_date ?? e.employment_date),
        fmtDate(e.birthday),
        notes[e.id] ?? "",
      ]),
    ];
    await downloadXlsx(`employee-playlist-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { name: "Playlist", rows },
    ]);
  };

  return (
    <PageShell>
      <PageHeader
        title="Employee Playlist"
        subtitle="Active employees with quick comments and birthdays"
      >
        <Button size="sm" variant="outline" onClick={exportExcel} disabled={isLoading || filtered.length === 0}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export Excel
        </Button>
      </PageHeader>

      {upcomingBirthdays.length > 0 && (
        <PageSection>
          <div className="flex items-center gap-2 mb-2 text-sm font-medium">
            <Cake className="w-4 h-4 text-pink-500" />
            Upcoming birthdays (next 14 days)
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingBirthdays.map((e) => (
              <Badge
                key={e.id}
                variant={isBirthdayToday(e.birthday) ? "default" : "secondary"}
                className="gap-1"
              >
                <Cake className="w-3 h-3" />
                {e.full_name} · {fmtDate(e.birthday).slice(0, 5)}
              </Badge>
            ))}
          </div>
        </PageSection>
      )}

      <PageSection>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, position, comment…"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {departments.map((d) => (
              <Button
                key={d}
                size="sm"
                variant={dept === d ? "default" : "outline"}
                onClick={() => setDept(d)}
                className="h-8"
              >
                {d === "all" ? "All" : d}
              </Button>
            ))}
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            {filtered.length} of {active.length}
          </div>
        </div>

        <div className="overflow-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0 z-10">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Position</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Tenure</th>
                <th className="px-3 py-2 font-medium">Birthday</th>
                <th className="px-3 py-2 font-medium w-[28%]">Comment</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No employees match the filter.</td></tr>
              )}
              {filtered.map((e) => {
                const start = e.contract_start ?? e.onboarding_date ?? e.employment_date;
                const bdayToday = isBirthdayToday(e.birthday);
                return (
                  <tr key={e.id} className="border-t hover:bg-muted/30 align-top">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{e.full_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.position || <span className="text-muted-foreground">·</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.department || <span className="text-muted-foreground">·</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap" title={start ? fmtDate(start) : ""}>
                      {start ? tenureLabel(start) : <span className="text-muted-foreground">·</span>}
                    </td>
                    <td className={cn("px-3 py-2 whitespace-nowrap", bdayToday && "text-pink-600 font-semibold")}>
                      {e.birthday ? (
                        <span className="inline-flex items-center gap-1">
                          {bdayToday && <Cake className="w-3.5 h-3.5" />}
                          {fmtDate(e.birthday)}
                        </span>
                      ) : <span className="text-muted-foreground">·</span>}
                    </td>
                    <td className="px-3 py-2">
                      <NoteCell employeeId={e.id} value={notes[e.id] ?? ""} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageSection>
    </PageShell>
  );
}
