import { StandardFonts, type PDFDocument, type PDFFont, type PDFImage } from "pdf-lib";
import { anchorCentered, displaySize, embedLoaded, hexToRgb, isolatePage, sendDrawingsToBack } from "./pdf-stamp";

export type WatermarkFont = "helvetica-bold" | "helvetica" | "times-bold";
export const watermarkFonts: Record<WatermarkFont, { std: StandardFonts; css: string; weight: number; label: string }> = {
  "helvetica-bold": { std: StandardFonts.HelveticaBold, css: "Helvetica, Arial, sans-serif", weight: 700, label: "Bold sans" },
  helvetica: { std: StandardFonts.Helvetica, css: "Helvetica, Arial, sans-serif", weight: 400, label: "Sans" },
  "times-bold": { std: StandardFonts.TimesRomanBold, css: '"Times New Roman", Times, serif', weight: 700, label: "Bold serif" },
};

export type WatermarkLayout = "center" | "tile";

export type WatermarkOptions = {
  kind: "text" | "image";
  text: string;
  font: WatermarkFont;
  /** Percent of the size that would just fit the page (centre mode reference). */
  sizePct: number;
  color: string;
  opacity: number;
  /** Degrees, counter-clockwise as the reader sees the page. */
  angle: number;
  layout: WatermarkLayout;
  /** 0-based page indices. */
  pages: number[];
  layer: "over" | "under";
  /** Image watermark, or text the standard fonts can't encode, pre-rendered. */
  image?: { bytes: Uint8Array; kind: "png" | "jpg"; width: number; height: number };
};

/** Width (at size 1) and cap height (at size 1) of the mark. */
export type MarkMetrics = { w1: number; h1: number };

export function textMetrics(font: PDFFont, text: string): MarkMetrics {
  return { w1: font.widthOfTextAtSize(text, 1), h1: font.heightAtSize(1, { descender: false }) * 0.95 };
}

export type Placement = { cx: number; cy: number };

/**
 * Lay out the watermark on one page: the size of the mark (w × h, points)
 * and the centre of every copy. Pure maths, shared by the preview and the
 * PDF writer so they always agree.
 */
export function layoutWatermark(pageW: number, pageH: number, m: MarkMetrics, opts: Pick<WatermarkOptions, "sizePct" | "angle" | "layout">) {
  const t = (opts.angle * Math.PI) / 180;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  // Size at which the rotated mark just fits inside 90% of the page.
  const fit = Math.min((0.9 * pageW) / (m.w1 * c + m.h1 * s), (0.9 * pageH) / (m.w1 * s + m.h1 * c));
  const size = Math.max(1, (fit * opts.sizePct) / 100);
  const w = m.w1 * size;
  const h = m.h1 * size;
  if (opts.layout === "center") return { size, w, h, items: [{ cx: pageW / 2, cy: pageH / 2 }] };

  // Tile along the mark's own direction so copies never overlap.
  const stepU = w + Math.max(h * 2.5, 24);
  const stepV = h * 3.5 + 12;
  const ux = Math.cos(t);
  const uy = -Math.sin(t); // display y grows downwards
  const vx = Math.sin(t);
  const vy = Math.cos(t);
  const reach = Math.hypot(pageW, pageH) / 2 + w;
  const items: Placement[] = [];
  const nV = Math.ceil(reach / stepV);
  const nU = Math.ceil(reach / stepU) + 1;
  for (let j = -nV; j <= nV; j++) {
    const shift = (j % 2) * (stepU / 2);
    for (let i = -nU; i <= nU; i++) {
      const u = i * stepU + shift;
      const v = j * stepV;
      const cx = pageW / 2 + u * ux + v * vx;
      const cy = pageH / 2 + u * uy + v * vy;
      // Keep copies whose rotated box touches the page.
      const rx = (w * c + h * s) / 2;
      const ry = (w * s + h * c) / 2;
      if (cx + rx < 0 || cx - rx > pageW || cy + ry < 0 || cy - ry > pageH) continue;
      items.push({ cx, cy });
    }
  }
  return { size, w, h, items };
}

/** Stamp the watermark onto `doc` in place. */
export async function applyWatermark(
  doc: PDFDocument,
  opts: WatermarkOptions,
  onProgress?: (done: number, total: number) => Promise<void> | void
) {
  let font: PDFFont | null = null;
  let image: PDFImage | null = null;
  let metrics: MarkMetrics;
  if (opts.image) {
    image = await embedLoaded(doc, opts.image);
    metrics = { w1: opts.image.width / opts.image.height, h1: 1 };
  } else {
    font = await doc.embedFont(watermarkFonts[opts.font].std);
    metrics = textMetrics(font, opts.text);
  }
  const color = hexToRgb(opts.color);
  const pages = doc.getPages();
  for (let k = 0; k < opts.pages.length; k++) {
    const page = pages[opts.pages[k]];
    const { width, height } = displaySize(page);
    const lay = layoutWatermark(width, height, metrics, opts);
    isolatePage(doc, page);
    for (const it of lay.items) {
      const a = anchorCentered(page, it.cx, it.cy, lay.w, lay.h, opts.angle);
      if (image) {
        page.drawImage(image, { x: a.x, y: a.y, width: lay.w, height: lay.h, rotate: a.rotate, opacity: opts.opacity });
      } else if (font) {
        page.drawText(opts.text, { x: a.x, y: a.y, size: lay.size, font, color, rotate: a.rotate, opacity: opts.opacity });
      }
    }
    if (opts.layer === "under") sendDrawingsToBack(page);
    if (onProgress && (k % 5 === 4 || k === opts.pages.length - 1)) await onProgress(k + 1, opts.pages.length);
  }
}
