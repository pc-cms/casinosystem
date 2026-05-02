/**
 * ChipColorSettings — admin UI for per-casino chip color configuration.
 * Three color pickers per denomination: Background, Edge (6 inserts), Text.
 */
import { useEffect, useState } from "react";
import { CHIP_DENOMS } from "@/lib/currency";
import { useChipColors, useUpsertChipColor, resolveChipColor, DEFAULT_CHIP_HEX } from "@/hooks/use-chip-colors";
import { Button } from "@/components/ui/button";
import { RotateCcw, Save } from "lucide-react";
import ChipToken from "@/components/ChipToken";

interface RowState {
  bg: string;
  edge: string;
  text: string;
  dirty: boolean;
}

const ChipColorSettings = () => {
  const { data: overrides = {} } = useChipColors();
  const upsert = useUpsertChipColor();
  const [rows, setRows] = useState<Record<number, RowState>>({});

  // Sync state from server when overrides change
  useEffect(() => {
    const next: Record<number, RowState> = {};
    CHIP_DENOMS.forEach(d => {
      const c = resolveChipColor(d, overrides);
      next[d] = { bg: c.bg, edge: c.edge, text: c.text, dirty: false };
    });
    setRows(next);
  }, [overrides]);

  const updateRow = (denom: number, patch: Partial<Pick<RowState, "bg" | "edge" | "text">>) => {
    setRows(prev => ({ ...prev, [denom]: { ...prev[denom], ...patch, dirty: true } }));
  };

  const resetToDefault = (denom: number) => {
    const def = DEFAULT_CHIP_HEX[denom];
    setRows(prev => ({ ...prev, [denom]: { bg: def.bg, edge: def.edge, text: def.text, dirty: true } }));
  };

  const saveRow = (denom: number) => {
    const r = rows[denom];
    if (!r) return;
    upsert.mutate({ denomination: denom, bg_color: r.bg, edge_color: r.edge, text_color: r.text });
  };

  const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-8 w-8 rounded border border-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="font-mono text-xs h-8 w-full min-w-0 rounded border border-border bg-background px-1.5"
        />
      </div>
    </label>
  );

  return (
    <div className="cms-panel p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-card-foreground">Chip Colors</h2>
        <p className="text-xs text-muted-foreground">
          Customize the appearance of each chip denomination for this casino. Each chip has a main body color, 6 edge inserts, and a label color.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {CHIP_DENOMS.map(d => {
          const r = rows[d] || { bg: "#666", edge: "#FFF", text: "#FFF", dirty: false };
          return (
            <div key={d} className="border border-border rounded-md p-3 bg-background">
              <div className="flex items-center gap-3">
                {/* Live preview using ChipToken */}
                <ChipToken denom={d} size="lg" colors={{ bg: r.bg, edge: r.edge, text: r.text }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Denomination</p>
                  <p className="font-mono text-sm font-semibold text-card-foreground">{d.toLocaleString("en-US")}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <ColorField label="Body" value={r.bg} onChange={v => updateRow(d, { bg: v })} />
                <ColorField label="Edge" value={r.edge} onChange={v => updateRow(d, { edge: v })} />
                <ColorField label="Text" value={r.text} onChange={v => updateRow(d, { text: v })} />
              </div>

              <div className="flex items-center gap-1.5 mt-3">
                <Button
                  variant="outline" size="sm"
                  onClick={() => resetToDefault(d)}
                  className="gap-1 h-7 text-xs"
                >
                  <RotateCcw className="w-3 h-3" /> Default
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveRow(d)}
                  disabled={!r.dirty || upsert.isPending}
                  className="gap-1 h-7 text-xs flex-1"
                >
                  <Save className="w-3 h-3" /> {r.dirty ? "Save" : "Saved"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChipColorSettings;
