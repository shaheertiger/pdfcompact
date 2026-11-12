/**
 * Resize photos in the browser: exact pixels, percent, or a preset canvas
 * (Instagram, YouTube…) with contain / cover / stretch fitting.
 */
import {
  canEncodeWebp,
  canvasBlob,
  ctx2d,
  decodeImage,
  makeCanvas,
  releaseSource,
  resizeToCanvas,
  sniffType,
  sourceSize,
  MAX_CANVAS_PIXELS,
  MAX_CANVAS_SIDE,
  type OutputType,
} from "@/lib/image-utils";

export type FitMode = "contain" | "cover" | "stretch";

export type ResizePreset = { id: string; label: string; group: string; w: number; h: number };

export const RESIZE_PRESETS: ResizePreset[] = [
  { id: "ig-square", label: "Instagram post (square)", group: "Instagram", w: 1080, h: 1080 },
  { id: "ig-portrait", label: "Instagram post (portrait 4:5)", group: "Instagram", w: 1080, h: 1350 },
  { id: "ig-story", label: "Instagram / TikTok story, Reels", group: "Instagram", w: 1080, h: 1920 },
  { id: "fb-cover", label: "Facebook page cover", group: "Facebook", w: 851, h: 315 },
  { id: "yt-thumb", label: "YouTube thumbnail", group: "YouTube", w: 1280, h: 720 },
  { id: "li-banner", label: "LinkedIn profile banner", group: "LinkedIn", w: 1584, h: 396 },
  { id: "x-header", label: "X (Twitter) header", group: "X", w: 1500, h: 500 },
  { id: "passport", label: "Passport / visa photo (square)", group: "Photo ID", w: 600, h: 600 },
  { id: "fullhd", label: "Full HD / website hero", group: "Web", w: 1920, h: 1080 },
];

export type ResizeSpec =
  | { kind: "pixels"; w: number; h: number; lock: boolean; lockBy: "width" | "height"; fit: FitMode }
  | { kind: "percent"; pct: number }
  | { kind: "preset"; w: number; h: number; fit: FitMode };

export type ResizeOptions = {
  spec: ResizeSpec;
  format: "keep" | OutputType;
  quality: number; // 0–1 for JPG/WebP
  /** CSS colour for contain padding, or "transparent" (PNG/WebP only). */
  background: string;
};

export type ResizeResult = {
  blob: Blob;
  type: OutputType;
  width: number;
  height: number;
  inWidth: number;
  inHeight: number;
  upscaled: boolean;
};

/** Output canvas size for an input of iw × ih. */
export function targetSize(spec: ResizeSpec, iw: number, ih: number): { w: number; h: number } {
  if (spec.kind === "percent") return { w: Math.max(1, Math.round((iw * spec.pct) / 100)), h: Math.max(1, Math.round((ih * spec.pct) / 100)) };
  if (spec.kind === "pixels" && spec.lock) {
    if (spec.lockBy === "height") return { w: Math.max(1, Math.round((spec.h * iw) / ih)), h: Math.max(1, Math.round(spec.h)) };
    return { w: Math.max(1, Math.round(spec.w)), h: Math.max(1, Math.round((spec.w * ih) / iw)) };
  }
  return { w: Math.max(1, Math.round(spec.w)), h: Math.max(1, Math.round(spec.h)) };
}

export async function resizeImage(file: File, o: ResizeOptions): Promise<ResizeResult> {
  const inType = await sniffType(file);
  let type: OutputType =
    o.format !== "keep" ? o.format : inType === "image/png" || inType === "image/webp" ? (inType as OutputType) : "image/jpeg";
  if (type === "image/webp" && !canEncodeWebp()) type = "image/jpeg";

  const src = await decodeImage(file);
  try {
    const { width: iw, height: ih } = sourceSize(src);
    const { w, h } = targetSize(o.spec, iw, ih);
    if (w > MAX_CANVAS_SIDE || h > MAX_CANVAS_SIDE || w * h > MAX_CANVAS_PIXELS) {
      throw new Error(`${w}×${h} is larger than browsers can safely create (max ${MAX_CANVAS_SIDE} px a side, about 16 megapixels).`);
    }
    const fit: FitMode = o.spec.kind === "percent" || (o.spec.kind === "pixels" && o.spec.lock) ? "stretch" : o.spec.fit;
    const transparent = o.background === "transparent" && type !== "image/jpeg";
    const bg = transparent ? undefined : o.background === "transparent" ? "#ffffff" : o.background;

    let out: HTMLCanvasElement;
    let upscaled = false;
    if (fit === "stretch") {
      upscaled = w > iw || h > ih;
      out = resizeToCanvas(src, iw, ih, w, h, type === "image/jpeg" ? "#ffffff" : undefined);
    } else {
      const s = fit === "contain" ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
      upscaled = s > 1;
      const dw = Math.max(1, Math.round(iw * s));
      const dh = Math.max(1, Math.round(ih * s));
      const scaled = resizeToCanvas(src, iw, ih, dw, dh);
      out = makeCanvas(w, h);
      const ctx = ctx2d(out);
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
      }
      // Centre: contain pads the sides, cover crops the overflow equally.
      ctx.drawImage(scaled, Math.round((w - dw) / 2), Math.round((h - dh) / 2));
    }
    const blob = await canvasBlob(out, type, type === "image/png" ? undefined : o.quality);
    return { blob, type, width: w, height: h, inWidth: iw, inHeight: ih, upscaled };
  } finally {
    releaseSource(src);
  }
}
