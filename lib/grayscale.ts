/**
 * Convert a PDF to grayscale or pure black and white without turning pages
 * into pictures, so text stays selectable and vector drawings stay sharp.
 *
 *  1. Content streams (pages, form XObjects, tiling patterns, annotation
 *     appearances, Type 3 glyphs) are rewritten: rg/RG, k/K and sc/scn in
 *     RGB, CMYK, ICC and Lab spaces become DeviceGray values. In black and
 *     white mode every gray is then snapped to 0 or 1 by the threshold.
 *  2. Indexed palettes, gradients and spot colours (Separation) are
 *     converted in place by sampling their colour functions to gray;
 *     annotation colours (/C, /IC) too.
 *  3. Images (8-bit RGB / gray JPEG and Flate) are decoded and re-encoded:
 *     gray as 8-bit DeviceGray (JPEG sources: neutral JPEG), black and white
 *     as 1-bit DeviceGray.
 *  4. Every output page is rendered with pdf.js and checked for colour left
 *     over (DeviceN inks, 2-D gradients, CMYK JPEGs, inline images). A
 *     page that still has colour gets a full-page /Saturation blend layer,
 *     which shows it in grayscale in every PDF 1.4+ viewer while keeping its
 *     text; the result says how many pages needed it.
 */
import {
  PDFArray,
  PDFContext,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
  decodePDFRawStream,
  type PDFObject,
} from "@cantoo/pdf-lib";
import { makeFunction } from "./pdf-function";
import { canvasJpeg, classify, ctx2d, decodeRaw, filterNames, makeCanvas, pageContentBytes, streamBytes, toGray, type ImageInfo } from "./compress";

export type ColorMode = "gray" | "bw";

export type ColorStats = {
  pages: number;
  streams: number;
  images: number;
  imagesSkipped: number;
  gradients: number;
  palettes: number;
  spots: number;
  /** Pages that still showed colour after conversion and got the blend layer. */
  blendPages: number[];
  /** Grayscale mode only: the input had no visible colour, so it was returned unchanged. */
  alreadyGray: boolean;
};

export class GrayError extends Error {
  constructor(public code: "encrypted" | "unreadable") {
    super(code);
  }
}

export type GrayProgress = (label: string, fraction: number) => void;

const N = (s: string) => PDFName.of(s);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

type Src = "gray" | "rgb" | "cmyk" | "lab" | "keep";

class Converter {
  constructor(public mode: ColorMode, public threshold: number) {}
  /** Final gray value for a luminance 0..1. */
  out(y: number): number {
    y = Math.max(0, Math.min(1, y));
    return this.mode === "bw" ? (y < this.threshold ? 0 : 1) : y;
  }
  fromRgb(r: number, g: number, b: number) {
    return this.out(0.299 * r + 0.587 * g + 0.114 * b);
  }
  fromCmyk(c: number, m: number, y: number, k: number) {
    return this.fromRgb((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k));
  }
  fromLab(l: number) {
    return this.out(l / 100);
  }
  convert(src: Src, v: number[]): number | null {
    if (src === "gray" && v.length === 1) return this.out(v[0]);
    if (src === "rgb" && v.length === 3) return this.fromRgb(v[0], v[1], v[2]);
    if (src === "cmyk" && v.length === 4) return this.fromCmyk(v[0], v[1], v[2], v[3]);
    if (src === "lab" && v.length === 3) return this.fromLab(v[0]);
    return null;
  }
}

const fmt = (n: number) => (Math.round(n * 10000) / 10000).toString();

/* ------------------------------------------------------------------ */
/* Colour spaces                                                       */
/* ------------------------------------------------------------------ */

function deref(ctx: PDFContext, o: PDFObject | undefined): PDFObject | undefined {
  return o instanceof PDFRef ? ctx.lookup(o) : o;
}

/** What a colour space's operands mean, for conversion to gray. */
function spaceKind(ctx: PDFContext, cs: PDFObject | undefined): Src {
  const v = deref(ctx, cs);
  if (v instanceof PDFName) {
    const n = v.toString();
    if (n === "/DeviceGray" || n === "/CalGray" || n === "/G") return "gray";
    if (n === "/DeviceRGB" || n === "/CalRGB" || n === "/RGB") return "rgb";
    if (n === "/DeviceCMYK" || n === "/CMYK") return "cmyk";
    return "keep";
  }
  if (v instanceof PDFArray && v.size() >= 1) {
    const k = v.lookup(0)?.toString();
    if (k === "/CalRGB") return "rgb";
    if (k === "/CalGray") return "gray";
    if (k === "/Lab") return "lab";
    if (k === "/ICCBased") {
      const s = v.lookup(1);
      const n = s instanceof PDFStream ? s.dict.lookup(N("N")) : undefined;
      const num = n instanceof PDFNumber ? n.asNumber() : 0;
      if (num === 1) return "gray";
      if (num === 3) return "rgb";
      if (num === 4) return "cmyk";
    }
  }
  return "keep";
}

