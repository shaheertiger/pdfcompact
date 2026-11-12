/**
 * Browser-side PDF compression.
 *
 * What it does, in order:
 *  1. Lossless clean-up (once per file): drop objects nothing points to, merge
 *     byte-identical streams (the same logo or photo stored twice), and
 *     deflate streams that were saved without any compression.
 *  2. Works out how large each image is actually drawn, by reading every
 *     page's content stream (and nested form XObjects) and tracking the
 *     transformation matrix up to each `Do`.
 *  3. Re-encodes the images it can handle safely: JPEG (DCTDecode) and
 *     8-bit RGB / gray Flate images. Each is downsampled to the target DPI
 *     for its largest placement and re-encoded; the new stream replaces the
 *     old one only if it is clearly smaller. Anything unusual (CMYK, indexed,
 *     1-bit, JBIG2, JPEG 2000, masks, Decode arrays) is left byte-for-byte.
 *  4. Saves with object streams.
 *
 * The caller compares the result with the input and keeps the original if
 * nothing was gained.
 */
import {
  PDFArray,
  PDFContext,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFObject,
  PDFRawStream,
  PDFRef,
  PDFStream,
  decodePDFRawStream,
} from "@cantoo/pdf-lib";

export type Level = "light" | "recommended" | "strong";

/** Image settings per level. Tuned on the test corpus (see content/tools/compress-pdf.md). */
export const LEVELS: Record<Level, { quality: number; dpi: number }> = {
  light: { quality: 0.85, dpi: 200 },
  recommended: { quality: 0.7, dpi: 150 },
  strong: { quality: 0.5, dpi: 100 },
};

/** Settings the target-size search steps through, mildest first. */
export const LADDER: { quality: number; dpi: number }[] = [
  { quality: 0.85, dpi: 200 },
  { quality: 0.78, dpi: 170 },
  { quality: 0.7, dpi: 150 },
  { quality: 0.6, dpi: 125 },
  { quality: 0.5, dpi: 100 },
  { quality: 0.42, dpi: 85 },
  { quality: 0.35, dpi: 72 },
  { quality: 0.3, dpi: 60 },
  { quality: 0.25, dpi: 50 },
];

export type Settings = { quality: number; dpi: number; grayscale: boolean };

export type Stage = "load" | "scan" | "image" | "save" | "page";
export type ProgressFn = (stage: Stage, current: number, total: number) => void;

export type RunStats = { images: number; recompressed: number; unsupported: number };

export class CompressError extends Error {
  constructor(public code: "encrypted" | "unreadable") {
    super(code);
  }
}

const N = (s: string) => PDFName.of(s);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

type Kind = "jpeg" | "raw";

type ImageInfo = {
  ref: PDFRef;
  original: PDFRawStream;
  kind: Kind;
  /** JPEG wrapped in other filters (e.g. ASCII85): those get undone first. */
  wrapped?: boolean;
  width: number;
  height: number;
  /** Components of the source pixels (1 = gray, 3 = RGB). */
  comps: 1 | 3;
  /** The source ColorSpace is an ICC profile we can keep for 3-component output. */
  iccRgb: boolean;
  /** Largest drawn size on any page, in points. Undefined = never found in a content stream. */
  drawnW?: number;
  drawnH?: number;
  /** Raw images only: looks like a photo (many colours) rather than a flat graphic. */
  photo?: boolean;
};

/* ------------------------------------------------------------------ */
/* Lossless clean-up                                                   */
/* ------------------------------------------------------------------ */

function forEachChild(obj: PDFObject, fn: (o: PDFObject) => void) {
  if (obj instanceof PDFDict) for (const [, v] of obj.entries()) fn(v);
  else if (obj instanceof PDFArray) for (const v of obj.asArray()) fn(v);
  else if (obj instanceof PDFStream) fn(obj.dict);
}

/** Delete every indirect object that can't be reached from the trailer. */
function collectGarbage(ctx: PDFContext): number {
  const seen = new Set<PDFRef>();
  const stack: PDFObject[] = [];
  const { Root, Info } = ctx.trailerInfo;
  if (Root) stack.push(Root);
  if (Info) stack.push(Info);
  while (stack.length) {
    const o = stack.pop()!;
    if (o instanceof PDFRef) {
      if (seen.has(o)) continue;
      seen.add(o);
      const target = ctx.lookup(o);
      if (target) stack.push(target);
    } else forEachChild(o, (c) => stack.push(c));
  }
  let removed = 0;
  for (const [ref] of ctx.enumerateIndirectObjects()) {
    if (!seen.has(ref)) {
      ctx.delete(ref);
      removed++;
    }
  }
  return removed;
}

