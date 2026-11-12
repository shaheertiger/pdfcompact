/**
 * Image compression in the browser: quality-based or "fit under N KB".
 *
 * JPG and WebP are re-encoded with the canvas encoder. PNG stays lossless
 * unless the user picks a colour count, in which case it is quantized to a
 * palette (up to 256 colours) with UPNG, the same idea as TinyPNG: great for
 * screenshots and logos, visible banding on photos.
 *
 * Re-encoding through a canvas drops all metadata (EXIF, GPS location,
 * camera serial numbers), which is a privacy win as well as a size win.
 */
import {
  canEncodeWebp,
  canvasBlob,
  canvasHasAlpha,
  ctx2d,
  decodeImage,
  flattenCanvas,
  releaseSource,
  resizeToCanvas,
  safeScale,
  sniffType,
  sourceSize,
  yieldToUi,
  type OutputType,
} from "@/lib/image-utils";

export type FormatChoice = "keep" | "image/jpeg" | "image/webp";
export type PngColors = 0 | 256 | 128 | 64 | 32;

export type CompressSettings = {
  mode: "quality" | "target";
  /** 10–95 */
  quality: number;
  targetBytes: number;
  format: FormatChoice;
  /** Longest side cap in px; 0 = keep size. */
  maxSide: number;
  /** For PNG output in quality mode: 0 = lossless. */
  pngColors: PngColors;
};

export type CompressResult = {
  blob: Blob;
  type: OutputType;
  width: number;
  height: number;
  /** What produced the result, for the UI ("JPG 72%", "PNG 128 colours"). */
  detail: string;
  /** The original file was returned unchanged. */
  keptOriginal: boolean;
  /** Target mode only: false if even the smallest attempt was over the target. */
  metTarget: boolean;
  /** Notes worth showing (transparency flattened, WebP unsupported…). */
  notes: string[];
  inputType: string;
  inputWidth: number;
  inputHeight: number;
};

type Upng = { encode: (bufs: ArrayBuffer[], w: number, h: number, ps: number) => ArrayBuffer };
let upngPromise: Promise<Upng> | null = null;
function loadUpng(): Promise<Upng> {
  // UPNG ships with pdf-lib (its PNG reader); loaded only when a PNG is quantized.
  upngPromise ??= import("@pdf-lib/upng").then((m) => (m.default ?? m) as unknown as Upng);
  return upngPromise;
}

async function encodePng(canvas: HTMLCanvasElement, colors: PngColors): Promise<Blob> {
  if (!colors) return canvasBlob(canvas, "image/png");
  const UPNG = await loadUpng();
  const { data } = ctx2d(canvas, true).getImageData(0, 0, canvas.width, canvas.height);
  const buf = UPNG.encode([data.buffer as ArrayBuffer], canvas.width, canvas.height, colors);
  return new Blob([buf], { type: "image/png" });
}

async function encode(canvas: HTMLCanvasElement, type: OutputType, q: number, colors: PngColors): Promise<Blob> {
  if (type === "image/png") return encodePng(canvas, colors);
  return canvasBlob(canvas, type, q);
}

const pct = (q: number) => `${Math.round(q * 100)}%`;
const LABEL: Record<OutputType, string> = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WebP" };

