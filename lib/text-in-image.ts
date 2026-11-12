/**
 * Helpers for "Edit text in image": find text with OCR, sample the colours
 * around a word, cover it and draw replacement text that roughly matches.
 * Fonts are approximated, never identified.
 */
import { tesseractCorePath, tesseractLangPath, tesseractWorkerPath } from "@/lib/vendor";
import { ctx2d, makeCanvas } from "@/lib/image-utils";

export type Box = { x: number; y: number; w: number; h: number };
export type TextBox = Box & { id: string; text: string; level: "word" | "line"; conf: number };

export type FillMode = "auto" | "smart" | "color";

export type TextEdit = {
  box: Box;
  /** The text that was there (helps match the size and baseline). */
  original: string;
  text: string;
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  color: string;
  fill: FillMode;
  fillColor: string;
  align: "left" | "center" | "right";
  /** Squeeze or stretch the new text to the box width. */
  fitWidth: boolean;
};

export const FONTS = [
  { label: "Arial / Helvetica", css: "Arial, Helvetica, 'Liberation Sans', sans-serif" },
  { label: "Verdana", css: "Verdana, Geneva, 'DejaVu Sans', sans-serif" },
  { label: "Trebuchet", css: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { label: "Georgia", css: "Georgia, 'DejaVu Serif', serif" },
  { label: "Times New Roman", css: "'Times New Roman', Times, 'Liberation Serif', serif" },
  { label: "Courier (monospace)", css: "'Courier New', Courier, 'Liberation Mono', monospace" },
  { label: "Impact (heavy)", css: "Impact, 'Arial Black', 'Helvetica Neue', sans-serif" },
];

type OcrWorker = {
  recognize: (img: HTMLCanvasElement, opts?: object, output?: object) => Promise<{ data: OcrPage }>;
  terminate: () => Promise<unknown>;
};
type Bbox = { x0: number; y0: number; x1: number; y1: number };
type OcrPage = {
  blocks: { paragraphs: { lines: { text: string; confidence: number; bbox: Bbox; words: { text: string; confidence: number; bbox: Bbox }[] }[] }[] }[] | null;
};

export async function createOcrWorker(lang: string, onProgress: (p: number, status: string) => void): Promise<OcrWorker> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(lang, 1, {
    workerPath: tesseractWorkerPath,
    corePath: tesseractCorePath,
    langPath: tesseractLangPath,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => onProgress(m.progress ?? 0, m.status ?? ""),
  });
  return worker as unknown as OcrWorker;
}

/** Run OCR and return word and line boxes in image pixel coordinates. */
export async function findText(worker: OcrWorker, image: HTMLCanvasElement): Promise<TextBox[]> {
  // Small images OCR much better when enlarged first.
  const s = image.width < 1400 ? Math.min(3, 1400 / image.width) : 1;
  let src = image;
  if (s > 1) {
    src = makeCanvas(image.width * s, image.height * s);
    const c = ctx2d(src);
    c.imageSmoothingQuality = "high";
    c.drawImage(image, 0, 0, src.width, src.height);
  }
  const { data } = await worker.recognize(src, {}, { blocks: true, text: false });
  const out: TextBox[] = [];
  let n = 0;
  const toBox = (b: Bbox): Box => ({ x: b.x0 / s, y: b.y0 / s, w: (b.x1 - b.x0) / s, h: (b.y1 - b.y0) / s });
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        const words = line.words.filter((w) => w.text.trim() && w.confidence >= 25);
        if (!words.length) continue;
        const lb = toBox(line.bbox);
        if (lb.w >= 4 && lb.h >= 4) out.push({ ...lb, id: `l${n++}`, level: "line", text: words.map((w) => w.text).join(" "), conf: line.confidence });
        for (const w of words) {
          const wb = toBox(w.bbox);
          if (wb.w >= 3 && wb.h >= 4) out.push({ ...wb, id: `w${n++}`, level: "word", text: w.text, conf: w.confidence });
        }
      }
    }
  }
  return out;
}

export function padBox(b: Box, imgW: number, imgH: number): Box {
  const pad = Math.max(2, Math.round(b.h * 0.12));
  const x = Math.max(0, Math.floor(b.x - pad));
  const y = Math.max(0, Math.floor(b.y - pad));
  const x1 = Math.min(imgW, Math.ceil(b.x + b.w + pad));
  const y1 = Math.min(imgH, Math.ceil(b.y + b.h + pad));
  return { x, y, w: x1 - x, h: y1 - y };
}

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
}

