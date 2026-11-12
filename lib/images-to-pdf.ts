/**
 * Shared image → PDF engine (JPG to PDF, HEIC to PDF, Scan to PDF…).
 *
 * The rule that keeps files small: JPEGs are embedded byte-for-byte with
 * embedJpg (no re-encoding, no PNG bloat), PNGs with embedPng, and anything
 * else (WebP, GIF, AVIF, decoded HEIC) is drawn to a canvas and saved as JPEG,
 * or PNG when it has transparency. EXIF rotation is honoured: for an original
 * JPEG we rotate the drawing on the page instead of touching the pixels.
 */
import { PDFDocument, degrees, type PDFImage } from "pdf-lib";
import {
  canvasBlob,
  canvasHasAlpha,
  decodeHeic,
  decodeImage,
  flattenCanvas,
  jpegOrientation,
  jpegSize,
  nativeHeicDecode,
  releaseSource,
  resizeToCanvas,
  sniffType,
  sourceSize,
  yieldToUi,
} from "@/lib/image-utils";

export type PageSize = "fit" | "a4" | "letter";
export type PageOrientation = "auto" | "portrait" | "landscape";
export type PageMargin = "none" | "small" | "large";
/** original: never re-compress JPEG/PNG. balanced/small: re-encode as JPEG with a size cap. */
export type ImageQuality = "original" | "balanced" | "small";

export type PdfPageOptions = {
  pageSize: PageSize;
  orientation: PageOrientation;
  margin: PageMargin;
  quality: ImageQuality;
};

export const defaultPdfPageOptions: PdfPageOptions = {
  pageSize: "a4",
  orientation: "auto",
  margin: "small",
  quality: "original",
};

export type PdfImageInput = {
  file: Blob;
  /** Extra clockwise rotation chosen by the user. */
  rotation?: 0 | 90 | 180 | 270;
};

const MM = 72 / 25.4;
const SIZES: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};
export const MARGINS: Record<PageMargin, number> = { none: 0, small: 10 * MM, large: 20 * MM };
const QUALITY: Record<Exclude<ImageQuality, "original">, { maxSide: number; q: number }> = {
  // 2480 px is an A4 page at 300 dpi: sharp in print, much smaller than a 12 MP photo.
  balanced: { maxSide: 2480, q: 0.82 },
  small: { maxSide: 1600, q: 0.7 },
};
/** "Fit to image" pages: 1 image pixel = 0.75 pt (96 dpi), capped at PDF's 200-inch page limit. */
const FIT_PT_PER_PX = 0.75;
const MAX_PAGE_PT = 14400;

type Prepared = {
  kind: "jpg" | "png";
  bytes: Uint8Array;
  /** Pixel size of the stored image (before any page rotation). */
  width: number;
  height: number;
  /** Clockwise rotation to apply when drawing (EXIF + user). */
  rotate: 0 | 90 | 180 | 270;
};

const EXIF_ROTATION: Record<number, 0 | 90 | 180 | 270> = { 1: 0, 3: 180, 6: 90, 8: 270 };

async function blobBytes(b: Blob): Promise<Uint8Array> {
  return new Uint8Array(await b.arrayBuffer());
}

function addRot(a: number, b: number): 0 | 90 | 180 | 270 {
  return ((((a + b) % 360) + 360) % 360) as 0 | 90 | 180 | 270;
}

/** Decode, optionally downscale, and encode to JPEG (or PNG if transparent). */
async function reencode(
  file: Blob,
  maxSide: number,
  jpegQuality: number,
  keepAlpha: boolean
): Promise<{ kind: "jpg" | "png"; bytes: Uint8Array; width: number; height: number }> {
  const type = await sniffType(file as Blob & { name?: string });
  const src = type === "image/heic" ? await decodeHeic(file) : await decodeImage(file);
  try {
    const { width, height } = sourceSize(src);
    const s = Math.min(1, maxSide / Math.max(width, height));
    const w = Math.max(1, Math.round(width * s));
    const h = Math.max(1, Math.round(height * s));
    const canvas = resizeToCanvas(src, width, height, w, h);
    if (keepAlpha && canvasHasAlpha(canvas)) {
      return { kind: "png", bytes: await blobBytes(await canvasBlob(canvas, "image/png")), width: w, height: h };
    }
    const flat = flattenCanvas(canvas);
    return { kind: "jpg", bytes: await blobBytes(await canvasBlob(flat, "image/jpeg", jpegQuality)), width: w, height: h };
  } finally {
    releaseSource(src);
  }
}

