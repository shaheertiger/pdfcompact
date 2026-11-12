/**
 * Things a person places on PDF pages with the on-screen editor (images,
 * signatures, text, boxes, highlights, pen strokes), stored as fractions of
 * the displayed page so the same placement works on pages of other sizes, and
 * written into the PDF with lib/pdf-stamp's rotation/CropBox-aware mapping.
 */
import { BlendMode, LineCapStyle, StandardFonts, type PDFDocument, type PDFFont, type PDFImage } from "pdf-lib";
import { anchorBox, displaySize, embedLoaded, hexToRgb, isolatePage, toPdfPoint, pageRotation } from "./pdf-stamp";
import { degrees } from "pdf-lib";

/** Which pages an item goes on: one page, every page, or a list (0-based). */
export type Target = { mode: "one"; page: number } | { mode: "all" } | { mode: "list"; pages: number[] };

type Base = {
  id: string;
  /** Top-left corner and width as fractions of the displayed page. */
  fx: number;
  fy: number;
  fw: number;
  opacity: number;
  target: Target;
};

export type PlacedImage = Base & { kind: "image"; imgKey: string; /** width / height */ aspect: number };
export type TextFont = "helvetica" | "helvetica-bold" | "times" | "courier";
export type PlacedText = Base & {
  kind: "text";
  text: string;
  /** Font size as a fraction of the displayed page width (so it scales like images). */
  fsize: number;
  color: string;
  font: TextFont;
};
export type PlacedRect = Base & {
  kind: "rect";
  /** Height as a fraction of the displayed page height. */
  fh: number;
  style: "highlight" | "whiteout" | "box";
  color: string;
};
export type PlacedInk = Base & {
  kind: "ink";
  fh: number;
  /** Strokes; points are 0..1 within the item's box. */
  strokes: { x: number; y: number }[][];
  color: string;
  /** Stroke width as a fraction of the displayed page width. */
  fwidth: number;
};
export type Placed = PlacedImage | PlacedText | PlacedRect | PlacedInk;

export const textFonts: Record<TextFont, { std: StandardFonts; css: string; weight: number; label: string }> = {
  helvetica: { std: StandardFonts.Helvetica, css: "Helvetica, Arial, sans-serif", weight: 400, label: "Sans" },
  "helvetica-bold": { std: StandardFonts.HelveticaBold, css: "Helvetica, Arial, sans-serif", weight: 700, label: "Sans bold" },
  times: { std: StandardFonts.TimesRoman, css: '"Times New Roman", Times, serif', weight: 400, label: "Serif" },
  courier: { std: StandardFonts.Courier, css: '"Courier New", Courier, monospace', weight: 400, label: "Mono" },
};

export const LINE_HEIGHT = 1.2;

export function targetPages(t: Target, pageCount: number): number[] {
  if (t.mode === "one") return t.page < pageCount ? [t.page] : [];
  if (t.mode === "all") return Array.from({ length: pageCount }, (_, i) => i);
  return t.pages.filter((p) => p < pageCount);
}

export function onPage(t: Target, pageIndex: number): boolean {
  if (t.mode === "one") return t.page === pageIndex;
  if (t.mode === "all") return true;
  return t.pages.includes(pageIndex);
}

export type ImageSource = { bytes: Uint8Array; kind: "png" | "jpg" };

/**
 * Write every item into `doc`. `images` maps imgKey → bytes. Text items whose
 * characters the standard fonts can't encode must be converted to images by
 * the caller first (see textToPng).
 */
export async function applyPlacements(
  doc: PDFDocument,
  items: Placed[],
  images: Record<string, ImageSource>,
  onProgress?: (done: number, total: number) => Promise<void> | void
) {
  const pages = doc.getPages();
  const embedded = new Map<string, PDFImage>();
  const fonts = new Map<TextFont, PDFFont>();
  const work: { item: Placed; page: number }[] = [];
  for (const item of items) for (const p of targetPages(item.target, pages.length)) work.push({ item, page: p });
  // Draw in page order, items in the order they were added (later ones on top).
  work.sort((a, b) => a.page - b.page);

  for (let k = 0; k < work.length; k++) {
    const { item, page: pi } = work[k];
    const page = pages[pi];
    isolatePage(doc, page);
    const { width: W, height: H } = displaySize(page);
    const x = item.fx * W;
    const y = item.fy * H;
    const w = item.fw * W;

    if (item.kind === "image") {
      let img = embedded.get(item.imgKey);
      if (!img) {
        const src = images[item.imgKey];
        if (!src) continue;
        img = await embedLoaded(doc, src);
        embedded.set(item.imgKey, img);
      }
      const h = w / item.aspect;
      const a = anchorBox(page, x, y, h);
      page.drawImage(img, { x: a.x, y: a.y, width: w, height: h, rotate: a.rotate, opacity: item.opacity });
    } else if (item.kind === "text") {
      let font = fonts.get(item.font);
      if (!font) {
        font = await doc.embedFont(textFonts[item.font].std);
        fonts.set(item.font, font);
      }
      const size = item.fsize * W;
      const ascent = font.heightAtSize(size, { descender: false });
      const a = anchorBox(page, x, y, ascent);
      page.drawText(item.text, {
        x: a.x,
        y: a.y,
        rotate: a.rotate,
        size,
        font,
        color: hexToRgb(item.color),
        lineHeight: size * LINE_HEIGHT,
        opacity: item.opacity,
      });
    } else if (item.kind === "rect") {
      const h = item.fh * H;
      const a = anchorBox(page, x, y, h);
      if (item.style === "box") {
        const bw = Math.max(0.75, W * 0.002);
        page.drawRectangle({ x: a.x, y: a.y, width: w, height: h, rotate: a.rotate, borderColor: hexToRgb(item.color), borderWidth: bw, borderOpacity: item.opacity });
      } else {
        page.drawRectangle({
          x: a.x,
          y: a.y,
          width: w,
          height: h,
          rotate: a.rotate,
          color: hexToRgb(item.color),
          opacity: item.opacity,
          blendMode: item.style === "highlight" ? BlendMode.Multiply : undefined,
        });
      }
    } else if (item.kind === "ink") {
      const h = item.fh * H;
      const path = item.strokes
        .filter((s) => s.length > 0)
        .map((s) => {
          const pts = s.length === 1 ? [s[0], { x: s[0].x + 0.0001, y: s[0].y }] : s;
          return pts.map((p, i) => `${i ? "L" : "M"}${(p.x * w).toFixed(2)} ${(p.y * h).toFixed(2)}`).join(" ");
        })
        .join(" ");
      if (!path) continue;
      const o = toPdfPoint(page, x, y);
      page.drawSvgPath(path, {
        x: o.x,
        y: o.y,
        rotate: degrees(pageRotation(page)),
        borderColor: hexToRgb(item.color),
        borderWidth: item.fwidth * W,
        borderOpacity: item.opacity,
        borderLineCap: LineCapStyle.Round,
      });
    }
    if (onProgress && (k % 10 === 9 || k === work.length - 1)) await onProgress(k + 1, work.length);
  }
}