function hashBytes(b: Uint8Array): number {
  let h = 0x811c9dc5;
  const step = b.length > 1 << 20 ? 7 : 1; // sample very large streams, then compare exactly
  for (let i = 0; i < b.length; i += step) {
    h ^= b[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function dictKey(d: PDFDict): string {
  return d
    .entries()
    .filter(([k]) => k !== PDFName.Length)
    .map(([k, v]) => `${k.toString()} ${v.toString()}`)
    .sort()
    .join(" ");
}

/** Point every reference in `obj` (recursively, direct objects only) through `map`. */
function remapRefs(obj: PDFObject, map: Map<PDFRef, PDFRef>) {
  if (obj instanceof PDFDict) {
    for (const [k, v] of obj.entries()) {
      if (v instanceof PDFRef) {
        const to = map.get(v);
        if (to) obj.set(k, to);
      } else remapRefs(v, map);
    }
  } else if (obj instanceof PDFArray) {
    for (let i = 0; i < obj.size(); i++) {
      const v = obj.get(i);
      if (v instanceof PDFRef) {
        const to = map.get(v);
        if (to) obj.set(i, to);
      } else remapRefs(v, map);
    }
  } else if (obj instanceof PDFStream) remapRefs(obj.dict, map);
}

/** Merge byte-identical streams (images, fonts, repeated logos). */
function dedupeStreams(ctx: PDFContext): number {
  const buckets = new Map<string, PDFRef[]>();
  const map = new Map<PDFRef, PDFRef>();
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || obj.contents.length < 512) continue;
    const type = obj.dict.get(N("Type"));
    if (type === N("XRef") || type === N("ObjStm") || type === N("Metadata")) continue;
    const key = `${obj.contents.length}:${hashBytes(obj.contents)}:${dictKey(obj.dict)}`;
    const list = buckets.get(key);
    if (!list) {
      buckets.set(key, [ref]);
      continue;
    }
    const twin = list.find((r) => sameBytes((ctx.lookup(r) as PDFRawStream).contents, obj.contents));
    if (twin) map.set(ref, twin);
    else list.push(ref);
  }
  if (map.size === 0) return 0;
  for (const [, obj] of ctx.enumerateIndirectObjects()) remapRefs(obj, map);
  const { Root, Info } = ctx.trailerInfo;
  if (Root) remapRefs(Root, map);
  if (Info) remapRefs(Info, map);
  for (const dup of map.keys()) ctx.delete(dup);
  return map.size;
}

/** Deflate streams that were stored with no filter at all. */
function deflateUncompressed(ctx: PDFContext): number {
  let n = 0;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || obj.contents.length < 128) continue;
    if (obj.dict.get(N("Filter"))) continue;
    const type = obj.dict.get(N("Type"));
    if (type === N("XRef") || type === N("ObjStm") || type === N("Metadata")) continue;
    const flated = ctx.flateStream(obj.contents);
    if (flated.contents.length >= obj.contents.length * 0.9) continue;
    const dict = obj.dict.clone(ctx);
    dict.set(N("Filter"), N("FlateDecode"));
    dict.delete(N("DecodeParms"));
    ctx.assign(ref, PDFRawStream.of(dict, flated.contents));
    n++;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Where are images drawn, and how big?                                */
/* ------------------------------------------------------------------ */

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];

const isWhite = (c: number) => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09 || c === 0x0c || c === 0x00;
const isDelim = (c: number) =>
  c === 0x28 || c === 0x29 || c === 0x3c || c === 0x3e || c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d || c === 0x2f || c === 0x25;

/**
 * Minimal content-stream interpreter: tracks q/Q/cm and reports every `Do`
 * with the current transformation matrix. Strings, arrays, dictionaries and
 * inline images are skipped safely.
 */
