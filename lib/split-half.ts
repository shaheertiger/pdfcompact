/**
 * Split every page of a PDF into two halves (book spreads, two-up scans).
 * Each half is a copy of the page with its MediaBox/CropBox narrowed to one
 * side, so nothing is re-rendered. Page rotation is respected: "left" means
 * the left of the page as you see it, not as it's stored.
 */
import { PDFDocument, type PDFPage } from "pdf-lib";

export type Cut = "vertical" | "horizontal";

export type HalfOptions = {
  cut: Cut;
  /** Right half first (manga, Arabic, Hebrew books). Vertical cut only. */
  rtl: boolean;
  keepFirst: boolean;
  keepLast: boolean;
  /** Extra overlap past the middle, as a fraction of the page's width/height (0–0.2). */
  overlap: number;
};

type Box = { x: number; y: number; width: number; height: number };

/** The two halves in user space, in reading order (first, second) before RTL. */
export function halves(box: Box, rotation: number, cut: Cut, overlap: number): [Box, Box] {
  const rot = ((rotation % 360) + 360) % 360;
  // Which user-space axis runs along the display axis being cut, and in which direction.
  let axis: "x" | "y";
  let ascending: boolean;
  if (cut === "vertical") {
    // display left → right
    [axis, ascending] = rot === 0 ? ["x", true] : rot === 90 ? ["y", true] : rot === 180 ? ["x", false] : ["y", false];
  } else {
    // display top → bottom
    [axis, ascending] = rot === 0 ? ["y", false] : rot === 90 ? ["x", true] : rot === 180 ? ["y", true] : ["x", false];
  }
  const start = axis === "x" ? box.x : box.y;
  const len = axis === "x" ? box.width : box.height;
  const half = len / 2;
  const extra = Math.max(0, Math.min(0.2, overlap)) * len;
  const lowSeg = { a: start, l: half + extra };
  const highSeg = { a: start + half - extra, l: half + extra };
  const mk = (seg: { a: number; l: number }): Box =>
    axis === "x"
      ? { x: seg.a, y: box.y, width: seg.l, height: box.height }
      : { x: box.x, y: seg.a, width: box.width, height: seg.l };
  return ascending ? [mk(lowSeg), mk(highSeg)] : [mk(highSeg), mk(lowSeg)];
}

function setBoxes(page: PDFPage, b: Box) {
  page.setMediaBox(b.x, b.y, b.width, b.height);
  page.setCropBox(b.x, b.y, b.width, b.height);
  page.setTrimBox(b.x, b.y, b.width, b.height);
  page.setBleedBox(b.x, b.y, b.width, b.height);
  page.setArtBox(b.x, b.y, b.width, b.height);
}

export async function splitInHalf(
  bytes: ArrayBuffer | Uint8Array,
  opts: HalfOptions,
  onProgress?: (done: number, total: number) => Promise<void> | void,
): Promise<{ bytes: Uint8Array; pagesIn: number; pagesOut: number }> {
  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  const n = src.getPageCount();
  // Copy everything in one call so fonts and images shared between pages are stored once.
  const plan: { index: number; whole: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const whole = (opts.keepFirst && i === 0) || (opts.keepLast && i === n - 1 && n > 1);
    plan.push({ index: i, whole });
  }
  const copied = await out.copyPages(
    src,
    plan.flatMap((p) => (p.whole ? [p.index] : [p.index, p.index])),
  );
  let c = 0;
  for (const { index: i, whole } of plan) {
    if (whole) {
      out.addPage(copied[c++]);
    } else {
      const srcPage = src.getPage(i);
      const box = srcPage.getCropBox();
      // Clamp the crop box to the media box (some files have a larger CropBox).
      const mb = srcPage.getMediaBox();
      const x1 = Math.max(box.x, mb.x);
      const y1 = Math.max(box.y, mb.y);
      const x2 = Math.min(box.x + box.width, mb.x + mb.width);
      const y2 = Math.min(box.y + box.height, mb.y + mb.height);
      const visible = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
      let [first, second] = halves(visible, srcPage.getRotation().angle, opts.cut, opts.overlap);
      if (opts.rtl && opts.cut === "vertical") [first, second] = [second, first];
      const a = copied[c++];
      const b = copied[c++];
      setBoxes(a, first);
      setBoxes(b, second);
      out.addPage(a);
      out.addPage(b);
    }
    if (onProgress) await onProgress(i + 1, n);
  }
  const result = await out.save({ useObjectStreams: true });
  return { bytes: result, pagesIn: n, pagesOut: out.getPageCount() };
}
