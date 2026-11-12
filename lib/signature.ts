/** Canvas helpers for signature images (browser only). */
import { canvasToPngBytes } from "./pdf-stamp";

export type SignatureImage = { bytes: Uint8Array; kind: "png"; width: number; height: number; url: string };

/** Crop a canvas to its non-transparent pixels plus a little padding. */
export function trimCanvas(src: HTMLCanvasElement, pad = 6): HTMLCanvasElement | null {
  const ctx = src.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d")?.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export async function canvasToSignature(canvas: HTMLCanvasElement): Promise<SignatureImage> {
  const bytes = await canvasToPngBytes(canvas);
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: "image/png" }));
  return { bytes, kind: "png", width: canvas.width, height: canvas.height, url };
}

/**
 * Make light paper transparent: pixels brighter than `level` (0–255) fade
 * out, darker ink stays. A soft ramp keeps the edges of strokes smooth.
 */
export function removeLightBackground(canvas: HTMLCanvasElement, level = 200) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hi = Math.min(255, level + 25);
  const lo = Math.max(0, level - 60);
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const a = l >= hi ? 0 : l <= lo ? 1 : (hi - l) / (hi - lo);
    d[i + 3] = Math.round(d[i + 3] * a);
  }
  ctx.putImageData(img, 0, 0);
}

/** Decode an uploaded image into a canvas no larger than `max` px on its long side. */
export async function imageFileToCanvas(file: File, max = 1600): Promise<HTMLCanvasElement> {
  if (/\.(heic|heif)$/i.test(file.name)) throw new Error("HEIC photos aren't supported here. Convert to JPG first.");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Couldn't read this image. Use a PNG, JPG or WebP file.");
  }
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

/** Render text in a (loaded) web font to a trimmed transparent canvas. */
export async function renderTypedSignature(text: string, family: string, color: string, px = 96): Promise<HTMLCanvasElement | null> {
  try {
    await document.fonts.load(`${px}px ${family}`, text);
  } catch {
    // fall back to whatever is available
  }
  const m = document.createElement("canvas").getContext("2d");
  if (!m) return null;
  m.font = `${px}px ${family}`;
  const w = Math.ceil(m.measureText(text).width + px);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = Math.ceil(px * 1.8);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.font = `${px}px ${family}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, px / 2, px * 1.2);
  return trimCanvas(c, 4);
}
