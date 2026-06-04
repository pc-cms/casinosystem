// Camera/file capture with live preview + retake. Uses the OS picker so it
// works on iOS Safari (no native camera SDK needed).
import { useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw } from "lucide-react";

interface Props {
  facing: "user" | "environment";
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  gold: string;
  goldDeep: string;
  /** Max longest-side in pixels (default 1600) */
  maxSize?: number;
  /** JPEG quality 0-1 (default 0.82) */
  quality?: number;
  /** Allow picking from gallery in addition to camera (default false) */
  allowGallery?: boolean;
}

async function fileToCompressedDataUrl(file: File, maxSize: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  const url = URL.createObjectURL(file);
  try {
    const img = bitmap
      ? null
      : await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = url;
        });
    const w = bitmap?.width ?? (img as HTMLImageElement).width;
    const h = bitmap?.height ?? (img as HTMLImageElement).height;
    const scale = Math.min(1, maxSize / Math.max(w, h));
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    if (bitmap) ctx.drawImage(bitmap, 0, 0, cw, ch);
    else ctx.drawImage(img as HTMLImageElement, 0, 0, cw, ch);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function CameraCapture({
  facing, label, value, onChange, gold, goldDeep, maxSize = 1600, quality = 0.82, allowGallery = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();
  const pickGallery = () => galleryRef.current?.click();

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset for retake
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, maxSize, quality);
      onChange(dataUrl);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={facing}
        className="hidden"
        onChange={handleChange}
      />

      {value ? (
        <div className="space-y-2">
          <div
            className="rounded-lg overflow-hidden border"
            style={{ borderColor: `${gold}55` }}
          >
            <img src={value} alt={label} className="w-full h-64 object-cover" />
          </div>
          <button
            type="button"
            onClick={pick}
            className="w-full h-11 rounded-md border font-faberge text-[10px] tracking-[0.3em] uppercase flex items-center justify-center gap-2"
            style={{ color: gold, borderColor: `${gold}55`, backgroundColor: "rgba(0,0,0,0.4)" }}
          >
            <RotateCcw className="w-4 h-4" /> Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="w-full h-64 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-colors"
          style={{
            borderColor: `${gold}55`,
            backgroundColor: "rgba(0,0,0,0.4)",
            color: gold,
          }}
        >
          <Camera className="w-10 h-10" />
          <span className="font-faberge text-[11px] tracking-[0.3em] uppercase">
            {busy ? "Processing…" : `Tap to capture ${label}`}
          </span>
          <span className="text-[9px] tracking-[0.25em] uppercase" style={{ color: goldDeep }}>
            {facing === "user" ? "Front camera" : "Back camera"}
          </span>
        </button>
      )}
    </div>
  );
}