/**
 * Guess the background colour (median of a ring just outside the box), the
 * text colour (the pixels inside that differ most from it) and whether the
 * text looks bold (lots of ink for its height).
 */
export function sampleColors(canvas: HTMLCanvasElement, b: Box): { bg: string; fg: string; bold: boolean } {
  const p = padBox(b, canvas.width, canvas.height);
  const ring = 3;
  const rx = Math.max(0, p.x - ring);
  const ry = Math.max(0, p.y - ring);
  const rw = Math.min(canvas.width, p.x + p.w + ring) - rx;
  const rh = Math.min(canvas.height, p.y + p.h + ring) - ry;
  const data = ctx2d(canvas, true).getImageData(rx, ry, rw, rh).data;
  const R: number[] = [], G: number[] = [], B: number[] = [];
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const inside = x >= p.x - rx && x < p.x - rx + p.w && y >= p.y - ry && y < p.y - ry + p.h;
      if (inside) continue;
      const i = (y * rw + x) * 4;
      R.push(data[i]); G.push(data[i + 1]); B.push(data[i + 2]);
    }
  }
  const br = median(R), bgG = median(G), bb = median(B);
  // Ink: pixels inside the tight box far from the background.
  const ix0 = Math.max(0, Math.floor(b.x) - rx), iy0 = Math.max(0, Math.floor(b.y) - ry);
  const ix1 = Math.min(rw, Math.ceil(b.x + b.w) - rx), iy1 = Math.min(rh, Math.ceil(b.y + b.h) - ry);
  const ds: { d: number; i: number }[] = [];
  let maxD = 0;
  for (let y = iy0; y < iy1; y++) {
    for (let x = ix0; x < ix1; x++) {
      const i = (y * rw + x) * 4;
      const d = Math.abs(data[i] - br) + Math.abs(data[i + 1] - bgG) + Math.abs(data[i + 2] - bb);
      ds.push({ d, i });
      if (d > maxD) maxD = d;
    }
  }
  let fg = br + bgG + bb > 382 ? "#111111" : "#ffffff";
  let bold = false;
  if (maxD > 60 && ds.length) {
    const strong = ds.filter((v) => v.d >= maxD * 0.7);
    let r = 0, g = 0, bl = 0;
    for (const v of strong) { r += data[v.i]; g += data[v.i + 1]; bl += data[v.i + 2]; }
    fg = hex(r / strong.length, g / strong.length, bl / strong.length);
    const ink = ds.filter((v) => v.d >= maxD * 0.5).length / ds.length;
    bold = ink > 0.3;
  }
  return { bg: hex(br, bgG, bb), fg, bold };
}

/**
 * "Smart fill": rebuild the area from its border (a Coons patch over the
 * four edges), so gentle gradients and shading continue under the text.
 */
function smartFill(ctx: CanvasRenderingContext2D, p: Box) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const ex = Math.max(0, p.x - 2), ey = Math.max(0, p.y - 2);
  const ew = Math.min(W, p.x + p.w + 2) - ex, eh = Math.min(H, p.y + p.h + 2) - ey;
  const img = ctx.getImageData(ex, ey, ew, eh);
  const d = img.data;
  const ox = p.x - ex, oy = p.y - ey;
  const px = (x: number, y: number, c: number) => d[(Math.max(0, Math.min(eh - 1, y)) * ew + Math.max(0, Math.min(ew - 1, x))) * 4 + c];
  // Edge samples averaged over 2 px to calm noise.
  const edge = (x: number, y: number, dx: number, dy: number, c: number) => (px(x, y, c) + px(x + dx, y + dy, c)) / 2;
  const top = oy - 1, bottom = oy + p.h, left = ox - 1, right = ox + p.w;
  for (let y = 0; y < p.h; y++) {
    const ty = (y + 1) / (p.h + 1);
    for (let x = 0; x < p.w; x++) {
      const tx = (x + 1) / (p.w + 1);
      const k = ((oy + y) * ew + ox + x) * 4;
      for (let c = 0; c < 3; c++) {
        const T = edge(ox + x, top, 0, -1, c), Bm = edge(ox + x, bottom, 0, 1, c);
        const L = edge(left, oy + y, -1, 0, c), R = edge(right, oy + y, 1, 0, c);
        const c00 = px(left, top, c), c10 = px(right, top, c), c01 = px(left, bottom, c), c11 = px(right, bottom, c);
        const v =
          (1 - ty) * T + ty * Bm + (1 - tx) * L + tx * R -
          ((1 - tx) * (1 - ty) * c00 + tx * (1 - ty) * c10 + (1 - tx) * ty * c01 + tx * ty * c11);
        d[k + c] = v;
      }
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, ex, ey);
}

