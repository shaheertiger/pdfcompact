/**
 * Crop helpers: margins are given as the page looks on screen (top, right,
 * bottom, left in points) and mapped onto the page's unrotated user space.
 */
import type { PDFPage } from "pdf-lib";
import type { PdfDoc } from "@/lib/pdfjs";

export type Margins = { top: number; right: number; bottom: number; left: number };
export type Scope = "all" | "current" | "odd" | "even";
type Box = { x: number; y: number; width: number; height: number };

export const PT_PER_MM = 72 / 25.4;
export const PT_PER_IN = 72;

/** The visible area of a page: CropBox clipped to MediaBox. */
export function visibleBox(page: PDFPage): Box {
  const c = page.getCropBox();
  const m = page.getMediaBox();
  const x1 = Math.max(c.x, m.x);
  const y1 = Math.max(c.y, m.y);
  const x2 = Math.min(c.x + c.width, m.x + m.width);
  const y2 = Math.min(c.y + c.height, m.y + m.height);
  return { x: x1, y: y1, width: Math.max(1, x2 - x1), height: Math.max(1, y2 - y1) };
}

/** Map on-screen margins to user-space margins (left/right on x, bottom/top on y). */
export function userMargins(m: Margins, rotation: number) {
  const rot = ((rotation % 360) + 360) % 360;
  switch (rot) {
    case 90:
      return { xLow: m.top, xHigh: m.bottom, yLow: m.left, yHigh: m.right };
    case 180:
      return { xLow: m.right, xHigh: m.left, yLow: m.top, yHigh: m.bottom };
    case 270:
      return { xLow: m.bottom, xHigh: m.top, yLow: m.right, yHigh: m.left };
    default:
      return { xLow: m.left, xHigh: m.right, yLow: m.bottom, yHigh: m.top };
  }
}

/** The new box for a page, keeping at least 18 pt (about 6 mm) on each axis. */
export function croppedBox(page: PDFPage, m: Margins): Box {
  const b = visibleBox(page);
  const u = userMargins(m, page.getRotation().angle);
  const MIN = 18;
  let xLow = Math.max(0, u.xLow);
  let xHigh = Math.max(0, u.xHigh);
  let yLow = Math.max(0, u.yLow);
  let yHigh = Math.max(0, u.yHigh);
  if (b.width - xLow - xHigh < MIN) {
    const k = (b.width - MIN) / Math.max(1e-6, xLow + xHigh);
    xLow *= k;
    xHigh *= k;
  }
  if (b.height - yLow - yHigh < MIN) {
    const k = (b.height - MIN) / Math.max(1e-6, yLow + yHigh);
    yLow *= k;
    yHigh *= k;
  }
  return { x: b.x + xLow, y: b.y + yLow, width: b.width - xLow - xHigh, height: b.height - yLow - yHigh };
}

export function pagesInScope(scope: Scope, current: number, count: number): number[] {
  const all = Array.from({ length: count }, (_, i) => i);
  if (scope === "current") return [current - 1];
  if (scope === "odd") return all.filter((i) => i % 2 === 0);
  if (scope === "even") return all.filter((i) => i % 2 === 1);
  return all;
}

export async function applyCrop(
  bytes: ArrayBuffer,
  m: Margins,
  pages: number[],
  permanent: boolean,
): Promise<{ bytes: Uint8Array; boxes: Box[] }> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes);
  const boxes: Box[] = [];
  for (const i of pages) {
    const page = doc.getPage(i);
    const b = croppedBox(page, m);
    page.setCropBox(b.x, b.y, b.width, b.height);
    if (permanent) {
      page.setMediaBox(b.x, b.y, b.width, b.height);
      page.setTrimBox(b.x, b.y, b.width, b.height);
      page.setBleedBox(b.x, b.y, b.width, b.height);
      page.setArtBox(b.x, b.y, b.width, b.height);
    }
    boxes.push(b);
  }
  return { bytes: await doc.save(), boxes };
}

/**
 * Find the content's bounding box on screen-oriented pages, rendered small.
 * Returns the margins (in points, as displayed) that fit every sampled page,
 * so nothing on any page gets cut.
 */
export async function detectMargins(
  pdf: PdfDoc,
  pageNumbers: number[],
  onProgress?: (done: number, total: number) => Promise<void> | void,
): Promise<Margins | null> {
  // Sample up to 40 pages spread through the document.
  const sample =
    pageNumbers.length <= 40
      ? pageNumbers
      : Array.from({ length: 40 }, (_, k) => pageNumbers[Math.round((k * (pageNumbers.length - 1)) / 39)]);
  let best: Margins | null = null;
  let done = 0;
  for (const n of sample) {
    const page = await pdf.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = 300 / Math.max(vp1.width, vp1.height);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
    page.cleanup();
    const { data, width: w, height: h } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Background = the most common colour among the border pixels (white paper, or a scan's grey).
    const counts = new Map<number, number>();
    const px = (x: number, y: number) => (y * w + x) * 4;
    const key = (i: number) => ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    for (let x = 0; x < w; x++)
      for (const y of [0, h - 1]) counts.set(key(px(x, y)), (counts.get(key(px(x, y))) ?? 0) + 1);
    for (let y = 0; y < h; y++)
      for (const x of [0, w - 1]) counts.set(key(px(x, y)), (counts.get(key(px(x, y))) ?? 0) + 1);
    let bgKey = 0xfff;
    let bgCount = -1;
    for (const [k, c] of counts) if (c > bgCount) [bgKey, bgCount] = [k, c];
    const br = ((bgKey >> 8) & 15) * 16 + 8;
    const bg = ((bgKey >> 4) & 15) * 16 + 8;
    const bb = (bgKey & 15) * 16 + 8;

    const rowHits = new Uint32Array(h);
    const colHits = new Uint32Array(w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = px(x, y);
        const diff = Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb);
        if (diff > 60) {
          rowHits[y]++;
          colHits[x]++;
        }
      }
    }
    // Ignore specks: a row or column needs a couple of content pixels.
    const minHits = 2;
    let top = 0;
    while (top < h && rowHits[top] < minHits) top++;
    if (top >= h) {
      done++;
      continue; // blank page: no constraint
    }
    let bottom = h - 1;
    while (bottom > top && rowHits[bottom] < minHits) bottom--;
    let left = 0;
    while (left < w && colHits[left] < minHits) left++;
    let right = w - 1;
    while (right > left && colHits[right] < minHits) right--;

    const k = vp1.width / w; // points per pixel
    const pad = 1.5; // pixels of breathing room at this resolution
    const m: Margins = {
      top: Math.max(0, (top - pad) * k),
      bottom: Math.max(0, (h - 1 - bottom - pad) * k),
      left: Math.max(0, (left - pad) * k),
      right: Math.max(0, (w - 1 - right - pad) * k),
    };
    best = best
      ? {
          top: Math.min(best.top, m.top),
          right: Math.min(best.right, m.right),
          bottom: Math.min(best.bottom, m.bottom),
          left: Math.min(best.left, m.left),
        }
      : m;
    done++;
    if (onProgress) await onProgress(done, sample.length);
  }
  return best;
}