function scanContent(b: Uint8Array, start: Matrix, onDo: (name: string, ctm: Matrix) => void) {
  let ctm = start;
  const stack: Matrix[] = [];
  let nums: number[] = [];
  let lastName: string | null = null;
  let i = 0;
  const len = b.length;
  while (i < len) {
    const c = b[i];
    if (isWhite(c)) {
      i++;
      continue;
    }
    if (c === 0x25) {
      // comment
      while (i < len && b[i] !== 0x0a && b[i] !== 0x0d) i++;
      continue;
    }
    if (c === 0x28) {
      // literal string with nesting and escapes
      let depth = 1;
      i++;
      while (i < len && depth > 0) {
        const d = b[i];
        if (d === 0x5c) i += 2;
        else {
          if (d === 0x28) depth++;
          else if (d === 0x29) depth--;
          i++;
        }
      }
      nums = [];
      lastName = null;
      continue;
    }
    if (c === 0x3c) {
      if (b[i + 1] === 0x3c) {
        i += 2; // dict open: contents are tokens we ignore
        continue;
      }
      while (i < len && b[i] !== 0x3e) i++;
      i++;
      nums = [];
      continue;
    }
    if (c === 0x3e || c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d) {
      i++;
      if (c === 0x5b) nums = [];
      continue;
    }
    if (c === 0x2f) {
      let j = i + 1;
      while (j < len && !isWhite(b[j]) && !isDelim(b[j])) j++;
      let name = "";
      for (let k = i + 1; k < j; k++) name += String.fromCharCode(b[k]);
      lastName = name.replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      i = j;
      continue;
    }
    // number or operator
    let j = i;
    while (j < len && !isWhite(b[j]) && !isDelim(b[j])) j++;
    if (j === i) {
      i++;
      continue;
    }
    let tok = "";
    for (let k = i; k < j; k++) tok += String.fromCharCode(b[k]);
    i = j;
    const first = tok.charCodeAt(0);
    if ((first >= 0x30 && first <= 0x39) || first === 0x2d || first === 0x2b || first === 0x2e) {
      const v = parseFloat(tok);
      nums.push(Number.isFinite(v) ? v : 0);
      if (nums.length > 6) nums.shift();
      continue;
    }
    switch (tok) {
      case "q":
        stack.push(ctm);
        break;
      case "Q":
        ctm = stack.pop() ?? ctm;
        break;
      case "cm":
        if (nums.length === 6) ctm = mul(nums as Matrix, ctm);
        break;
      case "Do":
        if (lastName) onDo(lastName, ctm);
        break;
      case "BI": {
        // inline image: skip to "EI" that follows whitespace and is followed by whitespace/end
        const idAt = findSeq(b, i, [0x49, 0x44]); // "ID"
        let k = idAt < 0 ? len : idAt + 3;
        while (k < len) {
          if (b[k] === 0x45 && b[k + 1] === 0x49 && isWhite(b[k - 1]) && (k + 2 >= len || isWhite(b[k + 2]))) break;
          k++;
        }
        i = k + 2;
        break;
      }
    }
    nums = [];
    lastName = null;
  }
}

function findSeq(b: Uint8Array, from: number, seq: number[]) {
  outer: for (let i = from; i < b.length - seq.length; i++) {
    for (let k = 0; k < seq.length; k++) if (b[i + k] !== seq[k]) continue outer;
    if (isWhite(b[i - 1]) && (isWhite(b[i + seq.length]) || i + seq.length >= b.length)) return i;
  }
  return -1;
}

function streamBytes(ctx: PDFContext, obj: PDFObject | undefined): Uint8Array | null {
  const s = obj instanceof PDFRef ? ctx.lookup(obj) : obj;
  if (!(s instanceof PDFRawStream)) return null;
  try {
    return decodePDFRawStream(s).decode();
  } catch {
    return null;
  }
}

function pageContentBytes(ctx: PDFContext, contents: PDFObject | undefined): Uint8Array | null {
  if (!contents) return null;
  const c = contents instanceof PDFRef ? ctx.lookup(contents) : contents;
  if (c instanceof PDFArray) {
    const parts: Uint8Array[] = [];
    for (const item of c.asArray()) {
      const part = streamBytes(ctx, item);
      if (part) parts.push(part);
    }
    const total = parts.reduce((n, p) => n + p.length + 1, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
      out[o++] = 0x0a;
    }
    return out;
  }
  return streamBytes(ctx, c);
}

function numArray(ctx: PDFContext, obj: PDFObject | undefined): number[] | null {
  const a = obj instanceof PDFRef ? ctx.lookup(obj) : obj;
  if (!(a instanceof PDFArray)) return null;
  const out = a.asArray().map((v) => {
    const n = v instanceof PDFRef ? ctx.lookup(v) : v;
    return n instanceof PDFNumber ? n.asNumber() : NaN;
  });
  return out.every(Number.isFinite) ? out : null;
}

