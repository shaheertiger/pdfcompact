/**
 * PDF → Word structure: lines with bold/italic runs, paragraphs by vertical
 * gaps, headings by font size, tables (via lib/pdf-table) and page images.
 * The analysis functions are pure; image capture needs a browser canvas.
 */
import type { PDFPageProxy } from "pdfjs-dist";
import { chunksFromItems, detectBlocks, rowsFromChunks, type Table } from "./pdf-table";

export type Run = { text: string; bold: boolean; italic: boolean; size: number };
export type PdfLine = { y: number; x: number; x1: number; size: number; runs: Run[] };
export type Para = { kind: "para"; top: number; lines: PdfLine[]; size: number; heading: 0 | 1 | 2 | 3 };
export type FlowTable = { kind: "table"; top: number; table: Table };
export type FlowImage = { kind: "image"; top: number; width: number; height: number; data: Uint8Array; type: "png" | "jpg" };
export type FlowItem = Para | FlowTable | FlowImage;
export type PageFlow = { items: FlowItem[]; chars: number; width: number; height: number; imageCount: number; /** An image covers most of the page (a scan). */ pageImage: boolean };

type RawItem = { str: string; transform: number[]; width: number; fontName: string; hasEOL?: boolean };
export type FontInfo = { bold: boolean; italic: boolean };

export function fontStyle(name: string | undefined, flags?: { bold?: boolean; black?: boolean; italic?: boolean }): FontInfo {
  const n = name ?? "";
  return {
    bold: !!flags?.bold || !!flags?.black || /bold|black|heavy|semibold|demibold|extrabold|[-,]bd?$/i.test(n),
    italic: !!flags?.italic || /italic|oblique|[-,]it$/i.test(n),
  };
}

/** Build lines of styled runs from pdf.js text items. */
export function linesFromItems(items: unknown[], styleOf: (fontName: string) => FontInfo): PdfLine[] {
  const raw = (items as RawItem[])
    .filter((it) => it && typeof it.str === "string" && it.transform && it.str !== "")
    .filter((it) => Math.abs(it.transform[1]) < 0.01 && Math.abs(it.transform[2]) < 0.01)
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width,
      size: Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10,
      style: styleOf(it.fontName),
    }))
    .filter((it) => it.str.trim() || it.w > 0);
  raw.sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: (typeof raw)[] = [];
  for (const it of raw) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(g[0].y - it.y) <= 0.45 * Math.min(g[0].size, it.size)) g.push(it);
    else groups.push([it]);
  }
  const lines: PdfLine[] = [];
  for (const g of groups) {
    g.sort((a, b) => a.x - b.x);
    const runs: Run[] = [];
    let end = -Infinity;
    for (const it of g) {
      const gap = it.x - end;
      const needsSpace = runs.length > 0 && gap > 0.15 * it.size && !/\s$/.test(runs[runs.length - 1].text) && !/^\s/.test(it.str);
      const text = (needsSpace ? " " : "") + it.str;
      const last = runs[runs.length - 1];
      const size = Math.round(it.size * 2) / 2;
      if (last && last.bold === it.style.bold && last.italic === it.style.italic && Math.abs(last.size - size) < 0.6) last.text += text;
      else if (it.str.trim() === "" && last) last.text += text;
      else runs.push({ text, bold: it.style.bold, italic: it.style.italic, size });
      end = Math.max(end, it.x + it.w);
    }
    for (const r of runs) r.text = r.text.replace(/\s+/g, " ");
    if (runs.length) {
      runs[0].text = runs[0].text.replace(/^\s+/, "");
      runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, "");
    }
    const text = runs.map((r) => r.text).join("");
    if (!text.trim()) continue;
    // The line's size is the size most of its characters use.
    const bySize = new Map<number, number>();
    for (const r of runs) bySize.set(r.size, (bySize.get(r.size) ?? 0) + r.text.length);
    const size = [...bySize.entries()].sort((a, b) => b[1] - a[1])[0][0];
    lines.push({ y: g[0].y, x: g[0].x, x1: end, size, runs: runs.filter((r) => r.text) });
  }
  return lines;
}

const BULLET = /^([•◦▪●○■–\-*]|\d{1,3}[.)]|[a-z][.)]|\(\w{1,3}\))\s/;

