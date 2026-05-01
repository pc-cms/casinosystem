/**
 * BrandingSettings — per-casino primary + accent HSL + logo upload.
 * Super admin only. Live preview applies on save (BrandingProvider re-fetches via casino_id).
 */
import { useEffect, useState } from "react";
import { useCasino } from "@/lib/casino-context";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, RotateCcw, Upload, Image as ImageIcon } from "lucide-react";

const HSL_RE = /^\s*\d{1,3}\s+\d{1,3}%\s+\d{1,3}%\s*$/;

// Convert "H S% L%" → CSS hsl()
const toHsl = (v: string) => `hsl(${v})`;

// Hex → "H S% L%" (rounded)
const hexToHsl = (hex: string): string | null => {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let H = 0, S = 0; const L = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    S = L > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: H = (g - b) / d + (g < b ? 6 : 0); break;
      case g: H = (b - r) / d + 2; break;
      case b: H = (r - g) / d + 4; break;
    }
    H *= 60;
  }
  return `${Math.round(H)} ${Math.round(S * 100)}% ${Math.round(L * 100)}%`;
};

const hslToHex = (v: string | null): string => {
  if (!v) return "#cda85b";
  const m = v.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!m) return "#cda85b";
  const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
  if (s === 0) { const x = Math.round(l * 255).toString(16).padStart(2, "0"); return `#${x}${x}${x}`; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, "0")).join("")}`;
};

const useAllCasinos = () => useQuery({
  queryKey: ["all-casinos-branding"],
  queryFn: async () => {
    const { data, error } = await supabase.from("casinos").select("id, name, slug, brand_primary_hsl, brand_accent_hsl, logo_url").order("name");
    if (error) throw error;
    return data ?? [];
  },
});

export const BrandingSettings = () => {
  const { activeCasinoId } = useCasino();
  const { data: casinos = [] } = useAllCasinos();
  const qc = useQueryClient();
  const [casinoId, setCasinoId] = useState<string>("");
  const [primary, setPrimary] = useState<string>("");
  const [accent, setAccent] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!casinoId && (activeCasinoId || casinos[0]?.id)) {
      setCasinoId(activeCasinoId || casinos[0].id);
    }
  }, [activeCasinoId, casinos, casinoId]);

  useEffect(() => {
    const c = casinos.find(x => x.id === casinoId) as any;
    setPrimary(c?.brand_primary_hsl ?? "");
    setAccent(c?.brand_accent_hsl ?? "");
    setLogoUrl(c?.logo_url ?? "");
  }, [casinoId, casinos]);

  const save = useMutation({
    mutationFn: async () => {
      const validP = !primary || HSL_RE.test(primary);
      const validA = !accent || HSL_RE.test(accent);
      if (!validP || !validA) throw new Error("HSL must be in 'H S% L%' format (e.g. 38 55% 72%)");
      const { error } = await supabase.from("casinos").update({
        brand_primary_hsl: primary || null,
        brand_accent_hsl: accent || null,
        logo_url: logoUrl || null,
      } as any).eq("id", casinoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-casinos-branding"] });
      qc.invalidateQueries({ queryKey: ["all-casinos"] });
      toast.success("Branding saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetDefaults = () => { setPrimary(""); setAccent(""); };

  const handleUpload = async (file: File) => {
    if (!casinoId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${casinoId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("casino-branding").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("casino-branding").getPublicUrl(path);
      setLogoUrl(pub.publicUrl);
      toast.success("Logo uploaded — click Save to apply");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="cms-panel p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Per-Casino Branding</h3>
          <p className="text-xs text-muted-foreground">Customize primary + accent colors and logo for the selected casino.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Casino</label>
            <Select value={casinoId} onValueChange={setCasinoId}>
              <SelectTrigger><SelectValue placeholder="Select casino" /></SelectTrigger>
              <SelectContent>
                {casinos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Primary */}
          <div className="border border-border rounded-md p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Primary color</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hslToHex(primary || null)}
                onChange={e => { const v = hexToHsl(e.target.value); if (v) setPrimary(v); }}
                className="h-10 w-12 rounded border border-border cursor-pointer"
              />
              <Input
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                placeholder="38 55% 72%"
                className="font-mono text-xs"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-block w-8 h-8 rounded ring-1 ring-black/10" style={{ background: primary ? toHsl(primary) : "transparent" }} />
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => setPrimary("")}>
                <RotateCcw className="w-3 h-3 mr-1" /> Default
              </Button>
            </div>
          </div>

          {/* Accent */}
          <div className="border border-border rounded-md p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Accent color</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hslToHex(accent || null)}
                onChange={e => { const v = hexToHsl(e.target.value); if (v) setAccent(v); }}
                className="h-10 w-12 rounded border border-border cursor-pointer"
              />
              <Input
                value={accent}
                onChange={e => setAccent(e.target.value)}
                placeholder="38 55% 72%"
                className="font-mono text-xs"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-block w-8 h-8 rounded ring-1 ring-black/10" style={{ background: accent ? toHsl(accent) : "transparent" }} />
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAccent("")}>
                <RotateCcw className="w-3 h-3 mr-1" /> Default
              </Button>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="border border-border rounded-md p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Logo</p>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded border border-border bg-muted/40 flex items-center justify-center overflow-hidden">
              {logoUrl
                ? <img src={logoUrl} alt="logo" className="w-full h-full object-contain" />
                : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="flex-1 space-y-2">
              <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://… or upload" className="text-xs" />
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                />
                <Button size="sm" variant="outline" disabled={uploading || !casinoId} asChild>
                  <span><Upload className="w-3 h-3 mr-1" /> {uploading ? "Uploading…" : "Upload"}</span>
                </Button>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={resetDefaults}>Reset colors</Button>
          <Button onClick={() => save.mutate()} disabled={!casinoId || save.isPending}>
            <Save className="w-4 h-4 mr-1" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
};
