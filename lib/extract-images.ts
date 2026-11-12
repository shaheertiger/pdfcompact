/**
 * Pull the pictures out of a PDF, at the size they're stored in the file.
 *
 * 1. Walk every page's image XObjects (including ones nested in form XObjects).
 * 2. JPEG streams (DCTDecode) are saved byte-for-byte: the exact original file,
 *    no quality loss.
 * 3. Flate/LZW/RunLength streams in gray, RGB, ICC or indexed colour are
 *    decoded here (PNG predictors and soft masks included) and saved as PNG.
 * 4. Anything else (JPEG 2000, CMYK, CCITT fax, JBIG2, unusual bit depths) is
 *    decoded by pdf.js and saved as PNG.
 * Images used on several pages are saved once (matched by content hash).
 */
import type * as PdfLib from "@cantoo/pdf-lib";
import { canvasBlob, ctx2d, hashBytes, makeCanvas, yieldToUi } from "@/lib/image-utils";

export type ExtractedImage = {
  id: string;
  blob: Blob;
  ext: "jpg" | "png";
  width: number;
  height: number;
  /** 1-based pages the image appears on. */
  pages: number[];
  /** original = exact JPEG bytes from the PDF; decoded = lossless PNG of the stored pixels. */
  method: "original" | "decoded";
  name: string;
  /** Soft mask (transparency) was not applied to an original JPEG. */
  droppedMask: boolean;
};

export type ExtractSummary = {
  images: ExtractedImage[];
  /** Distinct images skipped by the size filter. */
  skippedSmall: number;
  /** Distinct images that couldn't be decoded. */
  failed: number;
  pageCount: number;
};

type Lib = typeof PdfLib;
type Found = { key: string; stream: PdfLib.PDFRawStream; pages: Set<number> };

type ColorInfo =
  | { kind: "gray" | "rgb" }
  | { kind: "indexed"; base: "gray" | "rgb"; hival: number; lookup: Uint8Array }
  | { kind: "other" };

class NeedsRender extends Error {}

function num(lib: Lib, v: unknown, fallback = 0): number {
  return v instanceof lib.PDFNumber ? v.asNumber() : fallback;
}

function filtersOf(lib: Lib, dict: PdfLib.PDFDict): string[] {
  const f = dict.lookup(lib.PDFName.of("Filter"));
  if (f instanceof lib.PDFName) return [f.asString()];
  if (f instanceof lib.PDFArray) return f.asArray().map((x) => (dict.context.lookup(x) as PdfLib.PDFName).asString?.() ?? "");
  return [];
}

function colorInfo(lib: Lib, ctx: PdfLib.PDFContext, csRaw: unknown): ColorInfo {
  const cs = ctx.lookup(csRaw as PdfLib.PDFObject);
  if (cs instanceof lib.PDFName) {
    const n = cs.asString();
    if (n === "/DeviceGray" || n === "/CalGray" || n === "/G") return { kind: "gray" };
    if (n === "/DeviceRGB" || n === "/CalRGB" || n === "/RGB") return { kind: "rgb" };
    return { kind: "other" };
  }
  if (cs instanceof lib.PDFArray) {
    const head = ctx.lookup(cs.get(0));
    const name = head instanceof lib.PDFName ? head.asString() : "";
    if (name === "/CalGray") return { kind: "gray" };
    if (name === "/CalRGB") return { kind: "rgb" };
    if (name === "/ICCBased") {
      const s = ctx.lookup(cs.get(1));
      const N = s instanceof lib.PDFRawStream ? num(lib, s.dict.lookup(lib.PDFName.of("N"))) : 0;
      if (N === 1) return { kind: "gray" };
      if (N === 3) return { kind: "rgb" };
      return { kind: "other" };
    }
    if (name === "/Indexed" || name === "/I") {
      const base = colorInfo(lib, ctx, cs.get(1));
      if (base.kind !== "gray" && base.kind !== "rgb") return { kind: "other" };
      const hival = num(lib, ctx.lookup(cs.get(2)));
      const lk = ctx.lookup(cs.get(3));
      let lookup: Uint8Array | null = null;
      if (lk instanceof lib.PDFString || lk instanceof lib.PDFHexString) lookup = lk.asBytes();
      else if (lk instanceof lib.PDFRawStream) lookup = lib.decodePDFRawStream(lk).decode();
      if (!lookup) return { kind: "other" };
      return { kind: "indexed", base: base.kind, hival, lookup };
    }
  }
  return { kind: "other" };
}

