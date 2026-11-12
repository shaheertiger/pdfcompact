"use client";

/**
 * Image handling for Scan to PDF: import photos, rotate, crop and clean them
 * up with a "document" filter (white paper, black text) on a canvas.
 */

export type ScanFilter = "original" | "document" | "bw";
export type Rotation = 0 | 90 | 180 | 270;
/** Crop rectangle in 0–1 units of the rotated image. */
export type Crop = { x: number; y: number; w: number; h: number };
export const FULL_CROP: Crop = { x: 0, y: 0, w: 1, h: 1 };

/** Longest side we keep for a page (about 210 DPI on A4). Bigger photos are scaled down on import. */
export const WORKING_MAX = 2480;
const PREVIEW_MAX = 900;

export type ImportedImage = {
  /** Working copy, JPEG, at most WORKING_MAX px on the long side. */
  blob: Blob;
  width: number;
  height: number;
  /** Small decoded copy for thumbnails and the crop editor. */
  preview: ImageBitmap;
};

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d", { willReadFrequently: false });
  if (!ctx) throw new Error("Your browser blocked the canvas this tool needs.");
  return [c, ctx];
}

export function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the image."))), type, quality)
  );
}

/** Decode a photo (EXIF orientation applied), scale it down and keep a JPEG working copy. */
export async function importImage(source: Blob): Promise<ImportedImage> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    throw new Error("unreadable");
  }
  const s = Math.min(1, WORKING_MAX / Math.max(bmp.width, bmp.height));
  const [c, ctx] = canvasOf(bmp.width * s, bmp.height * s);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const blob = await toBlob(c, "image/jpeg", 0.92);
  const ps = Math.min(1, PREVIEW_MAX / Math.max(c.width, c.height));
  const preview = await createImageBitmap(c, {
    resizeWidth: Math.round(c.width * ps),
    resizeHeight: Math.round(c.height * ps),
    resizeQuality: "high",
  });
  const out = { blob, width: c.width, height: c.height, preview };
  c.width = c.height = 0;
  return out;
}

/** Rotate a crop rectangle along with a 90° clockwise turn of the image. */
export function rotateCropCW(c: Crop): Crop {
  return { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w };
}

/**
 * Draw `src` rotated, cropped and filtered onto a new canvas whose long side
 * is at most `maxSide`.
 */