function scanResources(
  ctx: PDFContext,
  content: Uint8Array,
  resources: PDFDict | undefined,
  start: Matrix,
  depth: number,
  images: Map<PDFRef, ImageInfo>
) {
  const xobjects = resources?.lookupMaybe(N("XObject"), PDFDict);
  if (!xobjects) return;
  scanContent(content, start, (name, ctm) => {
    const ref = xobjects.get(N(name));
    if (!(ref instanceof PDFRef)) return;
    const img = images.get(ref);
    if (img) {
      const w = Math.hypot(ctm[0], ctm[1]);
      const h = Math.hypot(ctm[2], ctm[3]);
      img.drawnW = Math.max(img.drawnW ?? 0, w);
      img.drawnH = Math.max(img.drawnH ?? 0, h);
      return;
    }
    if (depth > 6) return;
    const form = ctx.lookup(ref);
    if (!(form instanceof PDFRawStream) || form.dict.get(N("Subtype")) !== N("Form")) return;
    const bytes = streamBytes(ctx, form);
    if (!bytes) return;
    const m = numArray(ctx, form.dict.get(N("Matrix")));
    const formRes = form.dict.lookupMaybe(N("Resources"), PDFDict) ?? resources;
    scanResources(ctx, bytes, formRes, mul((m?.length === 6 ? m : IDENTITY) as Matrix, ctm), depth + 1, images);
  });
}

/* ------------------------------------------------------------------ */
/* Image classification and pixel decoding                             */
/* ------------------------------------------------------------------ */

const SAFE_RAW_FILTERS = new Set(["/FlateDecode", "/LZWDecode", "/ASCII85Decode", "/ASCIIHexDecode", "/RunLengthDecode"]);

function filterNames(ctx: PDFContext, dict: PDFDict): string[] | null {
  const f = dict.lookup(N("Filter"));
  if (!f) return [];
  if (f instanceof PDFName) return [f.toString()];
  if (f instanceof PDFArray) {
    const out: string[] = [];
    for (const v of f.asArray()) {
      const n = v instanceof PDFRef ? ctx.lookup(v) : v;
      if (!(n instanceof PDFName)) return null;
      out.push(n.toString());
    }
    return out;
  }
  return null;
}

/** Returns components (1 or 3) and whether it's an RGB ICC profile, or null if unsupported. */
function colorInfo(ctx: PDFContext, cs: PDFObject | undefined): { comps: 1 | 3; iccRgb: boolean } | null {
  const v = cs instanceof PDFRef ? ctx.lookup(cs) : cs;
  if (v === N("DeviceRGB") || v === N("CalRGB")) return { comps: 3, iccRgb: false };
  if (v === N("DeviceGray") || v === N("CalGray")) return { comps: 1, iccRgb: false };
  if (v instanceof PDFArray && v.size() >= 1) {
    const kind = v.lookup(0);
    if (kind === N("CalRGB")) return { comps: 3, iccRgb: false };
    if (kind === N("CalGray")) return { comps: 1, iccRgb: false };
    if (kind === N("ICCBased")) {
      const s = v.lookup(1);
      const n = s instanceof PDFStream ? s.dict.lookup(N("N")) : undefined;
      const num = n instanceof PDFNumber ? n.asNumber() : 0;
      if (num === 3) return { comps: 3, iccRgb: true };
      if (num === 1) return { comps: 1, iccRgb: false };
    }
  }
  return null;
}

function classify(ctx: PDFContext, ref: PDFRef, s: PDFRawStream): ImageInfo | "unsupported" {
  const d = s.dict;
  const num = (k: string) => {
    const v = d.lookup(N(k));
    return v instanceof PDFNumber ? v.asNumber() : NaN;
  };
  const width = num("Width");
  const height = num("Height");
  if (!(width > 0 && height > 0)) return "unsupported";
  if (d.lookup(N("ImageMask"))?.toString() === "true") return "unsupported";
  if (num("BitsPerComponent") !== 8) return "unsupported";
  if (d.get(N("Decode"))) return "unsupported";
  if (d.lookup(N("Mask")) instanceof PDFArray) return "unsupported"; // colour-key masks break with lossy pixels
  const color = colorInfo(ctx, d.get(N("ColorSpace")));
  if (!color) return "unsupported";
  const filters = filterNames(ctx, d);
  if (!filters) return "unsupported";
  let kind: Kind;
  let wrapped = false;
  if (filters.length >= 1 && filters[filters.length - 1] === "/DCTDecode") {
    if (!filters.slice(0, -1).every((f) => SAFE_RAW_FILTERS.has(f))) return "unsupported";
    kind = "jpeg";
    wrapped = filters.length > 1;
  }
  else if (filters.every((f) => SAFE_RAW_FILTERS.has(f))) kind = "raw";
  else return "unsupported";
  if (width * height > 60e6) return "unsupported"; // too big for a browser canvas
  return { ref, original: s, kind, wrapped, width, height, comps: color.comps, iccRgb: color.iccRgb };
}