function fontString(e: TextEdit, size: number) {
  return `${e.italic ? "italic " : ""}${e.bold ? "bold " : ""}${Math.max(1, size)}px ${e.font}`;
}

/** Font size whose glyphs fill the box height, measured on the original text. */
export function autoSize(ctx: CanvasRenderingContext2D, e: Pick<TextEdit, "font" | "bold" | "italic" | "original" | "text">, boxH: number): number {
  const sample = e.original.trim() || e.text.trim() || "Hg";
  ctx.font = fontString({ ...e, size: 100 } as TextEdit, 100);
  const m = ctx.measureText(sample);
  const glyphH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  if (!glyphH) return Math.round(boxH * 0.8);
  return Math.max(4, Math.round((100 * boxH) / glyphH));
}

/** Paint one edit onto ctx. Returns the rectangle that was touched. */
export function applyEdit(ctx: CanvasRenderingContext2D, e: TextEdit): Box {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const p = padBox(e.box, W, H);
  if (e.fill === "smart") smartFill(ctx, p);
  else {
    ctx.fillStyle = e.fillColor;
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  let touched = { ...p };
  if (e.text) {
    ctx.save();
    ctx.font = fontString(e, e.size);
    ctx.fillStyle = e.color;
    ctx.textBaseline = "alphabetic";
    // Baseline from the original glyphs, so new text sits where the old text sat.
    const ref = ctx.measureText(e.original.trim() || e.text);
    const baseline = e.box.y + (ref.actualBoundingBoxAscent / Math.max(1, ref.actualBoundingBoxAscent + ref.actualBoundingBoxDescent)) * e.box.h;
    const m = ctx.measureText(e.text);
    const textW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    let sx = 1;
    if (e.fitWidth && textW > 0) sx = e.box.w / textW;
    const drawnW = textW * sx;
    let x = e.box.x;
    if (e.align === "center") x = e.box.x + (e.box.w - drawnW) / 2;
    else if (e.align === "right") x = e.box.x + e.box.w - drawnW;
    ctx.translate(x, baseline);
    ctx.scale(sx, 1);
    ctx.fillText(e.text, m.actualBoundingBoxLeft, 0);
    ctx.restore();
    const tx0 = Math.floor(x) - 2, tx1 = Math.ceil(x + drawnW) + 2;
    const ty0 = Math.floor(baseline - m.actualBoundingBoxAscent) - 2, ty1 = Math.ceil(baseline + m.actualBoundingBoxDescent) + 2;
    const x0 = Math.max(0, Math.min(touched.x, tx0)), y0 = Math.max(0, Math.min(touched.y, ty0));
    const x1 = Math.min(W, Math.max(touched.x + touched.w, tx1)), y1 = Math.min(H, Math.max(touched.y + touched.h, ty1));
    touched = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  return touched;
}

/** How much wider the new text is than the box (1 = same width). */
export function widthRatio(ctx: CanvasRenderingContext2D, e: TextEdit): number {
  if (!e.text || e.fitWidth) return 1;
  ctx.save();
  ctx.font = fontString(e, e.size);
  const m = ctx.measureText(e.text);
  ctx.restore();
  return (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / Math.max(1, e.box.w);
}

/** Rectangle an edit may touch, for saving undo state before applying it. */
export function editBounds(ctx: CanvasRenderingContext2D, e: TextEdit): Box {
  // Dry run on a scratch canvas of the same size is wasteful; estimate generously instead.
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const p = padBox(e.box, W, H);
  ctx.save();
  ctx.font = fontString(e, e.size);
  const m = ctx.measureText(e.text || " ");
  ctx.restore();
  const textW = e.fitWidth ? e.box.w : m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const extraX = Math.max(0, textW - e.box.w) + e.size;
  const x0 = Math.max(0, Math.floor(p.x - extraX)), x1 = Math.min(W, Math.ceil(p.x + p.w + extraX));
  const y0 = Math.max(0, Math.floor(p.y - e.size)), y1 = Math.min(H, Math.ceil(p.y + p.h + e.size));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
