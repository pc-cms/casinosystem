import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload, Camera, ImageIcon, Loader2, X, CheckCircle2, AlertTriangle, Unlock, Lock, Play, Save, ChevronDown, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { FIXED_TABLE_NAMES, formatSpaced, parseSpaced, type ImportDay, type OcrRow } from "@/lib/import-helpers";
import { useSaveImportedDay } from "@/hooks/use-import-reports";

/** Resize image to max width keeping aspect ratio. Returns JPEG blob. */
const resizeImage = (file: File, maxWidth = 1600, quality = 0.85): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Resize failed"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

type ImageItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  date?: string;
  rows?: OcrRow[];
  needsReview?: boolean;
};

const newId = () => Math.random().toString(36).slice(2);

const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf("base64,");
      resolve(i >= 0 ? s.slice(i + 7) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const ImportReports = () => {
  const { isManager, roles } = useAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [days, setDays] = useState<Map<string, ImportDay>>(new Map());
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const saveDay = useSaveImportedDay();

  const allowed = isManager || roles.includes("super_admin");
  if (!allowed) return <Navigate to="/" replace />;

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setImages((prev) => [
      ...prev,
      ...list.map((file) => ({
        id: newId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "pending" as const,
      })),
    ]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const x = prev.find((i) => i.id === id);
      if (x) URL.revokeObjectURL(x.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const upsertDay = (date: string, rows: OcrRow[]) => {
    setDays((prev) => {
      const next = new Map(prev);
      const key = date || "unknown";
      const existing = next.get(key);
      if (existing && !existing.locked) {
        // merge rows: prefer existing edits, fill missing with new
        const merged = FIXED_TABLE_NAMES.map((name) => {
          const old = existing.rows.find((r) => r.table === name);
          const fresh = rows.find((r) => r.table === name);
          return old || fresh || {
            table: name, open: "0", fill: "0", credit: "0", close: "0", drop: "0", result: "0",
          };
        });
        next.set(key, { ...existing, rows: merged });
      } else if (!existing) {
        // Default to locked (collapsed) so user just sees Date / Total / Unlock row.
        next.set(key, { date: key, rows, confirmed: true, locked: true });
      }
      return next;
    });
  };

  const processOne = async (item: ImageItem) => {
    setImages((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "processing" } : i)));
    try {
      const compressed = await resizeImage(item.file, 1600, 0.85);
      const b64 = await fileToBase64(compressed);
      const { data, error } = await supabase.functions.invoke("import-report-ocr", {
        body: { image_base64: b64, mime_type: compressed.type || "image/jpeg" },
      });
      if (error) throw new Error(error.message || "OCR failed");
      if (!data || data.error) throw new Error(data?.error || "OCR failed");

      const date = data.date || "";
      const rows: OcrRow[] = data.rows || [];
      const needsReview = !!data.needs_review || !date;

      setImages((prev) => prev.map((i) =>
        i.id === item.id ? { ...i, status: "done", date, rows, needsReview } : i
      ));
      if (date) upsertDay(date, rows);
    } catch (e: any) {
      setImages((prev) => prev.map((i) =>
        i.id === item.id ? { ...i, status: "error", error: e.message || "Failed" } : i
      ));
    }
  };

  const processAll = async () => {
    if (processing) return;
    setProcessing(true);
    const pending = images.filter((i) => i.status === "pending" || i.status === "error");
    for (const item of pending) {
      await processOne(item);
    }
    setProcessing(false);
    toast.success("Processing complete");
  };

  const updateDayCell = (date: string, table: string, field: keyof OcrRow, value: string) => {
    setDays((prev) => {
      const next = new Map(prev);
      const day = next.get(date);
      if (!day || day.locked) return prev;
      const rows = day.rows.map((r) =>
        r.table === table ? { ...r, [field]: field === "table" ? value : formatSpaced(value) } : r
      );
      next.set(date, { ...day, rows });
      return next;
    });
  };

  const toggleLockDay = (date: string) => {
    setDays((prev) => {
      const next = new Map(prev);
      const day = next.get(date);
      if (!day) return prev;
      next.set(date, { ...day, locked: !day.locked, confirmed: true });
      return next;
    });
  };

  /** Change a day's date — re-key in the map. Skip if target date already exists. */
  const renameDay = (oldDate: string, newDate: string) => {
    if (!newDate || newDate === oldDate) return;
    setDays((prev) => {
      const next = new Map(prev);
      const day = next.get(oldDate);
      if (!day) return prev;
      if (next.has(newDate)) {
        toast.error(`Date ${newDate} already exists in the list`);
        return prev;
      }
      next.delete(oldDate);
      next.set(newDate, { ...day, date: newDate });
      return next;
    });
    // Reflect new date on source images so subsequent merges line up.
    setImages((prev) => prev.map((i) => (i.date === oldDate ? { ...i, date: newDate } : i)));
  };

  const finishImport = async () => {
    const valid = Array.from(days.values()).filter((d) => d.date && d.date !== "unknown");
    if (valid.length === 0) {
      toast.error("Nothing to save");
      return;
    }
    let ok = 0;
    for (const day of valid) {
      try {
        await saveDay.mutateAsync({ date: day.date, rows: day.rows });
        ok++;
      } catch {
        // toast already shown by hook
      }
    }
    if (ok > 0) {
      setDays((prev) => {
        const next = new Map(prev);
        valid.forEach((d) => next.delete(d.date));
        return next;
      });
      setImages((prev) => prev.filter((i) => !i.date || !valid.find((d) => d.date === i.date)));
    }
  };

  const sortedDays = Array.from(days.values()).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Import Daily Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload report photos → OCR → review → confirm → save
          </p>
        </div>
        <Button
          onClick={finishImport}
          disabled={saveDay.isPending || Array.from(days.values()).every((d) => !d.confirmed)}
          className="gap-2"
        >
          {saveDay.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Finish Import
        </Button>
      </div>

      {/* Upload */}
      <Card
        className={`p-4 md:p-6 border-2 border-dashed transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="text-center space-y-3">
          <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Drag & drop photos here</p>
            <p className="text-xs text-muted-foreground">or use the buttons below (multiple at once)</p>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => galleryRef.current?.click()} className="gap-2">
              <ImageIcon className="w-4 h-4" /> Upload Photos
            </Button>
            <Button variant="outline" size="sm" onClick={() => cameraRef.current?.click()} className="gap-2">
              <Camera className="w-4 h-4" /> Take Photo
            </Button>
            <Button
              size="sm"
              onClick={processAll}
              disabled={processing || images.length === 0}
              className="gap-2"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Process ({images.filter((i) => i.status === "pending" || i.status === "error").length})
            </Button>
          </div>
          <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </div>
      </Card>

      {/* Image thumbnails */}
      {images.length > 0 && (
        <Card className="p-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {images.map((img) => (
              <div key={img.id} className="relative group rounded-md overflow-hidden border bg-muted aspect-square">
                <img src={img.previewUrl} alt="upload" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-background/80 text-[10px] font-mono flex items-center justify-between">
                  {img.status === "processing" && <><Loader2 className="w-3 h-3 animate-spin" /> <span>OCR…</span></>}
                  {img.status === "pending" && <span className="text-muted-foreground">Pending</span>}
                  {img.status === "done" && (
                    img.needsReview
                      ? <><AlertTriangle className="w-3 h-3 text-warning" /> <span>Review</span></>
                      : <><CheckCircle2 className="w-3 h-3 text-success" /> <span>{img.date || "?"}</span></>
                  )}
                  {img.status === "error" && <><AlertTriangle className="w-3 h-3 text-destructive" /> <span>Error</span></>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Per-day preview */}
      {sortedDays.map((day) => (
        <Card key={day.date} className="p-3 md:p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base md:text-lg font-mono">{day.date}</h3>
              {day.confirmed && (
                <Badge variant="default" className="gap-1">
                  <Lock className="w-3 h-3" /> Confirmed
                </Badge>
              )}
            </div>
            <Button
              variant={day.confirmed ? "outline" : "default"}
              size="sm"
              onClick={() => toggleConfirmDay(day.date)}
              className="gap-2"
            >
              {day.confirmed ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Confirm Day</>}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Table</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>Fill</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Close</TableHead>
                  <TableHead>Drop</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {day.rows.map((r) => (
                  <TableRow key={r.table} className={r.table === "Total" ? "font-bold bg-muted/40" : ""}>
                    <TableCell className="font-mono">{r.table}</TableCell>
                    {(["open", "fill", "credit", "close", "drop", "result"] as const).map((field) => (
                      <TableCell key={field} className="p-1">
                        <Input
                          value={r[field]}
                          disabled={day.locked}
                          onChange={(e) => updateDayCell(day.date, r.table, field, e.target.value)}
                          className="h-8 font-mono text-right text-xs"
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ))}

      {sortedDays.length === 0 && images.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">
          No data yet — upload photos and click Process.
        </p>
      )}
    </div>
  );
};

export default ImportReports;