function comps(src: Src): number {
  return src === "gray" ? 1 : src === "cmyk" ? 4 : src === "keep" ? 0 : 3;
}

function stringBytes(ctx: PDFContext, o: PDFObject | undefined): Uint8Array | null {
  const v = deref(ctx, o);
  if (v instanceof PDFHexString || v instanceof PDFString) return v.asBytes();
  if (v instanceof PDFRawStream) {
    try {
      return decodePDFRawStream(v).decode();
    } catch {
      return null;
    }
  }
  return null;
}

/** [/Indexed base hival lookup] → [/Indexed /DeviceGray hival grayLookup], in place. */
function convertIndexed(ctx: PDFContext, arr: PDFArray, conv: Converter): boolean {
  const src = spaceKind(ctx, arr.get(1));
  if (src === "keep") return false;
  const hival = (deref(ctx, arr.get(2)) as PDFNumber | undefined)?.asNumber?.();
  const lut = stringBytes(ctx, arr.get(3));
  if (hival === undefined || !lut) return false;
  const n = comps(src);
  if (lut.length < (hival + 1) * n) return false;
  const out = new Uint8Array(hival + 1);
  for (let i = 0; i <= hival; i++) {
    const v = Array.from(lut.subarray(i * n, i * n + n), (x) => x / 255);
    const y = src === "lab" ? conv.fromLab(v[0] * 100) : conv.convert(src, v) ?? 0;
    out[i] = Math.round(y * 255);
  }
  arr.set(1, N("DeviceGray"));
  arr.set(3, PDFHexString.fromBytes(out));
  return true;
}

function numbers(ctx: PDFContext, o: PDFObject | undefined): number[] | null {
  const a = deref(ctx, o);
  if (!(a instanceof PDFArray)) return null;
  const out: number[] = [];
  for (let i = 0; i < a.size(); i++) {
    const v = a.lookup(i);
    if (!(v instanceof PDFNumber)) return null;
    out.push(v.asNumber());
  }
  return out;
}

/** Domain of a (possibly array-of) function, or the fallback. */
function fnDomain(ctx: PDFContext, fnObj: PDFObject | undefined, fallback: number[]): number[] {
  let f = deref(ctx, fnObj);
  if (f instanceof PDFArray) f = f.lookup(0);
  const d = f instanceof PDFStream ? f.dict : f;
  return (d instanceof PDFDict ? numbers(ctx, d.get(N("Domain"))) : null) ?? fallback;
}

/**
 * Sample a one-input colour function 256 times and return an equivalent
 * one-output gray function (Type 0, 8-bit), or null if it can't be evaluated.
 */
function grayFunction(ctx: PDFContext, fnObj: PDFObject | undefined, src: Src, conv: Converter, domain: number[]): PDFRef | null {
  const fn = makeFunction(ctx, fnObj);
  if (!fn) return null;
  const samples = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const t = domain[0] + ((domain[1] - domain[0]) * i) / 255;
    let out: number[];
    try {
      out = fn([t]);
    } catch {
      return null;
    }
    if (out.some((v) => !Number.isFinite(v))) return null;
    const y = conv.convert(src, out.slice(0, comps(src)));
    if (y === null) return null;
    samples[i] = Math.round(y * 255);
  }
  const stream = ctx.flateStream(samples, {
    FunctionType: 0,
    Domain: domain.slice(0, 2),
    Range: [0, 1],
    Size: [256],
    BitsPerSample: 8,
  });
  return ctx.register(stream);
}

/** [/Separation name alt tintFn] → same spot colour with a gray alternate, in place. */
function convertSeparation(ctx: PDFContext, arr: PDFArray, conv: Converter): boolean {
  const name = arr.lookup(1)?.toString();
  if (name === "/None") return false;
  const src = spaceKind(ctx, arr.get(2));
  if (src === "keep" || (src === "gray" && conv.mode === "gray")) return false;
  const fn = grayFunction(ctx, arr.get(3), src, conv, fnDomain(ctx, arr.get(3), [0, 1]));
  if (!fn) return false;
  arr.set(2, N("DeviceGray"));
  arr.set(3, fn);
  return true;
}