function predictorParams(ctx: PDFContext, d: PDFDict): PDFDict | undefined {
  const p = d.lookup(N("DecodeParms"));
  if (p instanceof PDFDict) return p;
  if (p instanceof PDFArray) {
    for (let i = p.size() - 1; i >= 0; i--) {
      const v = p.lookup(i);
      if (v instanceof PDFDict) return v;
    }
  }
  return undefined;
}

/** Undo PNG (10–15) or TIFF (2) predictors for 8-bit samples. */
function unpredict(data: Uint8Array, params: PDFDict | undefined, w: number, comps: number): Uint8Array | null {
  if (!params) return data;
  const n = (k: string, dflt: number) => {
    const v = params.lookup(N(k));
    return v instanceof PDFNumber ? v.asNumber() : dflt;
  };
  const predictor = n("Predictor", 1);
  if (predictor === 1) return data;
  const colors = n("Colors", 1);
  const bpc = n("BitsPerComponent", 8);
  const columns = n("Columns", 1);
  if (bpc !== 8 || colors !== comps || columns !== w) return null;
  const bpp = colors;
  const rowLen = columns * colors;
  if (predictor === 2) {
    const out = data.slice();
    for (let r = 0; r + rowLen <= out.length; r += rowLen)
      for (let i = bpp; i < rowLen; i++) out[r + i] = (out[r + i] + out[r + i - bpp]) & 0xff;
    return out;
  }
  if (predictor < 10) return null;
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  let prev = new Uint8Array(rowLen);
  for (let r = 0; r < rows; r++) {
    const type = data[r * (rowLen + 1)];
    const src = data.subarray(r * (rowLen + 1) + 1, (r + 1) * (rowLen + 1));
    const cur = out.subarray(r * rowLen, (r + 1) * rowLen);
    for (let i = 0; i < rowLen; i++) {
      const left = i >= bpp ? cur[i - bpp] : 0;
      const up = prev[i];
      const ul = i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      switch (type) {
        case 1: v += left; break;
        case 2: v += up; break;
        case 3: v += (left + up) >> 1; break;
        case 4: {
          const p = left + up - ul;
          const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - ul);
          v += pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
          break;
        }
      }
      cur[i] = v & 0xff;
    }
    prev = cur;
  }
  return out;
}

function decodeRaw(ctx: PDFContext, img: ImageInfo): ImageData | null {
  let data: Uint8Array;
  try {
    data = decodePDFRawStream(img.original).decode();
  } catch {
    return null;
  }
  const filters = filterNames(ctx, img.original.dict) ?? [];
  if (filters.length > 0) {
    const un = unpredict(data, predictorParams(ctx, img.original.dict), img.width, img.comps);
    if (!un) return null;
    data = un;
  }
  const px = img.width * img.height;
  if (data.length < px * img.comps) return null;
  const out = new ImageData(img.width, img.height);
  const o = out.data;
  if (img.comps === 3) {
    for (let i = 0, j = 0; i < px; i++, j += 3) {
      o[i * 4] = data[j];
      o[i * 4 + 1] = data[j + 1];
      o[i * 4 + 2] = data[j + 2];
      o[i * 4 + 3] = 255;
    }
  } else {
    for (let i = 0; i < px; i++) {
      const g = data[i];
      o[i * 4] = g;
      o[i * 4 + 1] = g;
      o[i * 4 + 2] = g;
      o[i * 4 + 3] = 255;
    }
  }
  return out;
}

/** Photos have many distinct colours; screenshots, charts and clean text scans don't. */
function looksLikePhoto(d: ImageData): boolean {
  const px = d.width * d.height;
  const step = Math.max(1, Math.floor(px / 20000));
  const colors = new Set<number>();
  let n = 0;
  for (let i = 0; i < px; i += step) {
    const k = i * 4;
    colors.add((d.data[k] << 16) | (d.data[k + 1] << 8) | d.data[k + 2]);
    n++;
  }
  return colors.size > 2000 || colors.size / n > 0.2;
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: AnyCanvas) {
  const g = c.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!g) throw new Error("canvas");
  return g;
}

