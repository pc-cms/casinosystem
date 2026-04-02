/**
 * Client-side image compression.
 * Produces thumbnail (200KB) + keeps original for storage.
 * Optimized for iPhone photos (3-5MB HEIC/JPEG).
 */

type CompressResult = {
  thumbnail: Blob;
  original: Blob;
  thumbnailUrl: string;
};

const MAX_THUMBNAIL_WIDTH = 800;
const THUMBNAIL_QUALITY = 0.7;

export async function compressImage(file: File): Promise<CompressResult> {
  const original = file;

  // Create thumbnail via canvas
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  // Calculate thumbnail dimensions maintaining aspect ratio
  let width = img.width;
  let height = img.height;
  if (width > MAX_THUMBNAIL_WIDTH) {
    height = Math.round((height * MAX_THUMBNAIL_WIDTH) / width);
    width = MAX_THUMBNAIL_WIDTH;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  const thumbnail = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
      "image/jpeg",
      THUMBNAIL_QUALITY
    );
  });

  // If thumbnail is still > 200KB, reduce quality further
  let finalThumb = thumbnail;
  if (finalThumb.size > 200 * 1024) {
    const lowerQ = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        0.5
      );
    });
    finalThumb = lowerQ;
  }

  return {
    thumbnail: finalThumb,
    original,
    thumbnailUrl: URL.createObjectURL(finalThumb),
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate a thumbnail filename from original.
 * e.g. "photo.jpg" → "photo_thumb.jpg"
 */
export function thumbnailPath(originalPath: string): string {
  const lastDot = originalPath.lastIndexOf(".");
  if (lastDot === -1) return `${originalPath}_thumb`;
  return `${originalPath.slice(0, lastDot)}_thumb${originalPath.slice(lastDot)}`;
}