/** Axial and radial gradients (and meshes driven by a function): sample the colour function to gray. */
function convertShading(ctx: PDFContext, sh: PDFDict, conv: Converter): boolean {
  const src = spaceKind(ctx, sh.get(N("ColorSpace")));
  if (src === "keep" || (src === "gray" && conv.mode === "gray")) return false;
  const type = (deref(ctx, sh.get(N("ShadingType"))) as PDFNumber | undefined)?.asNumber?.() ?? 0;
  if (type < 2 || !sh.get(N("Function"))) return false;
  const domain = fnDomain(ctx, sh.get(N("Function")), numbers(ctx, sh.get(N("Domain"))) ?? [0, 1]);
  const fn = grayFunction(ctx, sh.get(N("Function")), src, conv, domain);
  if (!fn) return false;
  sh.set(N("Function"), fn);
  const bg = numbers(ctx, sh.get(N("Background")));
  if (bg) {
    const y = conv.convert(src, bg);
    if (y !== null) sh.set(N("Background"), ctx.obj([y]));
    else sh.delete(N("Background"));
  }
  sh.set(N("ColorSpace"), N("DeviceGray"));
  return true;
}

/* ------------------------------------------------------------------ */
/* Content stream rewriting                                            */
/* ------------------------------------------------------------------ */

const isWhite = (c: number) => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09 || c === 0x0c || c === 0x00;
const isDelim = (c: number) =>
  c === 0x28 || c === 0x29 || c === 0x3c || c === 0x3e || c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d || c === 0x2f || c === 0x25;

type Operand = { start: number; num?: number; name?: string };
type State = { fill: Src; stroke: Src };

const enc = new TextEncoder();