async function inflate(lib: Lib, stream: PdfLib.PDFRawStream, filters: string[]): Promise<Uint8Array> {
  if (filters.length === 1 && filters[0] === "/FlateDecode" && typeof DecompressionStream !== "undefined") {
    try {
      const ds = new Blob([stream.contents as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
      return new Uint8Array(await new Response(ds).arrayBuffer());
    } catch {
      /* truncated or odd stream: pdf-lib's decoder is more forgiving */
    }
  }
  return lib.decodePDFRawStream(stream).decode();
}

/** Undo PNG (10–15) or TIFF (2) predictors. */
function unpredict(lib: Lib, dict: PdfLib.PDFDict, data: Uint8Array, colors: number, bpc: number, width: number): Uint8Array {
  let parms = dict.lookup(lib.PDFName.of("DecodeParms"));
  if (parms instanceof lib.PDFArray) parms = dict.context.lookup(parms.get(parms.size() - 1));
  if (!(parms instanceof lib.PDFDict)) return data;
  const predictor = num(lib, parms.lookup(lib.PDFName.of("Predictor")), 1);
  if (predictor <= 1) return data;
  const cols = num(lib, parms.lookup(lib.PDFName.of("Columns")), width);
  const ncomp = num(lib, parms.lookup(lib.PDFName.of("Colors")), colors);
  const bits = num(lib, parms.lookup(lib.PDFName.of("BitsPerComponent")), bpc);
  const bpp = Math.max(1, Math.ceil((ncomp * bits) / 8));
  const rowLen = Math.ceil((cols * ncomp * bits) / 8);
  if (predictor === 2) {
    if (bits !== 8) throw new NeedsRender();
    const out = data.slice();
    for (let r = 0; r * rowLen < out.length; r++) {
      const o = r * rowLen;
      for (let i = bpp; i < rowLen && o + i < out.length; i++) out[o + i] = (out[o + i] + out[o + i - bpp]) & 0xff;
    }
    return out;
  }
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  const prev = new Uint8Array(rowLen);
  for (let r = 0; r < rows; r++) {
    const type = data[r * (rowLen + 1)];
    const src = r * (rowLen + 1) + 1;
    const dst = r * rowLen;
    for (let i = 0; i < rowLen; i++) {
      const x = data[src + i];
      const a = i >= bpp ? out[dst + i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v: number;
      switch (type) {
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: v = x;
      }
      out[dst + i] = v & 0xff;
    }
    prev.set(out.subarray(dst, dst + rowLen));
  }
  return out;
}

/** Unpack 1/2/4/8-bit samples of one row-aligned image into 0–255 component values (or raw indices). */
function samples(data: Uint8Array, width: number, height: number, comps: number, bpc: number, scaleTo255: boolean): Uint8Array {
  if (bpc === 8) return data;
  const out = new Uint8Array(width * height * comps);
  const rowLen = Math.ceil((width * comps * bpc) / 8);
  const max = (1 << bpc) - 1;
  for (let y = 0; y < height; y++) {
    for (let i = 0; i < width * comps; i++) {
      const bit = i * bpc;
      const byte = data[y * rowLen + (bit >> 3)] ?? 0;
      const v = (byte >> (8 - bpc - (bit & 7))) & max;
      out[y * width * comps + i] = scaleTo255 ? Math.round((v * 255) / max) : v;
    }
  }
  return out;
}

async function decodeToRgba(lib: Lib, stream: PdfLib.PDFRawStream, ctx: PdfLib.PDFContext): Promise<{ rgba: Uint8ClampedArray; width: number; height: number; raw: Uint8Array }> {
  const d = stream.dict;
  const filters = filtersOf(lib, d);
  const supported = ["/FlateDecode", "/Fl", "/LZWDecode", "/LZW", "/ASCII85Decode", "/A85", "/ASCIIHexDecode", "/AHx", "/RunLengthDecode", "/RL"];
  if (!filters.every((f) => supported.includes(f))) throw new NeedsRender();
  if (d.lookup(lib.PDFName.of("Decode"))) throw new NeedsRender();
  const width = num(lib, d.lookup(lib.PDFName.of("Width")));
  const height = num(lib, d.lookup(lib.PDFName.of("Height")));
  const bpc = num(lib, d.lookup(lib.PDFName.of("BitsPerComponent")), 8);
  const ci = colorInfo(lib, ctx, d.get(lib.PDFName.of("ColorSpace")));
  if (ci.kind === "other" || ![1, 2, 4, 8].includes(bpc) || !width || !height) throw new NeedsRender();
  if (ci.kind !== "indexed" && bpc !== 8 && !(ci.kind === "gray")) throw new NeedsRender();
  const comps = ci.kind === "rgb" ? 3 : 1;
  const raw = await inflate(lib, stream, filters);
  const data = unpredict(lib, d, raw, comps, bpc, width);
  const px = samples(data, width, height, comps, bpc, ci.kind !== "indexed");
  if (px.length < width * height * comps) throw new NeedsRender();
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += 4) {
    if (ci.kind === "rgb") {
      rgba[j] = px[i * 3];
      rgba[j + 1] = px[i * 3 + 1];
      rgba[j + 2] = px[i * 3 + 2];
    } else if (ci.kind === "gray") {
      rgba[j] = rgba[j + 1] = rgba[j + 2] = px[i];
    } else if (ci.kind === "indexed") {
      const idx = Math.min(px[i], ci.hival);
      if (ci.base === "rgb") {
        rgba[j] = ci.lookup[idx * 3] ?? 0;
        rgba[j + 1] = ci.lookup[idx * 3 + 1] ?? 0;
        rgba[j + 2] = ci.lookup[idx * 3 + 2] ?? 0;
      } else rgba[j] = rgba[j + 1] = rgba[j + 2] = ci.lookup[idx] ?? 0;
    }
    rgba[j + 3] = 255;
  }
  // Soft mask = alpha channel, when it's a plain gray image of the same size.
  const sm = ctx.lookup(d.get(lib.PDFName.of("SMask")));
  if (sm instanceof lib.PDFRawStream) {
    try {
      const m = await decodeToRgba(lib, sm, ctx);
      if (m.width === width && m.height === height) for (let i = 0; i < width * height; i++) rgba[i * 4 + 3] = m.rgba[i * 4];
    } catch {
      /* keep it opaque */
    }
  }
  return { rgba, width, height, raw };
}

async function rgbaToPng(rgba: Uint8ClampedArray, width: number, height: number): Promise<Blob> {
  const c = makeCanvas(width, height);
  ctx2d(c).putImageData(new ImageData(rgba as unknown as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  return canvasBlob(c, "image/png");
}

type PdfJsImage = { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray; kind?: number };

async function pdfjsImageToPng(img: PdfJsImage): Promise<Blob> {
  const c = makeCanvas(img.width, img.height);
  const ctx = ctx2d(c);
  if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0);
  else if (img.data) {
    const n = img.width * img.height;
    const out = new Uint8ClampedArray(n * 4);
    if (img.kind === 3) out.set(img.data.subarray(0, n * 4));
    else if (img.kind === 2) for (let i = 0; i < n; i++) { out[i * 4] = img.data[i * 3]; out[i * 4 + 1] = img.data[i * 3 + 1]; out[i * 4 + 2] = img.data[i * 3 + 2]; out[i * 4 + 3] = 255; }
    else {
      // 1 bit per pixel, rows padded to bytes; 1 = white.
      const rowLen = (img.width + 7) >> 3;
      for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
        const on = (img.data[y * rowLen + (x >> 3)] >> (7 - (x & 7))) & 1;
        const k = (y * img.width + x) * 4;
        out[k] = out[k + 1] = out[k + 2] = on ? 255 : 0;
        out[k + 3] = 255;
      }
    }
    ctx.putImageData(new ImageData(out as unknown as Uint8ClampedArray<ArrayBuffer>, img.width, img.height), 0, 0);
  } else throw new Error("empty image");
  return canvasBlob(c, "image/png");
}

export async function extractImages(
  data: Uint8Array,
  minSize: number,
  onProgress?: (frac: number, label: string) => void
): Promise<ExtractSummary> {
  const lib = await import("@cantoo/pdf-lib");
  let doc: PdfLib.PDFDocument;
  try {
    doc = await lib.PDFDocument.load(data, { ignoreEncryption: true, password: "", updateMetadata: false } as PdfLib.LoadOptions);
  } catch (e) {
    if (e instanceof Error && /password/i.test(e.message)) {
      throw new Error("This PDF needs a password to open. Remove the password first, then try again.");
    }
    throw new Error("Couldn't read this PDF. It may be damaged or not a real PDF.");
  }
  const ctx = doc.context;
  const pages = doc.getPages();
  const found = new Map<string, Found>();
  const order: string[] = [];

  const walk = (res: PdfLib.PDFDict | undefined, pageNo: number, depth: number, seenForms: Set<string>) => {
    if (!res || depth > 8) return;
    const xo = res.lookup(lib.PDFName.of("XObject"));
    if (!(xo instanceof lib.PDFDict)) return;
    for (const [, val] of xo.entries()) {
      const obj = ctx.lookup(val);
      if (!(obj instanceof lib.PDFRawStream)) continue;
      const key = val instanceof lib.PDFRef ? val.toString() : `inline-${order.length}-${pageNo}`;
      const sub = obj.dict.lookup(lib.PDFName.of("Subtype"));
      if (sub === lib.PDFName.of("Image")) {
        if (obj.dict.lookup(lib.PDFName.of("ImageMask")) === lib.PDFBool.True) continue;
        let f = found.get(key);
        if (!f) {
          f = { key, stream: obj, pages: new Set() };
          found.set(key, f);
          order.push(key);
        }
        f.pages.add(pageNo);
      } else if (sub === lib.PDFName.of("Form") && !seenForms.has(key)) {
        seenForms.add(key);
        walk(obj.dict.lookup(lib.PDFName.of("Resources")) as PdfLib.PDFDict | undefined, pageNo, depth + 1, seenForms);
      }
    }
  };
  pages.forEach((p, i) => walk(p.node.Resources(), i + 1, 0, new Set()));

  const byHash = new Map<string, ExtractedImage>();
  const results: ExtractedImage[] = [];
  const needsRender: { f: Found; w: number; h: number }[] = [];
  let skippedSmall = 0;
  let failed = 0;

  const add = (hash: string, img: Omit<ExtractedImage, "id" | "name">) => {
    const prev = byHash.get(hash);
    if (prev) {
      prev.pages = [...new Set([...prev.pages, ...img.pages])].sort((a, b) => a - b);
      return;
    }
    const e: ExtractedImage = { ...img, id: hash, name: "" };
    byHash.set(hash, e);
    results.push(e);
  };

  for (let i = 0; i < order.length; i++) {
    const f = found.get(order[i])!;
    onProgress?.((i / order.length) * 0.85, `Reading image ${i + 1} of ${order.length}`);
    if (i % 4 === 0) await yieldToUi();
    const d = f.stream.dict;
    const w = num(lib, d.lookup(lib.PDFName.of("Width")));
    const h = num(lib, d.lookup(lib.PDFName.of("Height")));
    if (w < minSize || h < minSize) {
      skippedSmall++;
      continue;
    }
    const pagesArr = [...f.pages].sort((a, b) => a - b);
    const filters = filtersOf(lib, d);
    try {
      const last = filters[filters.length - 1];
      if (last === "/DCTDecode" || last === "/DCT") {
        let bytes = f.stream.contents;
        if (filters.length > 1) {
          // e.g. [/ASCII85Decode /DCTDecode]: undo the outer text encoding to get the JPEG file.
          const d2 = d.clone(ctx);
          d2.set(lib.PDFName.of("Filter"), ctx.obj(filters.slice(0, -1).map((n) => lib.PDFName.of(n.slice(1)))));
          d2.delete(lib.PDFName.of("DecodeParms"));
          bytes = lib.decodePDFRawStream(lib.PDFRawStream.of(d2, bytes)).decode();
        }
        add(await hashBytes(bytes), {
          blob: new Blob([bytes as unknown as BlobPart], { type: "image/jpeg" }),
          ext: "jpg",
          width: w,
          height: h,
          pages: pagesArr,
          method: "original",
          droppedMask: !!d.get(lib.PDFName.of("SMask")),
        });
        continue;
      }
      const { rgba, width, height, raw } = await decodeToRgba(lib, f.stream, ctx);
      const hash = await hashBytes(raw);
      if (byHash.has(hash)) {
        add(hash, { blob: byHash.get(hash)!.blob, ext: "png", width, height, pages: pagesArr, method: "decoded", droppedMask: false });
        continue;
      }
      add(hash, { blob: await rgbaToPng(rgba, width, height), ext: "png", width, height, pages: pagesArr, method: "decoded", droppedMask: false });
    } catch (e) {
      if (e instanceof NeedsRender || (e instanceof Error && /encoding|filter/i.test(e.message))) needsRender.push({ f, w, h });
      else {
        console.error(e);
        needsRender.push({ f, w, h });
      }
    }
  }

  if (needsRender.length) {
    // pdf.js decodes everything we can't; match its images to ours by page and size.
    const { openPdf } = await import("@/lib/pdfjs");
    const pdfjs = await import("pdfjs-dist");
    const pdf = await openPdf(data);
    try {
      const pagesNeeded = [...new Set(needsRender.flatMap((n) => [...n.f.pages]))].sort((a, b) => a - b);
      const pending = new Set(needsRender);
      for (let k = 0; k < pagesNeeded.length && pending.size; k++) {
        const pageNo = pagesNeeded[k];
        onProgress?.(0.85 + (k / pagesNeeded.length) * 0.15, `Decoding special images on page ${pageNo}`);
        const page = await pdf.getPage(pageNo);
        const ops = await page.getOperatorList();
        for (let j = 0; j < ops.fnArray.length; j++) {
          if (ops.fnArray[j] !== pdfjs.OPS.paintImageXObject) continue;
          const [objId, ow, oh] = ops.argsArray[j] as [string, number, number];
          const match = [...pending].find((n) => n.f.pages.has(pageNo) && n.w === ow && n.h === oh);
          if (!match) continue;
          pending.delete(match);
          const store = objId.startsWith("g_") ? page.commonObjs : page.objs;
          try {
            const img = await Promise.race([
              new Promise<PdfJsImage>((resolve) => store.get(objId, resolve as (d: unknown) => void)),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 20000)),
            ]);
            const blob = await pdfjsImageToPng(img);
            const hash = await hashBytes(new Uint8Array(await blob.arrayBuffer()));
            add(hash, { blob, ext: "png", width: img.width, height: img.height, pages: [...match.f.pages].sort((a, b) => a - b), method: "decoded", droppedMask: false });
          } catch {
            failed++;
          }
        }
        page.cleanup();
      }
      failed += pending.size;
    } finally {
      await pdf.destroy();
    }
  }

  results.sort((a, b) => a.pages[0] - b.pages[0]);
  const perPage = new Map<number, number>();
  for (const r of results) {
    const n = (perPage.get(r.pages[0]) ?? 0) + 1;
    perPage.set(r.pages[0], n);
    r.name = `page-${r.pages[0]}-image-${n}.${r.ext}`;
  }
  onProgress?.(1, "Done");
  return { images: results, skippedSmall, failed, pageCount: pages.length };
}