/** Group lines into paragraphs by vertical gaps, size changes, indents and short last lines. */
export function paragraphsFromLines(lines: PdfLine[]): Para[] {
  if (!lines.length) return [];
  const left = Math.min(...lines.map((l) => l.x));
  const right = Math.max(...lines.map((l) => l.x1));
  const pitches: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const d = lines[i - 1].y - lines[i].y;
    if (Math.abs(lines[i - 1].size - lines[i].size) < 0.6 && d > 0 && d < 2 * lines[i].size) pitches.push(d / lines[i].size);
  }
  pitches.sort((a, b) => a - b);
  const typical = pitches.length ? pitches[Math.floor(pitches.length / 2)] : 1.25;

  const paras: Para[] = [];
  let cur: Para | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const prev = lines[i - 1];
    let split = !cur || !prev;
    if (cur && prev) {
      const d = prev.y - l.y;
      const sizeChange = Math.abs(prev.size - l.size) > Math.max(0.6, 0.1 * l.size);
      const bigGap = d > typical * l.size * 1.35 || d < 0;
      const prevText = prev.runs.map((r) => r.text).join("");
      const lineText = l.runs.map((r) => r.text).join("");
      const prevShort = prev.x1 < right - (right - left) * 0.15 && /[.!?:;”"')]$/.test(prevText);
      const indented = l.x > prev.x + l.size * 0.9 && l.x - left < (right - left) * 0.3;
      const outdented = prev.x > l.x + l.size * 0.9 && !BULLET.test(prevText);
      const bullet = BULLET.test(lineText);
      const styleChange = prev.runs.every((r) => r.bold) !== l.runs.every((r) => r.bold) && (lineText.length < 80 || prevText.length < 80);
      split = sizeChange || bigGap || prevShort || bullet || styleChange || (indented && !BULLET.test(prevText)) || (outdented && prevShort);
    }
    if (split || !cur) {
      cur = { kind: "para", top: l.y + l.size, lines: [l], size: l.size, heading: 0 };
      paras.push(cur);
    } else cur.lines.push(l);
  }
  return paras;
}

/** Mark paragraphs whose text is clearly larger than body text as headings (H1–H3 by size). */
export function assignHeadings(pages: { items: FlowItem[] }[]) {
  const counts = new Map<number, number>();
  for (const p of pages) for (const it of p.items) {
    if (it.kind !== "para") continue;
    const chars = it.lines.reduce((n, l) => n + l.runs.reduce((m, r) => m + r.text.length, 0), 0);
    counts.set(it.size, (counts.get(it.size) ?? 0) + chars);
  }
  if (!counts.size) return;
  const body = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const headingSizes = [...counts.keys()].filter((s) => s >= body * 1.15).sort((a, b) => b - a);
  for (const p of pages) for (const it of p.items) {
    if (it.kind !== "para" || it.size < body * 1.15) continue;
    const text = it.lines.map((l) => l.runs.map((r) => r.text).join("")).join(" ");
    if (text.length > 200 || it.lines.length > 3) continue;
    const rank = headingSizes.indexOf(it.size);
    it.heading = (rank <= 0 ? 1 : rank === 1 ? 2 : 3) as 1 | 2 | 3;
  }
}