export function renderScan(
  src: CanvasImageSource & { width: number; height: number },
  opts: { rotation: Rotation; crop: Crop; filter: ScanFilter },
  maxSide: number
): HTMLCanvasElement {
  const { rotation, crop, filter } = opts;
  const turned = rotation === 90 || rotation === 270;
  const rw = turned ? src.height : src.width;
  const rh = turned ? src.width : src.height;
  const cx = crop.x * rw;
  const cy = crop.y * rh;
  const cw = Math.max(1, crop.w * rw);
  const ch = Math.max(1, crop.h * rh);
  const s = Math.min(1, maxSide / Math.max(cw, ch));
  const [c, ctx] = canvasOf(cw * s, ch * s);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = "high";
  ctx.scale(c.width / cw, c.height / ch);
  ctx.translate(-cx, -cy);
  if (rotation === 90) {
    ctx.translate(rw, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    ctx.translate(rw, rh);
    ctx.rotate(Math.PI);
  } else if (rotation === 270) {
    ctx.translate(0, rh);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(src, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (filter !== "original") applyDocumentFilter(ctx, c.width, c.height, filter);
  return c;
}

/**
 * "Document" and "Black & white" filters.
 *
 * 1. Convert to grey.
 * 2. Estimate the paper brightness in a coarse grid (brightest value per
 *    cell, spread to neighbours, smoothed) so shadows and uneven light are
 *    evened out. Large dark areas such as photos come out lighter.
 * 3. Divide by that background: paper becomes 1.0, ink stays dark.
 * 4. Document: stretch levels so paper is pure white and text is near black.
 *    Black & white: threshold with Otsu's method.
 */
export function applyDocumentFilter(ctx: CanvasRenderingContext2D, w: number, h: number, mode: "document" | "bw") {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  const L = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) L[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];

  // Background grid.
  const cell = Math.max(8, Math.round(Math.max(w, h) / 40));
  const gw = Math.ceil(w / cell);
  const gh = Math.ceil(h / cell);
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const y1 = Math.min(h, (gy + 1) * cell);
    for (let gx = 0; gx < gw; gx++) {
      const x1 = Math.min(w, (gx + 1) * cell);
      // 2nd-brightest-ish: max over a sparse sample to ignore single hot pixels.
      let m = 0;
      for (let y = gy * cell; y < y1; y += 2) {
        const row = y * w;
        for (let x = gx * cell; x < x1; x += 2) if (L[row + x] > m) m = L[row + x];
      }
      grid[gy * gw + gx] = m;
    }
  }
  // Dilate once so cells full of text borrow the paper value next to them,
  // then smooth twice so shadows fade out without blocky steps.
  let g = grid;
  const pass = (fn: (vals: number[]) => number) => {
    const nx = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++)
      for (let gx = 0; gx < gw; gx++) {
        const vals: number[] = [];
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const yy = gy + dy, xx = gx + dx;
            if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) vals.push(g[yy * gw + xx]);
          }
        nx[gy * gw + gx] = fn(vals);
      }
    g = nx;
  };
  pass((v) => Math.max(...v));
  pass((v) => v.reduce((a, b) => a + b, 0) / v.length);
  pass((v) => v.reduce((a, b) => a + b, 0) / v.length);
  for (let i = 0; i < g.length; i++) g[i] = Math.max(g[i], 40);

  // Normalise with bilinear interpolation of the grid (cell centres).
  const N = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / cell - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / cell - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0;
      const top = g[y0 * gw + x0] * (1 - tx) + g[y0 * gw + x1] * tx;
      const bot = g[y1 * gw + x0] * (1 - tx) + g[y1 * gw + x1] * tx;
      const bg = top * (1 - ty) + bot * ty;
      const v = Math.min(1, L[y * w + x] / bg);
      N[y * w + x] = v;
      hist[Math.min(255, Math.round(v * 255))]++;
    }
  }

  if (mode === "document") {
    // Black point: 1st percentile of ink, capped so light pages still get contrast.
    let acc = 0, lo = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= n * 0.01) {
        lo = i / 255;
        break;
      }
    }
    lo = Math.min(lo, 0.45);
    const hi = 0.86;
    const span = Math.max(0.05, hi - lo);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      let v = (N[i] - lo) / span;
      v = v <= 0 ? 0 : v >= 1 ? 1 : Math.pow(v, 1.5);
      const o = v * 255;
      d[j] = d[j + 1] = d[j + 2] = o;
    }
  } else {
    // Otsu threshold on the normalised histogram.
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, t = 200;
    for (let i = 0; i < 256; i++) {
      wB += hist[i];
      if (!wB) continue;
      const wF = n - wB;
      if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) {
        best = between;
        t = i;
      }
    }
    const thr = Math.min(0.85, Math.max(0.5, t / 255));
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const o = N[i] < thr ? 0 : 255;
      d[j] = d[j + 1] = d[j + 2] = o;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export type PageSize = "a4" | "letter" | "fit";
export const PAGE_SIZES: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** Page box and where the image goes on it (PDF points, origin bottom-left). */
export function layoutPage(imgW: number, imgH: number, size: PageSize) {
  const landscape = imgW > imgH;
  if (size === "fit") {
    // Short side as wide as A4, long side follows the image (good for long receipts).
    const short = 595.28;
    const [pw, ph] = landscape ? [short * (imgW / imgH), short] : [short, short * (imgH / imgW)];
    return { pageW: pw, pageH: ph, x: 0, y: 0, w: pw, h: ph };
  }
  const [a, b] = PAGE_SIZES[size];
  const [pw, ph] = landscape ? [b, a] : [a, b];
  const s = Math.min(pw / imgW, ph / imgH);
  const w = imgW * s, h = imgH * s;
  return { pageW: pw, pageH: ph, x: (pw - w) / 2, y: (ph - h) / 2, w, h };
}
