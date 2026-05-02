import { useMemo, useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { usePlayers } from "@/hooks/use-players";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Free-text input with suggestions from the GLOBAL player base.
 * Matches against first_name, last_name, nickname.
 * User can type any name (not constrained to suggestions).
 */
export const PlayerNameAutocomplete = ({ value, onChange, placeholder, disabled, className }: Props) => {
  const { data: players = [] } = usePlayers();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    const out: { label: string; key: string }[] = [];
    for (const p of players as any[]) {
      const full = `${p.first_name || ""} ${p.last_name || ""}`.trim();
      const nick = p.nickname || "";
      const hay = `${full} ${nick}`.toLowerCase();
      if (hay.includes(q)) {
        const label = nick ? `${full} "${nick}"` : full;
        out.push({ label, key: p.id });
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [players, value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (label: string) => {
    onChange(label);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Input
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={e => { onChange(e.target.value); setOpen(true); setActiveIdx(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && suggestions[activeIdx]) { e.preventDefault(); pick(suggestions[activeIdx].label); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
        className={cn("h-8 text-xs", className)}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onMouseDown={e => { e.preventDefault(); pick(s.label); }}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn(
                "w-full text-left px-2.5 py-1.5 text-xs",
                i === activeIdx ? "bg-accent text-accent-foreground" : "text-popover-foreground hover:bg-accent/50",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