export function toGray(d: ImageData) {
  const a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const y = (a[i] * 77 + a[i + 1] * 150 + a[i + 2] * 29) >> 8;
    a[i] = a[i + 1] = a[i + 2] = y;
  }
}

async function canvasJpeg(c: AnyCanvas, quality: number): Promise<Uint8Array> {
  const blob =
    "convertToBlob" in c
      ? await c.convertToBlob({ type: "image/jpeg", quality })
      : await new Promise<Blob>((res, rej) =>
          (c as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error("jpeg"))), "image/jpeg", quality)
        );
  return new Uint8Array(await blob.arrayBuffer());
}

/* ------------------------------------------------------------------ */
/* The compressor                                                      */
/* ------------------------------------------------------------------ */

const CACHE_BUDGET_PX = 80e6;

export class PdfCompressor {
  private doc: PDFDocument;
  private images: ImageInfo[] = [];
  private unsupported = 0;
  private cache = new Map<PDFRef, ImageBitmap>();
  private cachedPx = 0;
  private fallbackPage = { w: 612, h: 792 };

  private constructor(doc: PDFDocument) {
    this.doc = doc;
  }

  get imageCount() {
    return this.images.length + this.unsupported;
  }

  static async open(bytes: Uint8Array, onProgress?: ProgressFn): Promise<PdfCompressor> {
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(bytes, { ignoreEncryption: true, password: "", updateMetadata: false });
    } catch (e) {
      if (e instanceof Error && /encrypt|password/i.test(e.name + e.message)) throw new CompressError("encrypted");
      throw new CompressError("unreadable");
    }
    // Permissions-only files are decrypted on load; anything still encrypted would be garbage to re-encode.
    if (doc.isEncrypted || doc.context.trailerInfo.Encrypt) throw new CompressError("encrypted");
    const c = new PdfCompressor(doc);
    await c.prepare(onProgress);
    return c;
  }

  private async prepare(onProgress?: ProgressFn) {
    const ctx = this.doc.context;
    collectGarbage(ctx);
    dedupeStreams(ctx);
    deflateUncompressed(ctx);

    const byRef = new Map<PDFRef, ImageInfo>();
    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream) || obj.dict.get(N("Subtype")) !== N("Image")) continue;
      const info = classify(ctx, ref, obj);
      if (info === "unsupported") this.unsupported++;
      else byRef.set(ref, info);
    }
    // Soft masks are images too, but they belong to their parent image: leave them alone.
    for (const info of [...byRef.values()]) {
      const sm = info.original.dict.get(N("SMask"));
      if (sm instanceof PDFRef && byRef.delete(sm)) this.unsupported++;
    }

    const pages = this.doc.getPages();
    let maxW = 0;
    let maxH = 0;
    for (let i = 0; i < pages.length; i++) {
      onProgress?.("scan", i + 1, pages.length);
      const page = pages[i];
      const { width, height } = page.getSize();
      maxW = Math.max(maxW, width);
      maxH = Math.max(maxH, height);
      if (byRef.size === 0) continue;
      try {
        const content = pageContentBytes(ctx, page.node.Contents());
        if (content) scanResources(ctx, content, page.node.Resources(), IDENTITY, 0, byRef);
      } catch {
        // A content stream we can't read just means we fall back to page size.
      }
      if (i % 10 === 9) await tick();
    }
    if (maxW > 0) this.fallbackPage = { w: maxW, h: maxH };
    this.images = [...byRef.values()];
  }

  /** Pixel size to aim for at `dpi`, based on the largest placement (or the page size as a fallback). */
  private targetSize(img: ImageInfo, dpi: number): { w: number; h: number } {
    let drawnW = img.drawnW;
    let drawnH = img.drawnH;
    if (!drawnW || !drawnH) {
      const k = Math.min(this.fallbackPage.w / img.width, this.fallbackPage.h / img.height);
      drawnW = img.width * k;
      drawnH = img.height * k;
    }
    const scale = Math.max((drawnW * dpi) / 72 / img.width, (drawnH * dpi) / 72 / img.height);
    if (scale >= 0.9) return { w: img.width, h: img.height };
    return { w: Math.max(1, Math.round(img.width * scale)), h: Math.max(1, Math.round(img.height * scale)) };
  }

  private async bitmap(img: ImageInfo): Promise<ImageBitmap | null> {
    const hit = this.cache.get(img.ref);
    if (hit) return hit;
    let bmp: ImageBitmap | null = null;
    try {
      if (img.kind === "jpeg") {
        let jpeg = img.original.contents;
        if (img.wrapped) {
          const d = img.original.dict.clone(this.doc.context);
          const outer = (filterNames(this.doc.context, d) ?? []).slice(0, -1).map((f) => PDFName.of(f.slice(1)));
          d.set(N("Filter"), this.doc.context.obj(outer));
          d.delete(N("DecodeParms"));
          jpeg = decodePDFRawStream(PDFRawStream.of(d, jpeg)).decode();
        }
        bmp = await createImageBitmap(new Blob([jpeg as BlobPart], { type: "image/jpeg" }));
        if (bmp.width !== img.width || bmp.height !== img.height) {
          bmp.close();
          return null;
        }
      } else {
        const data = decodeRaw(this.doc.context, img);
        if (!data) return null;
        img.photo ??= looksLikePhoto(data);
        bmp = await createImageBitmap(data);
      }
    } catch {
      return null;
    }
    const px = img.width * img.height;
    if (this.cachedPx + px <= CACHE_BUDGET_PX) {
      this.cache.set(img.ref, bmp);
      this.cachedPx += px;
    }
    return bmp;
  }

  private async encodeImage(img: ImageInfo, s: Settings): Promise<PDFRawStream | null> {
    const ctx = this.doc.context;
    const bmp = await this.bitmap(img);
    if (!bmp) return null;
    const { w, h } = this.targetSize(img, s.dpi);
    const resized = w !== img.width || h !== img.height;
    const gray = s.grayscale && img.comps === 3;
    const original = img.original.contents.length;
    // A flat graphic (chart, screenshot, clean text scan) stays lossless; only resizing can help it.
    const lossless = img.kind === "raw" && img.photo === false;
    if (lossless && !resized && !gray) return null;

    const canvas = makeCanvas(w, h);
    const g = ctx2d(canvas);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(bmp, 0, 0, w, h);
    if (!this.cache.has(img.ref)) bmp.close();
    const needPixels = gray || lossless;
    const data = needPixels ? g.getImageData(0, 0, w, h) : null;
    if (data && gray) {
      toGray(data);
      if (!lossless) g.putImageData(data, 0, 0);
    }

    const dict = img.original.dict.clone(ctx);
    dict.delete(N("DecodeParms"));
    dict.delete(N("Length"));
    dict.set(N("Width"), PDFNumber.of(w));
    dict.set(N("Height"), PDFNumber.of(h));
    dict.set(N("BitsPerComponent"), PDFNumber.of(8));

    let bytes: Uint8Array;
    if (lossless && data) {
      const outComps = gray || img.comps === 1 ? 1 : 3;
      const raw = new Uint8Array(w * h * outComps);
      const a = data.data;
      if (outComps === 1) for (let i = 0; i < w * h; i++) raw[i] = a[i * 4];
      else
        for (let i = 0, j = 0; i < w * h; i++, j += 3) {
          raw[j] = a[i * 4];
          raw[j + 1] = a[i * 4 + 1];
          raw[j + 2] = a[i * 4 + 2];
        }
      bytes = ctx.flateStream(raw).contents;
      dict.set(N("Filter"), N("FlateDecode"));
      if (outComps === 1 && img.comps === 3) dict.set(N("ColorSpace"), N("DeviceGray"));
    } else {
      bytes = await canvasJpeg(canvas, s.quality);
      dict.set(N("Filter"), N("DCTDecode"));
      // Canvas JPEGs always have 3 components.
      if (!img.iccRgb) dict.set(N("ColorSpace"), N("DeviceRGB"));
    }
    if ("width" in canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    // Same-size JPEG re-encodes must save at least 10% to be worth the generation loss.
    const need = img.kind === "jpeg" && !resized && !gray ? 0.9 : 0.97;
    if (!gray && bytes.length > original * need) return null;
    if (gray && bytes.length > original * 1.05) return null;
    return PDFRawStream.of(dict, bytes);
  }

  /** Re-encode images with these settings and save. Can be called repeatedly. */
  async run(s: Settings, onProgress?: ProgressFn): Promise<{ bytes: Uint8Array; stats: RunStats }> {
    const ctx = this.doc.context;
    let recompressed = 0;
    for (let i = 0; i < this.images.length; i++) {
      onProgress?.("image", i + 1, this.images.length);
      const img = this.images[i];
      let next: PDFRawStream | null = null;
      try {
        next = await this.encodeImage(img, s);
      } catch {
        next = null;
      }
      ctx.assign(img.ref, next ?? img.original);
      if (next) recompressed++;
      await tick();
    }
    onProgress?.("save", 1, 1);
    await tick();
    const bytes = await this.doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 200 });
    return { bytes, stats: { images: this.imageCount, recompressed, unsupported: this.unsupported } };
  }

  dispose() {
    for (const b of this.cache.values()) b.close();
    this.cache.clear();
    this.cachedPx = 0;
  }
}