/** Rewrite colour operators in one content stream. Returns null when nothing changed. */
function rewriteContent(ctx: PDFContext, b: Uint8Array, resources: PDFDict | undefined, conv: Converter): Uint8Array | null {
  const csDict = resources?.lookupMaybe(N("ColorSpace"), PDFDict);
  const resolveSpace = (name: string): Src => {
    const direct = spaceKind(ctx, N(name));
    if (direct !== "keep" || !csDict) return direct;
    return spaceKind(ctx, csDict.get(N(name)));
  };
  const chunks: Uint8Array[] = [];
  let copyFrom = 0;
  let changed = false;
  let ops: Operand[] = [];
  let st: State = { fill: "gray", stroke: "gray" };
  const stack: State[] = [];
  const replace = (from: number, to: number, text: string) => {
    chunks.push(b.subarray(copyFrom, from), enc.encode(text));
    copyFrom = to;
    changed = true;
  };
  const len = b.length;
  let i = 0;
  while (i < len) {
    const c = b[i];
    if (isWhite(c)) {
      i++;
      continue;
    }
    if (c === 0x25) {
      while (i < len && b[i] !== 0x0a && b[i] !== 0x0d) i++;
      continue;
    }
    if (c === 0x28) {
      const start = i;
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
      ops.push({ start });
      continue;
    }
    if (c === 0x3c && b[i + 1] !== 0x3c) {
      const start = i;
      while (i < len && b[i] !== 0x3e) i++;
      i++;
      ops.push({ start });
      continue;
    }
    if (c === 0x3c || c === 0x3e) {
      if (!ops.length || c === 0x3c) ops.push({ start: i });
      i += b[i + 1] === c ? 2 : 1;
      continue;
    }
    if (c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d) {
      ops.push({ start: i });
      i++;
      continue;
    }
    if (c === 0x2f) {
      const start = i;
      let j = i + 1;
      while (j < len && !isWhite(b[j]) && !isDelim(b[j])) j++;
      let name = "";
      for (let k = i + 1; k < j; k++) name += String.fromCharCode(b[k]);
      name = name.replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      ops.push({ start, name });
      i = j;
      continue;
    }
    let j = i;
    while (j < len && !isWhite(b[j]) && !isDelim(b[j])) j++;
    if (j === i) {
      i++;
      continue;
    }
    const start = i;
    let tok = "";
    for (let k = i; k < j; k++) tok += String.fromCharCode(b[k]);
    i = j;
    const first = tok.charCodeAt(0);
    if ((first >= 0x30 && first <= 0x39) || first === 0x2d || first === 0x2b || first === 0x2e) {
      const v = parseFloat(tok);
      ops.push({ start, num: Number.isFinite(v) ? v : 0 });
      continue;
    }
    if (tok === "true" || tok === "false" || tok === "null") {
      ops.push({ start });
      continue;
    }
    // Operator.
    const from = ops.length ? ops[0].start : start;
    const nums = ops.every((o) => o.num !== undefined) ? ops.map((o) => o.num!) : null;
    const stroke = tok === tok.toUpperCase() && tok !== "BI";
    switch (tok) {
      case "q":
        stack.push({ ...st });
        break;
      case "Q":
        st = stack.pop() ?? st;
        break;
      case "g":
      case "G":
        if (stroke) st.stroke = "gray";
        else st.fill = "gray";
        if (conv.mode === "bw" && nums?.length === 1) replace(from, i, `${fmt(conv.out(nums[0]))} ${tok}`);
        break;
      case "rg":
      case "RG":
      case "k":
      case "K": {
        if (stroke) st.stroke = "gray";
        else st.fill = "gray";
        const y = nums ? conv.convert(tok.toLowerCase() === "rg" ? "rgb" : "cmyk", nums) : null;
        if (y !== null) replace(from, i, `${fmt(y)} ${stroke ? "G" : "g"}`);
        break;
      }
      case "cs":
      case "CS": {
        const name = ops[ops.length - 1]?.name;
        const kind = name ? resolveSpace(name) : "keep";
        if (stroke) st.stroke = kind;
        else st.fill = kind;
        if (kind !== "keep" && kind !== "gray") replace(from, i, `/DeviceGray ${tok}`);
        break;
      }
      case "sc":
      case "scn":
      case "SC":
      case "SCN": {
        const src = stroke ? st.stroke : st.fill;
        if (src === "keep" || !nums) break;
        if (src === "gray" && conv.mode === "gray") break;
        const y = conv.convert(src, nums);
        if (y !== null) replace(from, i, `${fmt(y)} ${tok}`);
        break;
      }
      case "BI": {
        // Inline image: copy through untouched (the render check catches colour ones).
        let k = i;
        while (k < len - 1 && !(b[k] === 0x49 && b[k + 1] === 0x44 && isWhite(b[k - 1]) && isWhite(b[k + 2] ?? 0x20))) k++;
        k += 3;
        while (k < len) {
          if (b[k] === 0x45 && b[k + 1] === 0x49 && isWhite(b[k - 1]) && (k + 2 >= len || isWhite(b[k + 2]))) break;
          k++;
        }
        i = Math.min(len, k + 2);
        break;
      }
    }
    ops = [];
  }
  if (!changed) return null;
  chunks.push(b.subarray(copyFrom));
  const total = chunks.reduce((n, x) => n + x.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const x of chunks) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

async function imagePixels(ctx: PDFContext, img: ImageInfo): Promise<ImageData | null> {
  if (img.kind === "raw") return decodeRaw(ctx, img);
  try {
    let jpeg = img.original.contents;
    if (img.wrapped) {
      // JPEG inside ASCII85/Flate: undo the outer filters first.
      const d = img.original.dict.clone(ctx);
      const outer = (filterNames(ctx, d) ?? []).slice(0, -1).map((f) => PDFName.of(f.slice(1)));
      d.set(N("Filter"), ctx.obj(outer));
      d.delete(N("DecodeParms"));
      jpeg = decodePDFRawStream(PDFRawStream.of(d, jpeg)).decode();
    }
    const bmp = await createImageBitmap(new Blob([jpeg as BlobPart], { type: "image/jpeg" }));
    if (bmp.width !== img.width || bmp.height !== img.height) {
      bmp.close();
      return null;
    }
    const c = makeCanvas(img.width, img.height);
    const g = ctx2d(c);
    g.drawImage(bmp, 0, 0);
    bmp.close();
    return g.getImageData(0, 0, img.width, img.height);
  } catch {
    return null;
  }
}

async function convertImage(ctx: PDFContext, img: ImageInfo, conv: Converter): Promise<PDFRawStream | null> {
  if (img.comps === 1 && conv.mode === "gray") return null;
  const data = await imagePixels(ctx, img);
  if (!data) return null;
  toGray(data);
  const { width: w, height: h } = img;
  const dict = img.original.dict.clone(ctx);
  dict.delete(N("DecodeParms"));
  dict.delete(N("Length"));
  dict.delete(N("Decode"));
  const a = data.data;
  if (conv.mode === "bw") {
    const t = Math.round(conv.threshold * 255);
    const rowBytes = Math.ceil(w / 8);
    const bits = new Uint8Array(rowBytes * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) if (a[(y * w + x) * 4] >= t) bits[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    dict.set(N("BitsPerComponent"), PDFNumber.of(1));
    dict.set(N("ColorSpace"), N("DeviceGray"));
    dict.set(N("Filter"), N("FlateDecode"));
    return PDFRawStream.of(dict, ctx.flateStream(bits).contents);
  }
  if (img.kind === "jpeg") {
    // Canvas can only write 3-channel JPEGs; neutral pixels keep the chroma planes empty.
    const c = makeCanvas(w, h);
    ctx2d(c).putImageData(data, 0, 0);
    const bytes = await canvasJpeg(c, 0.9);
    dict.set(N("Filter"), N("DCTDecode"));
    dict.set(N("ColorSpace"), N("DeviceRGB"));
    return PDFRawStream.of(dict, bytes);
  }
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = a[i * 4];
  dict.set(N("BitsPerComponent"), PDFNumber.of(8));
  dict.set(N("ColorSpace"), N("DeviceGray"));
  dict.set(N("Filter"), N("FlateDecode"));
  return PDFRawStream.of(dict, ctx.flateStream(gray).contents);
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function setStream(ctx: PDFContext, ref: PDFRef, original: PDFStream, content: Uint8Array) {
  const dict = original.dict.clone(ctx);
  dict.delete(N("DecodeParms"));
  dict.delete(N("Length"));
  dict.set(N("Filter"), N("FlateDecode"));
  ctx.assign(ref, PDFRawStream.of(dict, ctx.flateStream(content).contents));
}

function convertAnnotColors(ctx: PDFContext, a: PDFDict, conv: Converter) {
  for (const key of ["C", "IC"]) {
    const v = numbers(ctx, a.get(N(key)));
    if (!v || v.length === 0) continue;
    const y = conv.convert(v.length === 1 ? "gray" : v.length === 3 ? "rgb" : "cmyk", v);
    if (y !== null) a.set(N(key), ctx.obj([y]));
  }
  const mk = a.lookupMaybe(N("MK"), PDFDict);
  if (mk) convertAnnotColors(ctx, mk, conv);
}

/** Visit every direct object nested in `o` (not following references). */
function walkDirect(o: PDFObject, fn: (o: PDFObject) => void, depth = 0) {
  if (depth > 12) return;
  fn(o);
  if (o instanceof PDFDict) for (const [, v] of o.entries()) if (!(v instanceof PDFRef)) walkDirect(v, fn, depth + 1);
  if (o instanceof PDFArray) for (const v of o.asArray()) if (!(v instanceof PDFRef)) walkDirect(v, fn, depth + 1);
  if (o instanceof PDFStream) walkDirect(o.dict, fn, depth + 1);
}

export async function convertColors(
  bytes: Uint8Array,
  opts: { mode: ColorMode; threshold: number },
  onProgress?: GrayProgress
): Promise<{ bytes: Uint8Array; stats: ColorStats }> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, password: "", updateMetadata: false });
  } catch (e) {
    if (e instanceof Error && /encrypt|password/i.test(e.name + e.message)) throw new GrayError("encrypted");
    throw new GrayError("unreadable");
  }
  if (doc.isEncrypted || doc.context.trailerInfo.Encrypt) throw new GrayError("encrypted");
  const ctx = doc.context;
  const conv = new Converter(opts.mode, opts.threshold);
  const pages = doc.getPages();
  const stats: ColorStats = { pages: pages.length, streams: 0, images: 0, imagesSkipped: 0, gradients: 0, palettes: 0, spots: 0, blendPages: [], alreadyGray: false };

  // A file with no visible colour needs no grayscale pass: return it byte for byte.
  if (opts.mode === "gray" && !hasColouredAnnots(doc)) {
    const before = await findColourPages(bytes, (n, total) => onProgress?.(`Checking page ${n} of ${total}`, (0.1 * n) / total));
    if (before.length === 0) {
      stats.alreadyGray = true;
      return { bytes, stats };
    }
  }

  // 1. Palettes, gradients and annotation colours, wherever they are.
  onProgress?.("Converting colours", 0.02);
  const seen = new Set<PDFObject>();
  const objects = [...ctx.enumerateIndirectObjects()];
  for (const [, obj] of objects) {
    walkDirect(obj, (o) => {
      if (seen.has(o)) return;
      seen.add(o);
      if (o instanceof PDFArray && o.lookup(0) === N("Indexed")) {
        if (convertIndexed(ctx, o, conv)) stats.palettes++;
      } else if (o instanceof PDFArray && o.lookup(0) === N("Separation")) {
        if (convertSeparation(ctx, o, conv)) stats.spots++;
      } else if (o instanceof PDFDict && o.get(N("ShadingType"))) {
        if (convertShading(ctx, o, conv)) stats.gradients++;
      } else if (o instanceof PDFDict && o.get(N("Subtype")) && o.get(N("Rect")) && (o.get(N("C")) || o.get(N("IC")) || o.get(N("MK")))) {
        convertAnnotColors(ctx, o, conv);
      }
    });
  }

  // 2. Content streams: forms, tiling patterns, appearance streams, Type 3 glyphs.
  const streams = new Map<PDFRef, PDFDict | undefined>();
  for (const [ref, obj] of objects) {
    if (obj instanceof PDFStream) {
      const d = obj.dict;
      const isForm = d.get(N("Subtype")) === N("Form");
      const isPattern = (deref(ctx, d.get(N("PatternType"))) as PDFNumber | undefined)?.asNumber?.() === 1;
      if (isForm || isPattern) streams.set(ref, d.lookupMaybe(N("Resources"), PDFDict));
    } else if (obj instanceof PDFDict && obj.get(N("Subtype")) === N("Type3")) {
      const procs = obj.lookupMaybe(N("CharProcs"), PDFDict);
      const res = obj.lookupMaybe(N("Resources"), PDFDict);
      if (procs) for (const [, v] of procs.entries()) if (v instanceof PDFRef) streams.set(v, res);
    }
  }
  // Appearance streams sometimes lack /Subtype /Form.
  for (const page of pages) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i);
      const ap = a instanceof PDFDict ? a.lookupMaybe(N("AP"), PDFDict) : undefined;
      if (!ap) continue;
      for (const [, v] of ap.entries()) {
        const refs: PDFObject[] = [v];
        const d = deref(ctx, v);
        if (d instanceof PDFDict && !(d instanceof PDFStream)) refs.push(...d.entries().map(([, x]) => x));
        for (const r of refs) {
          const s = r instanceof PDFRef ? ctx.lookup(r) : undefined;
          if (r instanceof PDFRef && s instanceof PDFStream && !streams.has(r)) streams.set(r, s.dict.lookupMaybe(N("Resources"), PDFDict));
        }
      }
    }
  }
  let done = 0;
  for (const [ref, res] of streams) {
    const s = ctx.lookup(ref);
    if (!(s instanceof PDFRawStream)) continue;
    const content = streamBytes(ctx, s);
    if (!content) continue;
    const out = rewriteContent(ctx, content, res, conv);
    if (out) {
      setStream(ctx, ref, s, out);
      stats.streams++;
    }
    if (++done % 50 === 0) await tick();
  }
  for (let p = 0; p < pages.length; p++) {
    onProgress?.(`Converting page ${p + 1} of ${pages.length}`, 0.05 + (0.25 * (p + 1)) / pages.length);
    const node = pages[p].node;
    const content = pageContentBytes(ctx, node.Contents());
    if (!content) continue;
    const out = rewriteContent(ctx, content, node.Resources(), conv);
    if (out) {
      node.set(N("Contents"), ctx.register(ctx.flateStream(out)));
      stats.streams++;
    }
    if (p % 10 === 9) await tick();
  }

  // 3. Images.
  const images: ImageInfo[] = [];
  for (const [ref, obj] of objects) {
    if (!(obj instanceof PDFRawStream) || obj.dict.get(N("Subtype")) !== N("Image")) continue;
    if (obj.dict.lookup(N("ImageMask"))?.toString() === "true") continue; // stencil: drawn in the fill colour
    const cs = spaceKind(ctx, obj.dict.get(N("ColorSpace")));
    const info = classify(ctx, ref, obj);
    if (info === "unsupported") {
      // 1-bit scans, gray JBIG2/CCITT and converted palettes are already gray.
      const bpc = (obj.dict.lookup(N("BitsPerComponent")) as PDFNumber | undefined)?.asNumber?.();
      const indexed = obj.dict.lookup(N("ColorSpace")) instanceof PDFArray && (obj.dict.lookup(N("ColorSpace")) as PDFArray).lookup(0) === N("Indexed");
      if (!(cs === "gray" || bpc === 1 || indexed)) stats.imagesSkipped++;
      continue;
    }
    images.push(info);
  }
  // Soft masks are alpha channels, not colour: leave them.
  const masks = new Set<PDFRef>();
  for (const img of images) {
    const sm = img.original.dict.get(N("SMask"));
    if (sm instanceof PDFRef) masks.add(sm);
  }
  const todo = images.filter((img) => !masks.has(img.ref));
  for (let k = 0; k < todo.length; k++) {
    onProgress?.(`Converting image ${k + 1} of ${todo.length}`, 0.3 + (0.35 * (k + 1)) / todo.length);
    const img = todo[k];
    let next: PDFRawStream | null = null;
    try {
      next = await convertImage(ctx, img, conv);
    } catch {
      next = null;
    }
    if (next) {
      ctx.assign(img.ref, next);
      stats.images++;
    } else if (!(img.comps === 1 && conv.mode === "gray")) stats.imagesSkipped++;
    await tick();
  }

  onProgress?.("Saving", 0.68);
  let out = await doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });

  // 4. Render check: any page that still shows colour gets a saturation blend layer.
  const colourful = await findColourPages(out, (n, total) => onProgress?.(`Checking page ${n} of ${total}`, 0.7 + (0.28 * n) / total));
  if (colourful.length) {
    for (const idx of colourful) addBlendLayer(doc, idx);
    stats.blendPages = colourful.map((i) => i + 1);
    out = await doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
  }
  onProgress?.("Done", 1);
  return { bytes: out, stats };
}

