/**
 * AttendanceHintPopover — small popover used from the Break List when an
 * operator sets a non-working status (A / S / L / SP). Lets them type a short
 * comment that lands in the HR `staff_warnings` row for that day.
 */
import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUpsertWarningCommentByKey } from "@/hooks/use-staff-warnings";

type Kind = "absent" | "suspend" | "sick" | "late";

const KIND_META: Record<Kind, { label: string; full: string }> = {
  absent:  { label: "A",  full: "Absent" },
  suspend: { label: "SP", full: "Suspend" },
  sick:    { label: "S",  full: "Sick" },
  late:    { label: "L",  full: "Late" },
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anchor: React.ReactElement;
  employeeName: string;
  employeeId: string;
  businessDate: string;
  kind: Kind;
  initialComment?: string;
}

export const AttendanceHintPopover = ({
  open, onOpenChange, anchor, employeeName, employeeId, businessDate, kind, initialComment = "",
}: Props) => {
  const [text, setText] = useState(initialComment);
  const upsert = useUpsertWarningCommentByKey();

  useEffect(() => { setText(initialComment); }, [initialComment, open]);

  const save = async () => {
    await upsert.mutateAsync({ employee_id: employeeId, business_date: businessDate, comment: text });
    onOpenChange(false);
  };

  const meta = KIND_META[kind];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{anchor}</PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-2" align="start">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-mono font-bold bg-muted">{meta.label}</span>
          <span className="font-medium text-foreground">{employeeName}</span>
          <span>·</span>
          <span>{meta.full}</span>
        </div>
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Short note for HR (optional)…"
          rows={3}
          autoFocus
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
          }}
        />
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={upsert.isPending}>OK</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AttendanceHintPopover;
