import { useMemo, useState, useEffect } from "react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Save, X } from "lucide-react";
import { canEditSection, type EditPatch, type SnapshotSection, useEditBusinessDaySnapshot } from "@/hooks/use-business-day-history";
import { useAuth } from "@/lib/auth-context";

type Props = {
  closureId: string;
  section: SnapshotSection;
  rows: any[];
  /** Field names to display (defaults to all keys minus the meta ones). */
  columns?: string[];
};

const HIDDEN = new Set([
  "id", "casino_id", "created_at", "updated_at", "created_by",
  "updated_by", "operator_id", "approved_by", "counted_by",
  "checked_in_by", "recorded_by", "locked_by",
]);
const NUMERIC_HINT = /amount|total|balance|quantity|bet|drop|win|cash|expected|actual|miss|denomination/i;

const inferColumns = (rows: any[]): string[] => {
  if (!rows.length) return [];
  const keys = new Set<string>();
  rows.forEach(r => Object.keys(r || {}).forEach(k => { if (!HIDDEN.has(k)) keys.add(k); }));
  return Array.from(keys);
};

const fmt = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

export const SnapshotTable = ({ closureId, section, rows, columns }: Props) => {
  const { roles } = useAuth();
  const editable = canEditSection(section, roles);
  const cols = useMemo(() => columns ?? inferColumns(rows), [columns, rows]);

  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft, setDraft] = useState<any[]>(rows);
  const editMutation = useEditBusinessDaySnapshot();

  useEffect(() => { setDraft(rows); }, [rows]);

  const startEdit = () => setConfirmOpen(true);
  const cancelEdit = () => { setDraft(rows); setEditing(false); };

  const onConfirmEdit = () => { setConfirmOpen(false); setEditing(true); };

  const onCellChange = (rowIdx: number, field: string, value: string) => {
    setDraft(prev => {
      const next = [...prev];
      const orig = rows[rowIdx]?.[field];
      let parsed: any = value;
      if (typeof orig === "number" || (orig == null && NUMERIC_HINT.test(field))) {
        const n = Number(value);
        parsed = value === "" ? null : (Number.isFinite(n) ? n : value);
      }
      next[rowIdx] = { ...next[rowIdx], [field]: parsed };
      return next;
    });
  };

  const save = async () => {
    const patches: EditPatch[] = [];
    draft.forEach((row, idx) => {
      const orig = rows[idx] || {};
      cols.forEach(field => {
        const a = orig[field];
        const b = row?.[field];
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          patches.push({ row_index: idx, field, before: a ?? null, after: b ?? null });
        }
      });
    });
    if (!patches.length) { setEditing(false); return; }
    await editMutation.mutateAsync({ closure_id: closureId, section, patches });
    setEditing(false);
  };

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No data recorded for this section.</p>;
  }

  return (
    <div className="space-y-2">
      {editable && (
        <div className="flex justify-end gap-2">
          {!editing ? (
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={cancelEdit}>
                <X className="w-3.5 h-3.5 mr-1.5" /> Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={editMutation.isPending}>
                <Save className="w-3.5 h-3.5 mr-1.5" /> Save
              </Button>
            </>
          )}
        </div>
      )}

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-xs">#</TableHead>
              {cols.map(c => <TableHead key={c} className="text-xs whitespace-nowrap">{c}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {draft.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell className="text-xs text-muted-foreground font-mono py-1.5">{idx + 1}</TableCell>
                {cols.map(field => (
                  <TableCell key={field} className="text-xs font-mono py-1.5">
                    {editing ? (
                      <Input
                        value={fmt(row?.[field])}
                        onChange={e => onCellChange(idx, field, e.target.value)}
                        className="h-7 text-xs font-mono"
                      />
                    ) : (
                      <span>{fmt(row?.[field])}</span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit closed business day?</AlertDialogTitle>
            <AlertDialogDescription>
              All changes will affect statistics and reports. Every modified field will be
              recorded in the audit log with before / after values and your user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmEdit}>I understand, edit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
