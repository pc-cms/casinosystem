import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const InlineTextCell = ({
  value,
  disabled,
  onCommit,
  className,
  placeholder = "—",
}: {
  value: string;
  disabled?: boolean;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(value || "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setRaw(value || ""); }, [value]);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);

  if (disabled) {
    return <span className={className}>{value || placeholder}</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className={cn("text-left hover:bg-primary/10 rounded px-1 -mx-1 transition-colors w-full truncate", className)}
        title="Click to rename"
      >
        {value || <span className="text-muted-foreground/60">{placeholder}</span>}
      </button>
    );
  }

  const commit = () => {
    const next = raw.trim();
    setEditing(false);
    if (next && next !== value) onCommit(next);
    else setRaw(value);
  };

  return (
    <input
      ref={ref}
      type="text"
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") { setEditing(false); setRaw(value); }
      }}
      onClick={(e) => e.stopPropagation()}
      className={cn("w-full bg-background border border-primary rounded px-1 py-0 text-[11px]", className)}
    />
  );
};
