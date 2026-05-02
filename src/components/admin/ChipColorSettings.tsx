/**
 * ChipColorSettings — admin UI for per-casino chip color configuration.
 * Live preview chip + native color pickers for bg + text.
 */
import { useEffect, useState } from "react";
import { CHIP_DENOMS, formatChipLabel } from "@/lib/currency";
import { useChipColors, useUpsertChipColor, resolveChipColor, DEFAULT_CHIP_HEX } from "@/hooks/use-chip-colors";
import { Button } from "@/components/ui/button";
import { RotateCcw, Save } from "lucide-react";

interface RowState {
  bg: string;
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
      next[d] = { bg: c.bg, text: c.text, dirty: false };
    });
    setRows(next);
  }, [overrides]);

  const updateRow = (denom: number, patch: Partial<Pick<RowState, "bg" | "text">>) => {
    setRows(prev => ({ ...prev, [denom]: { ...prev[denom], ...patch, dirty: true } }));
  };

  const resetToDefault = (denom: number) => {
    const def = DEFAULT_CHIP_HEX[denom];
    setRows(prev => ({ ...prev, [denom]: { bg: def.bg, text: def.text, dirty: true } }));
  };

  const saveRow = (denom: number) => {
    const r = rows[denom];
    if (!r) return;
    upsert.mutate({ denomination: denom, bg_color: r.bg, text_color: r.text });
  };

  return (
    <div className="cms-panel p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-card-foreground">Chip Colors</h2>
        <p className="text-xs text-muted-foreground">
          Customize the appearance of each chip denomination for this casino. Defaults apply when no override is set.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {CHIP_DENOMS.map(d => {
          const r = rows[d] || { bg: "#666", text: "#FFF", dirty: false };
          return (
            <div key={d} className="border border-border rounded-md p-3 bg-background">
              <div className="flex items-center gap-3">
                {/* Preview */}
                <span
                  className="cms-chip-token cms-chip-token-lg"
                  style={{ backgroundColor: r.bg, color: r.text }}
                >
                  {formatChipLabel(d)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Denomination</p>
                  <p className="font-mono text-sm font-semibold text-card-foreground">{d.toLocaleString("en-US")}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Background</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={r.bg}
                      onChange={e => updateRow(d, { bg: e.target.value })}
                      className="h-8 w-8 rounded border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={r.bg}
                      onChange={e => updateRow(d, { bg: e.target.value })}
                      className="font-mono text-xs h-8 w-full min-w-0 rounded border border-border bg-background px-1.5"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Text</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={r.text}
                      onChange={e => updateRow(d, { text: e.target.value })}
                      className="h-8 w-8 rounded border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={r.text}
                      onChange={e => updateRow(d, { text: e.target.value })}
                      className="font-mono text-xs h-8 w-full min-w-0 rounded border border-border bg-background px-1.5"
                    />
                  </div>
                </label>
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