/** Join a paragraph's lines into runs, mending words hyphenated at line ends. */
export function paragraphRuns(p: Para): Run[] {
  const out: Run[] = [];
  p.lines.forEach((l, i) => {
    const runs = l.runs.map((r) => ({ ...r }));
    if (i > 0 && out.length && runs.length) {
      const last = out[out.length - 1];
      const nextStart = runs[0].text;
      if (/[a-z]-$/.test(last.text) && /^[a-z]/.test(nextStart)) last.text = last.text.slice(0, -1);
      else if (!/\s$/.test(last.text)) last.text += " ";
    }
    for (const r of runs) {
      const last = out[out.length - 1];
      if (last && last.bold === r.bold && last.italic === r.italic && last.size === r.size) last.text += r.text;
      else out.push(r);
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Page analysis (browser: needs pdf.js page objects and a canvas for images)
// ---------------------------------------------------------------------------

type Mat = [number, number, number, number, number, number];
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

type PdfImageObj = { width: number; height: number; kind?: number; data?: Uint8ClampedArray | Uint8Array; bitmap?: ImageBitmap };

async function encodeImage(img: PdfImageObj, maxSide = 1600): Promise<{ data: Uint8Array; type: "png" | "jpg" } | null> {
  const { width, height } = img;
  if (!width || !height) return null;
  const src = document.createElement("canvas");
  src.width = width;
  src.height = height;
  const ctx = src.getContext("2d");
  if (!ctx) return null;
  let alpha = false;
  if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0);
  else if (img.data) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    const d = img.data;
    if (img.kind === 3) {
      rgba.set(d.subarray(0, rgba.length));
      alpha = true;
    } else if (img.kind === 2) {
      for (let i = 0, j = 0; j < rgba.length; i += 3, j += 4) {
        rgba[j] = d[i];
        rgba[j + 1] = d[i + 1];
        rgba[j + 2] = d[i + 2];
        rgba[j + 3] = 255;
      }
    } else if (img.kind === 1) {
      const rowBytes = (width + 7) >> 3;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const bit = (d[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
        const v = bit ? 255 : 0;
        const j = (y * width + x) * 4;
        rgba[j] = rgba[j + 1] = rgba[j + 2] = v;
        rgba[j + 3] = 255;
      }
    } else return null;
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
  } else return null;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(width * scale));
  out.height = Math.max(1, Math.round(height * scale));
  const o = out.getContext("2d");
  if (!o) return null;
  if (!alpha) {
    o.fillStyle = "#fff";
    o.fillRect(0, 0, out.width, out.height);
  }
  o.drawImage(src, 0, 0, out.width, out.height);
  const type = alpha ? "png" : "jpg";
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, alpha ? "image/png" : "image/jpeg", 0.85));
  return blob ? { data: new Uint8Array(await blob.arrayBuffer()), type } : null;
}