/**
 * Find the mildest ladder step that brings the file under `target` bytes.
 * Tries the strongest step first: if even that is too big, the target can't
 * be reached without rasterizing, and the smallest result is returned.
 */
export async function compressToTarget(
  c: PdfCompressor,
  target: number,
  grayscale: boolean,
  onProgress?: ProgressFn,
  onAttempt?: (n: number) => void
): Promise<{ bytes: Uint8Array; stats: RunStats; reached: boolean }> {
  let attempt = 0;
  const tryStep = async (i: number) => {
    onAttempt?.(++attempt);
    return c.run({ ...LADDER[i], grayscale }, onProgress);
  };
  let hi = LADDER.length - 1;
  let best = await tryStep(hi);
  if (best.bytes.length > target) return { ...best, reached: false };
  let lo = 0;
  // Invariant: step `hi` fits; find the smallest index that fits.
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const r = await tryStep(mid);
    if (r.bytes.length <= target) {
      best = r;
      hi = mid;
    } else lo = mid + 1;
  }
  return { ...best, reached: true };
}

/** Rasterize at the mildest step that fits under `target` (or the smallest possible). */
export async function rasterizeToTarget(
  bytes: Uint8Array,
  target: number,
  grayscale: boolean,
  onProgress?: ProgressFn,
  onAttempt?: (n: number) => void
): Promise<{ bytes: Uint8Array; reached: boolean; dpi: number }> {
  let attempt = 0;
  const tryStep = async (i: number) => {
    onAttempt?.(++attempt);
    return rasterizePdf(bytes, { ...RASTER_LADDER[i], grayscale }, onProgress);
  };
  // Start in the middle: rendering is the slow part, so keep attempts few.
  let lo = 0;
  let hi = RASTER_LADDER.length - 1;
  let best: { bytes: Uint8Array; i: number } | null = null;
  let smallest: { bytes: Uint8Array; i: number } | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const out = await tryStep(mid);
    if (!smallest || out.length < smallest.bytes.length) smallest = { bytes: out, i: mid };
    if (out.length <= target) {
      best = { bytes: out, i: mid };
      hi = mid - 1;
    } else lo = mid + 1;
  }
  if (best) return { bytes: best.bytes, reached: true, dpi: RASTER_LADDER[best.i].dpi };
  return { bytes: smallest!.bytes, reached: false, dpi: RASTER_LADDER[smallest!.i].dpi };
}