/** Comment colours (/C, /IC) that viewers draw even without an appearance stream. */
function hasColouredAnnots(doc: PDFDocument): boolean {
  const ctx = doc.context;
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i);
      if (!(a instanceof PDFDict)) continue;
      for (const key of ["C", "IC"]) {
        const v = numbers(ctx, a.get(N(key)));
        if (v && v.length === 3 && (v[0] !== v[1] || v[1] !== v[2])) return true;
        if (v && v.length === 4 && (v[0] || v[1] || v[2])) return true;
      }
    }
  }
  return false;
}

/** Render every page small and return the 0-based indexes of pages with visible colour. */
async function findColourPages(bytes: Uint8Array, onPage?: (n: number, total: number) => void): Promise<number[]> {
  const { openPdf, renderPageToCanvas } = await import("./pdfjs");
  const pdf = await openPdf(bytes);
  const out: number[] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      onPage?.(n, pdf.numPages);
      const canvas = await renderPageToCanvas(pdf, n, 50 / 72);
      const g = canvas.getContext("2d")!;
      const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
      let colour = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        if (Math.max(r, gg, b) - Math.min(r, gg, b) > 24) colour++;
      }
      canvas.width = 0;
      canvas.height = 0;
      if (colour > Math.max(8, (d.length / 4) * 0.0003)) out.push(n - 1);
    }
  } finally {
    await pdf.destroy();
  }
  return out;
}

/** Draw a full-page rectangle in /Saturation blend mode: keeps luminosity, removes colour. */
function addBlendLayer(doc: PDFDocument, index: number) {
  const ctx = doc.context;
  const page = doc.getPage(index);
  const node = page.node;
  const gs = ctx.register(ctx.obj({ Type: "ExtGState", BM: "Saturation", ca: 1, CA: 1 }));
  const name = node.newExtGState("GrayBlend", gs);
  const box = page.getMediaBox();
  const pre = ctx.register(ctx.flateStream(enc.encode("q\n")));
  const post = ctx.register(
    ctx.flateStream(enc.encode(`\nQ q ${name.toString()} gs 0.5 g ${fmt(box.x)} ${fmt(box.y)} ${fmt(box.width)} ${fmt(box.height)} re f Q\n`))
  );
  const contents = node.Contents();
  const list: PDFObject[] = [pre];
  const c = deref(ctx, contents);
  if (c instanceof PDFArray) list.push(...c.asArray());
  else if (contents) list.push(contents);
  list.push(post);
  node.set(N("Contents"), ctx.obj(list));
}