/** Image data can arrive from the worker a little after the operator list; wait up to 3 s for it. */
function getObj(page: PDFPageProxy, id: string): Promise<PdfImageObj | null> {
  const store = id.startsWith("g_") ? page.commonObjs : page.objs;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 3000);
    try {
      store.get(id, (data: unknown) => {
        clearTimeout(timer);
        resolve((data as PdfImageObj) ?? null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Analyse one page: text lines, tables, and (optionally) the images drawn on it. */
export async function analysePage(
  page: PDFPageProxy,
  OPS: Record<string, number>,
  includeImages: boolean
): Promise<PageFlow> {
  const [, , width, height] = page.view;
  // The operator list loads fonts (for bold/italic names) and images.
  const ops = await page.getOperatorList();
  const content = await page.getTextContent();
  const styleCache = new Map<string, FontInfo>();
  const styleOf = (fontName: string): FontInfo => {
    let s = styleCache.get(fontName);
    if (!s) {
      type FontObj = { name?: string; bold?: boolean; black?: boolean; italic?: boolean };
      let font: FontObj | null = null;
      try {
        font = page.commonObjs.has(fontName) ? (page.commonObjs.get(fontName) as FontObj) : null;
      } catch {
        font = null;
      }
      const family = (content.styles as Record<string, { fontFamily?: string }>)[fontName]?.fontFamily;
      s = fontStyle(font?.name ?? family, font ?? undefined);
      styleCache.set(fontName, s);
    }
    return s;
  };

  const lines = linesFromItems(content.items, styleOf);
  const chars = lines.reduce((n, l) => n + l.runs.reduce((m, r) => m + r.text.replace(/\s/g, "").length, 0), 0);

  // Tables first; lines inside a table's box are not paragraphs.
  const tables = detectBlocks(rowsFromChunks(chunksFromItems(content.items))).filter((b): b is Table => b.kind === "table");
  const inTable = (l: PdfLine) =>
    tables.some((t) => l.y <= t.top + 1 && l.y >= t.bottom - 1 && l.x >= t.left - 2 && l.x <= t.right + 2);
  const items: FlowItem[] = [
    ...paragraphsFromLines(lines.filter((l) => !inTable(l))),
    ...tables.map((t): FlowTable => ({ kind: "table", top: t.top, table: t })),
  ];

  // Images: follow the transformation matrix through the operator list.
  let imageCount = 0;
  let pageImage = false;
  {
    let ctm: Mat = [1, 0, 0, 1, 0, 0];
    const stack: Mat[] = [];
    const { fnArray, argsArray } = ops;
    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      const args = argsArray[i] as unknown[];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
      else if (fn === OPS.transform) ctm = mul(ctm, args as Mat);
      else if (fn === OPS.paintFormXObjectBegin) {
        stack.push(ctm);
        if (Array.isArray(args?.[0])) ctm = mul(ctm, args[0] as Mat);
      } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const xs = [ctm[4], ctm[0] + ctm[4], ctm[2] + ctm[4], ctm[0] + ctm[2] + ctm[4]];
        const ys = [ctm[5], ctm[1] + ctm[5], ctm[3] + ctm[5], ctm[1] + ctm[3] + ctm[5]];
        const w = Math.max(...xs) - Math.min(...xs);
        const h = Math.max(...ys) - Math.min(...ys);
        if (w * h >= 0.6 * width * height) pageImage = true;
        if (w < 24 || h < 24 || !includeImages) continue; // rules, bullets, tiny icons
        const obj = fn === OPS.paintImageXObject ? await getObj(page, String(args[0])) : (args[0] as PdfImageObj);
        if (!obj) continue;
        const enc = await encodeImage(obj);
        if (!enc) continue;
        items.push({ kind: "image", top: Math.max(...ys), width: Math.min(w, width), height: Math.min(h, height), ...enc });
        imageCount++;
      }
    }
  }
  items.sort((a, b) => b.top - a.top);
  return { items, chars, width, height, imageCount, pageImage };
}

// ---------------------------------------------------------------------------
// .docx writing
// ---------------------------------------------------------------------------

type DocxModule = typeof import("docx");

export async function writeDocx(pages: PageFlow[], pageBreaks: boolean, loadDocx: () => Promise<DocxModule>): Promise<Blob> {
  const d = await loadDocx();
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun, PageBreak } = d;
  assignHeadings(pages);
  if (!pageBreaks) {
    // One continuous document: rejoin paragraphs that the PDF's page break cut in two.
    for (let i = 1; i < pages.length; i++) {
      const prev = pages[i - 1].items[pages[i - 1].items.length - 1];
      const next = pages[i].items[0];
      if (prev?.kind !== "para" || next?.kind !== "para" || prev.heading || next.heading) continue;
      const lastLine = prev.lines[prev.lines.length - 1];
      const tail = lastLine.runs.map((r) => r.text).join("");
      if (/[.!?:”"]$/.test(tail) || Math.abs(prev.size - next.size) > 0.6) continue;
      prev.lines.push(...next.lines);
      pages[i].items.shift();
    }
  }
  const first = pages[0] ?? { width: 595, height: 842 };
  const pageW = first.width;
  const contentPx = ((pageW - 144) * 96) / 72; // 1 inch margins
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  const levels = [undefined, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3] as const;

  pages.forEach((p, pi) => {
    let breakPending = pageBreaks && pi > 0;
    const takeBreak = () => {
      const b = breakPending;
      breakPending = false;
      return b;
    };
    for (const it of p.items) {
      if (it.kind === "para") {
        const runs = paragraphRuns(it);
        children.push(
          new Paragraph({
            heading: levels[it.heading],
            pageBreakBefore: takeBreak(),
            spacing: { after: it.heading ? 120 : 160 },
            children: runs.map(
              (r) => new TextRun({ text: r.text, bold: r.bold || !!it.heading, italics: r.italic, size: Math.max(12, Math.round(r.size * 2)), color: it.heading ? "000000" : undefined })
            ),
          })
        );
      } else if (it.kind === "table") {
        if (takeBreak()) children.push(new Paragraph({ children: [new PageBreak()] }));
        const t = it.table;
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: t.rows.map(
              (row, ri) =>
                new TableRow({
                  tableHeader: ri === 0 && t.header ? true : undefined,
                  children: row.map(
                    (cell) =>
                      new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: cell, bold: ri === 0 && t.header })] })],
                      })
                  ),
                })
            ),
          })
        );
        children.push(new Paragraph({ children: [] }));
      } else {
        let w = (it.width * 96) / 72;
        let h = (it.height * 96) / 72;
        if (w > contentPx) {
          h *= contentPx / w;
          w = contentPx;
        }
        children.push(
          new Paragraph({
            pageBreakBefore: takeBreak(),
            children: [new ImageRun({ type: it.type, data: it.data, transformation: { width: Math.round(w), height: Math.round(h) } })],
          })
        );
      }
    }
  });

  const doc = new Document({
    creator: "PDFCompact",
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(first.width * 20), height: Math.round(first.height * 20) },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: children.length ? children : [new Paragraph("")],
      },
    ],
  });
  return Packer.toBlob(doc);
}