/* ------------------------------------------------------------------ */
/* Rasterize: render every page to a JPEG and rebuild the PDF           */
/* ------------------------------------------------------------------ */

export const RASTER_LADDER: { dpi: number; quality: number }[] = [
  { dpi: 150, quality: 0.75 },
  { dpi: 120, quality: 0.65 },
  { dpi: 100, quality: 0.55 },
  { dpi: 85, quality: 0.5 },
  { dpi: 72, quality: 0.45 },
  { dpi: 60, quality: 0.4 },
  { dpi: 50, quality: 0.35 },
];

export async function rasterizePdf(
  bytes: Uint8Array,
  opts: { dpi: number; quality: number; grayscale: boolean },
  onProgress?: ProgressFn
): Promise<Uint8Array> {
  const { openPdf, renderPageToCanvas } = await import("@/lib/pdfjs");
  const pdf = await openPdf(bytes);
  try {
    const out = await PDFDocument.create();
    for (let n = 1; n <= pdf.numPages; n++) {
      onProgress?.("page", n, pdf.numPages);
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const canvas = await renderPageToCanvas(pdf, n, opts.dpi / 72);
      if (opts.grayscale) {
        const g = canvas.getContext("2d")!;
        const d = g.getImageData(0, 0, canvas.width, canvas.height);
        toGray(d);
        g.putImageData(d, 0, 0);
      }
      const jpg = await canvasJpeg(canvas, opts.quality);
      canvas.width = 0;
      canvas.height = 0;
      const img = await out.embedJpg(jpg);
      out.addPage([vp.width, vp.height]).drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
      await tick();
    }
    return await out.save({ useObjectStreams: true });
  } finally {
    await pdf.destroy();
  }
}