export async function compressImage(file: File, s: CompressSettings): Promise<CompressResult> {
  const inputType = await sniffType(file);
  const notes: string[] = [];
  let type: OutputType;
  if (s.format === "keep") {
    type = inputType === "image/png" || inputType === "image/webp" ? (inputType as OutputType) : "image/jpeg";
    if (!/^image\/(jpeg|png|webp)$/.test(inputType)) notes.push("Saved as JPG (the original format can't be written by a browser).");
  } else {
    type = s.format;
  }
  if (type === "image/webp" && !canEncodeWebp()) {
    type = "image/jpeg";
    notes.push("This browser can't save WebP, so the result is a JPG.");
  }

  const src = await decodeImage(file);
  try {
    const { width: W, height: H } = sourceSize(src);
    const cap = s.maxSide > 0 ? Math.min(1, s.maxSide / Math.max(W, H)) : 1;
    let scale = Math.min(cap, safeScale(W, H));
    if (scale < cap) notes.push("Very large image: scaled down to fit this browser's canvas limit.");

    let alphaChecked = false;
    const render = (sc: number) => {
      const w = Math.max(1, Math.round(W * sc));
      const h = Math.max(1, Math.round(H * sc));
      let c = resizeToCanvas(src, W, H, w, h);
      if (type === "image/jpeg") {
        if (!alphaChecked && (inputType === "image/png" || inputType === "image/webp")) {
          alphaChecked = true;
          if (canvasHasAlpha(c)) notes.push("Transparent areas were filled with white (JPG has no transparency).");
        }
        c = flattenCanvas(c);
      }
      return c;
    };
    const base = { type, inputType, inputWidth: W, inputHeight: H, notes };
    const sameType = type === inputType;

    if (s.mode === "quality") {
      const canvas = render(scale);
      const q = Math.min(0.95, Math.max(0.1, s.quality / 100));
      const blob = await encode(canvas, type, q, s.pngColors);
      const detail = type === "image/png" ? (s.pngColors ? `PNG ${s.pngColors} colours` : "PNG lossless") : `${LABEL[type]} ${pct(q)}`;
      if (sameType && scale === 1 && blob.size >= file.size) {
        return { ...base, blob: file, width: W, height: H, detail: "original kept", keptOriginal: true, metTarget: true };
      }
      return { ...base, blob, width: canvas.width, height: canvas.height, detail, keptOriginal: false, metTarget: true };
    }

    // Target size: best quality that fits, then shrink dimensions if even low quality is too big.
    const T = s.targetBytes;
    if (sameType && scale === 1 && file.size <= T && type !== "image/png") {
      // Already under the target: re-save once (drops metadata) but never return something bigger.
      const hi = await encode(render(1), type, 0.92, 0);
      if (hi.size >= file.size) {
        notes.push("Already under the target size, so the original file was kept.");
        return { ...base, blob: file, width: W, height: H, detail: "original kept", keptOriginal: true, metTarget: true };
      }
    }
    let smallest: { blob: Blob; w: number; h: number; detail: string } | null = null;
    let fitted: { blob: Blob; w: number; h: number; detail: string } | null = null;
    let lowQTries = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      await yieldToUi();
      const canvas = render(scale);
      const dims = { w: canvas.width, h: canvas.height };
      const scaleNote = scale < 1 ? ", resized" : "";
      let floorSize: number;
      if (type === "image/png") {
        let found: Blob | null = null;
        let detail = "";
        for (const colors of [0, 256, 128, 64] as PngColors[]) {
          const b = await encode(canvas, type, 1, colors);
          if (!smallest || b.size < smallest.blob.size) smallest = { blob: b, ...dims, detail: colors ? `PNG ${colors} colours` : "PNG lossless" };
          if (b.size <= T) {
            found = b;
            detail = colors ? `PNG ${colors} colours` : "PNG lossless";
            break;
          }
          floorSize = b.size;
        }
        if (found) return { ...base, blob: found, width: dims.w, height: dims.h, detail: detail + scaleNote, keptOriginal: false, metTarget: true };
        floorSize = smallest!.blob.size;
      } else {
        const LO = 0.4;
        const HI = 0.92;
        const hi = await encode(canvas, type, HI, 0);
        if (hi.size <= T) {
          return { ...base, blob: hi, width: dims.w, height: dims.h, detail: `${LABEL[type]} ${pct(HI)}${scaleNote}`, keptOriginal: false, metTarget: true };
        }
        const lo = await encode(canvas, type, LO, 0);
        if (!smallest || lo.size < smallest.blob.size) smallest = { blob: lo, ...dims, detail: `${LABEL[type]} ${pct(LO)}${scaleNote}` };
        if (lo.size <= T) {
          let best = lo;
          let bestQ = LO;
          let a = LO;
          let b = HI;
          for (let i = 0; i < 6; i++) {
            const mid = (a + b) / 2;
            const m = await encode(canvas, type, mid, 0);
            if (m.size <= T) {
              best = m;
              bestQ = mid;
              a = mid;
            } else b = mid;
          }
          const r = { blob: best, ...dims, detail: `${LABEL[type]} ${pct(bestQ)}${scaleNote}` };
          // Full size at 40%+ is fine. Once we're resizing anyway, aim for 60%+:
          // shrink a little more rather than crush the quality.
          if (scale === Math.min(cap, safeScale(W, H)) || bestQ >= 0.6 || lowQTries >= 2) {
            return { ...base, blob: r.blob, width: r.w, height: r.h, detail: r.detail, keptOriginal: false, metTarget: true };
          }
          fitted = r;
          lowQTries++;
          floorSize = (await encode(canvas, type, 0.7, 0)).size;
          scale *= Math.min(0.95, Math.sqrt(T / floorSize) * 0.97);
          continue;
        }
        // Shrink so the next round lands near 70% quality: a slightly smaller,
        // clean image looks better than a full-size one crushed to 10%.
        floorSize = (await encode(canvas, type, 0.7, 0)).size;
      }
      // Bytes scale roughly with pixel count: shrink by the square root of the ratio, with headroom.
      const shrink = Math.min(0.9, Math.sqrt(T / floorSize) * 0.95);
      scale *= shrink;
      if (W * scale < 16 || H * scale < 16) break;
    }
    if (fitted) return { ...base, blob: fitted.blob, width: fitted.w, height: fitted.h, detail: fitted.detail, keptOriginal: false, metTarget: true };
    const s2 = smallest!;
    return { ...base, blob: s2.blob, width: s2.w, height: s2.h, detail: s2.detail, keptOriginal: false, metTarget: false };
  } finally {
    releaseSource(src);
  }
}

export function outputName(file: File, type: OutputType): string {
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  const ext = type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
  return `${base}-compressed.${ext}`;
}