async function prepare(input: PdfImageInput, quality: ImageQuality): Promise<Prepared> {
  const userRot = input.rotation ?? 0;
  let type = await sniffType(input.file as Blob & { name?: string });
  if (type === "image/heic") {
    // Safari decodes HEIC itself (handled by reencode below). Elsewhere convert
    // once to JPEG with the bundled decoder and treat it as a JPEG from here on.
    const native = await nativeHeicDecode(input.file);
    if (native) native.close();
    else {
      const { heicToJpegBlob } = await import("@/lib/heic");
      input = { ...input, file: await heicToJpegBlob(input.file, quality === "original" ? 0.92 : 0.95) };
      type = "image/jpeg";
    }
  }

  if (quality === "original") {
    if (type === "image/jpeg") {
      const bytes = await blobBytes(input.file);
      const orientation = jpegOrientation(bytes);
      const size = jpegSize(bytes);
      if (size && EXIF_ROTATION[orientation] !== undefined) {
        // Embed the original bytes and rotate the drawing: no quality loss.
        return { kind: "jpg", bytes, width: size.width, height: size.height, rotate: addRot(EXIF_ROTATION[orientation], userRot) };
      }
      // Mirrored orientations (2, 4, 5, 7) are rare; re-encode those at high quality.
      const r = await reencode(input.file, Infinity, 0.92, false);
      return { ...r, rotate: userRot };
    }
    if (type === "image/png") {
      const bytes = await blobBytes(input.file);
      // PNG has no EXIF rotation in practice; pdf-lib reads the size itself.
      return { kind: "png", bytes, width: 0, height: 0, rotate: userRot };
    }
    const r = await reencode(input.file, Infinity, 0.92, true);
    return { ...r, rotate: userRot };
  }

  const { maxSide, q } = QUALITY[quality];
  const r = await reencode(input.file, maxSide, q, false);
  // Never make a JPEG bigger than it was: keep the original when it's already smaller.
  if (type === "image/jpeg" && input.file.size <= r.bytes.length) {
    const bytes = await blobBytes(input.file);
    const size = jpegSize(bytes);
    const orientation = jpegOrientation(bytes);
    if (size && EXIF_ROTATION[orientation] !== undefined) {
      return { kind: "jpg", bytes, width: size.width, height: size.height, rotate: addRot(EXIF_ROTATION[orientation], userRot) };
    }
  }
  return { ...r, rotate: userRot };
}

/** Page size in points for an image whose displayed size is dispW × dispH pixels. */
export function pageFor(dispW: number, dispH: number, opts: PdfPageOptions): [number, number] {
  const m = MARGINS[opts.margin];
  if (opts.pageSize === "fit") {
    let w = dispW * FIT_PT_PER_PX;
    let h = dispH * FIT_PT_PER_PX;
    const s = Math.min(1, (MAX_PAGE_PT - 2 * m) / w, (MAX_PAGE_PT - 2 * m) / h);
    w *= s;
    h *= s;
    return [w + 2 * m, h + 2 * m];
  }
  const [a, b] = SIZES[opts.pageSize];
  const landscape =
    opts.orientation === "landscape" || (opts.orientation === "auto" && dispW > dispH);
  return landscape ? [b, a] : [a, b];
}

export type ImagesToPdfResult = { bytes: Uint8Array; pageCount: number };

export async function imagesToPdf(
  inputs: PdfImageInput[],
  opts: PdfPageOptions,
  onProgress?: (done: number, total: number) => void
): Promise<ImagesToPdfResult> {
  if (inputs.length === 0) throw new Error("Add at least one image.");
  const doc = await PDFDocument.create();
  doc.setProducer("pdfcompact.com");
  doc.setCreator("pdfcompact.com");
  const m = MARGINS[opts.margin];

  for (let i = 0; i < inputs.length; i++) {
    onProgress?.(i, inputs.length);
    await yieldToUi();
    let prepared: Prepared;
    try {
      prepared = await prepare(inputs[i], opts.quality);
    } catch (e) {
      const name = (inputs[i].file as File).name ?? `image ${i + 1}`;
      throw new Error(`Couldn't read ${name}. ${e instanceof Error ? e.message : ""}`.trim());
    }
    let image: PDFImage;
    try {
      image = prepared.kind === "jpg" ? await doc.embedJpg(prepared.bytes) : await doc.embedPng(prepared.bytes);
    } catch {
      // Unusual JPEG/PNG variants pdf-lib can't parse (e.g. 16-bit PNG, CMYK): re-encode once.
      const r = await reencode(inputs[i].file, Infinity, 0.92, true);
      prepared = { ...r, rotate: prepared.rotate };
      image = r.kind === "jpg" ? await doc.embedJpg(r.bytes) : await doc.embedPng(r.bytes);
    }
    const iw = image.width;
    const ih = image.height;
    const sideways = prepared.rotate === 90 || prepared.rotate === 270;
    const dispW = sideways ? ih : iw;
    const dispH = sideways ? iw : ih;

    const [pw, ph] = pageFor(dispW, dispH, opts);
    const boxW = pw - 2 * m;
    const boxH = ph - 2 * m;
    const scale = Math.min(boxW / dispW, boxH / dispH);
    const BW = dispW * scale;
    const BH = dispH * scale;
    const bx = m + (boxW - BW) / 2;
    const by = m + (boxH - BH) / 2;

    const page = doc.addPage([pw, ph]);
    // pdf-lib rotates counter-clockwise around (x, y); position so the rotated
    // image lands exactly in the box (bx, by, BW, BH).
    switch (prepared.rotate) {
      case 0:
        page.drawImage(image, { x: bx, y: by, width: BW, height: BH });
        break;
      case 90:
        page.drawImage(image, { x: bx, y: by + BH, width: BH, height: BW, rotate: degrees(-90) });
        break;
      case 180:
        page.drawImage(image, { x: bx + BW, y: by + BH, width: BW, height: BH, rotate: degrees(180) });
        break;
      case 270:
        page.drawImage(image, { x: bx + BW, y: by, width: BH, height: BW, rotate: degrees(90) });
        break;
    }
  }
  onProgress?.(inputs.length, inputs.length);
  const bytes = await doc.save();
  return { bytes, pageCount: inputs.length };
}
