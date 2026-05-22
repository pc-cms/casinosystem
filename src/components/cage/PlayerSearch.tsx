import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import { useSelectedPlayer } from "@/hooks/use-selected-player";
import CasinoBadge from "@/components/player/CasinoBadge";
import { formatCardId } from "@/lib/card-number";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string;
  casino_id?: string;
  status?: string;
  photo_url?: string | null;
  id_number?: string;
  player_cards?: { card_number: string }[];
}

interface PlayerSearchProps {
  players: Player[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const PlayerSearch = ({ players, value, onChange, placeholder = "Search player…", autoFocus }: PlayerSearchProps) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const { select: selectPlayer } = useSelectedPlayer();

  const selected = players.find(p => p.id === value);

  const filtered = useMemo(() => {
    if (!query) return players.slice(0, 20);
    const q = query.toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return players.filter(p => {
      const name = `${p.first_name} ${p.last_name} ${p.nickname}`.toLowerCase();
      if (name.includes(q)) return true;
      const cards = p.player_cards || [];
      for (const c of cards) {
        const raw = (c.card_number || "").toLowerCase();
        if (raw.includes(q)) return true;
        const digits = raw.replace(/\D/g, "");
        if (qDigits && digits.includes(qDigits)) return true;
        // match without leading zeros too
        if (qDigits && digits.replace(/^0+/, "").includes(qDigits.replace(/^0+/, ""))) return true;
      }
      return false;
    }).slice(0, 20);
  }, [query, players]);

  useEffect(() => setHighlightIdx(0), [filtered]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && filtered[highlightIdx]) { e.preventDefault(); handleSelect(filtered[highlightIdx].id); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={ref} className="relative">
      {selected && !open ? (
        <button
          onClick={() => { onChange(""); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="w-full text-left flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-muted/50 transition-colors"
        >
          <span className="font-medium text-card-foreground">{selected.first_name} {selected.last_name}</span>
          <span className="text-xs text-muted-foreground">{selected.nickname || ""}</span>
        </button>
      ) : (
        <Input
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="font-mono"
        />
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {filtered.map((p, i) => (
            <div
              key={p.id}
              className={`w-full flex items-center transition-colors ${
                i === highlightIdx ? "bg-accent text-accent-foreground" : "text-popover-foreground hover:bg-muted/50"
              }`}
            >
              <button
                onClick={() => handleSelect(p.id)}
                className="flex-1 text-left px-3 py-1.5 text-sm flex items-center justify-between"
              >
                <span className={p.status === "blacklist" ? "text-destructive font-medium" : ""}>
                  {p.first_name} {p.last_name}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                  {p.casino_id && <CasinoBadge casinoId={p.casino_id} />}
                  {p.status === "blacklist" && <span className="text-destructive font-bold">BL</span>}
                  {formatCardId(p.player_cards?.[0]?.card_number)}
                </span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); selectPlayer(p.id); setOpen(false); }}
                className="px-2 py-1.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
                title="Edit player"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover p-3 text-center text-xs text-muted-foreground">
          No players found
        </div>
      )}
      
    </div>
  );
};

export default PlayerSearch;
