/**
 * Helpers for drawing on top of existing PDF pages (page numbers, watermarks,
 * images, signatures, text) at the place the user saw on screen.
 *
 * "Display space" is the page as a viewer shows it: the visible box
 * (CropBox ∩ MediaBox) after the page's /Rotate is applied, measured in PDF
 * points, origin at the top-left, y growing downwards. pdf.js renders exactly
 * this, so an overlay positioned in display space lands in the same spot once
 * mapped back to PDF user space with these helpers.
 */
import {
  PDFContentStream,
  PDFDocument,
  PDFPage,
  PDFRef,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFImage,
  type RGB,
} from "pdf-lib";

export type Box = { x: number; y: number; width: number; height: number };

/** Page rotation normalised to 0, 90, 180 or 270. */
export function pageRotation(page: PDFPage): number {
  const r = page.getRotation().angle % 360;
  const n = (Math.round(r / 90) * 90 + 360) % 360;
  return n;
}

/** The visible area of the page in user space: CropBox clipped to MediaBox. */
export function visibleBox(page: PDFPage): Box {
  const m = page.getMediaBox();
  const c = page.getCropBox();
  const x0 = Math.max(Math.min(m.x, m.x + m.width), Math.min(c.x, c.x + c.width));
  const y0 = Math.max(Math.min(m.y, m.y + m.height), Math.min(c.y, c.y + c.height));
  const x1 = Math.min(Math.max(m.x, m.x + m.width), Math.max(c.x, c.x + c.width));
  const y1 = Math.min(Math.max(m.y, m.y + m.height), Math.max(c.y, c.y + c.height));
  if (x1 - x0 < 1 || y1 - y0 < 1) {
    // Broken CropBox: fall back to the MediaBox like most viewers do.
    return { x: Math.min(m.x, m.x + m.width), y: Math.min(m.y, m.y + m.height), width: Math.abs(m.width), height: Math.abs(m.height) };
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Width and height of the page as the reader sees it, in points. */
export function displaySize(page: PDFPage): { width: number; height: number } {
  const b = visibleBox(page);
  const r = pageRotation(page);
  return r === 90 || r === 270 ? { width: b.height, height: b.width } : { width: b.width, height: b.height };
}

/** Map a display-space point (points, top-left origin, y down) to PDF user space. */
export function toPdfPoint(page: PDFPage, dx: number, dy: number): { x: number; y: number } {
  const b = visibleBox(page);
  const x0 = b.x;
  const y0 = b.y;
  const x1 = b.x + b.width;
  const y1 = b.y + b.height;
  switch (pageRotation(page)) {
    case 90:
      return { x: x0 + dy, y: y0 + dx };
    case 180:
      return { x: x1 - dx, y: y0 + dy };
    case 270:
      return { x: x1 - dy, y: y1 - dx };
    default:
      return { x: x0 + dx, y: y1 - dy };
  }
}

/**
 * Where to anchor something pdf-lib draws (text, image, rectangle) so that it
 * appears on screen with its bottom-left corner at the display point
 * (dx, dy), turned `angle` degrees counter-clockwise as the reader sees it.
 */
export function anchorAt(page: PDFPage, dx: number, dy: number, angle = 0) {
  const p = toPdfPoint(page, dx, dy);
  return { x: p.x, y: p.y, rotate: degrees(pageRotation(page) + angle) };
}

/**
 * Anchor for an upright box given by its top-left corner and size in display
 * space (what an on-screen overlay uses).
 */
export function anchorBox(page: PDFPage, left: number, top: number, height: number, angle = 0) {
  return anchorAt(page, left, top + height, angle);
}

/**
 * Anchor for content of size (w, h) centred on the display point (cx, cy) and
 * turned `angle` degrees counter-clockwise around its centre.
 */
export function anchorCentered(page: PDFPage, cx: number, cy: number, w: number, h: number, angle = 0) {
  const t = (angle * Math.PI) / 180;
  // Vector from the bottom-left corner to the centre, in the item's frame (y up).
  const vx = (w / 2) * Math.cos(t) - (h / 2) * Math.sin(t);
  const vyUp = (w / 2) * Math.sin(t) + (h / 2) * Math.cos(t);
  return anchorAt(page, cx - vx, cy + vyUp, angle);
}

const isolated = new WeakSet<PDFPage>();

/**
 * Wrap the page's existing content in q … Q so that whatever graphics state it
 * leaves behind (a stray transform, clipping, colour) can't shift or hide what
 * we draw on top. Safe to call more than once; only the first call wraps.
 * Must run before the first draw call on the page.
 */
export function isolatePage(doc: PDFDocument, page: PDFPage) {
  if (isolated.has(page)) return;
  isolated.add(page);
  page.node.normalize();
  const contents = page.node.Contents();
  if (!contents) return;
  const start = doc.context.register(PDFContentStream.of(doc.context.obj({}), [pushGraphicsState()]));
  const end = doc.context.register(PDFContentStream.of(doc.context.obj({}), [popGraphicsState()]));
  page.node.wrapContentStreams(start, end);
}

/**
 * Move the most recently added content stream (the one pdf-lib draws into) to
 * the start of the page, so it is painted behind the original content.
 */
export function sendDrawingsToBack(page: PDFPage) {
  const contents = page.node.Contents();
  if (!contents || !("size" in contents)) return;
  const arr = contents;
  const n = arr.size();
  if (n < 2) return;
  const last = arr.get(n - 1);
  if (!(last instanceof PDFRef)) return;
  arr.remove(n - 1);
  arr.insert(0, last);
}

/** "#rrggbb" → pdf-lib RGB. */
export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** True when every character can be drawn with this (standard, WinAnsi) font. */
export function fontCanDraw(font: PDFFont, text: string): boolean {
  try {
    font.encodeText(text);
    font.widthOfTextAtSize(text, 10);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load a PDF for editing with pdf-lib. Files that carry only a permissions
 * (owner) password, common for bank statements and payslips, open without a
 * password in every reader, but pdf-lib can't decrypt them and would write
 * unreadable pages. @cantoo/pdf-lib decrypts those first (the saved result
 * is unencrypted). Files that need a password to open get a friendly error.
 */
export async function loadEditable(bytes: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    throw new Error("Couldn't read this PDF. It may be damaged or not a real PDF.");
  }
  if (!doc.isEncrypted) return doc;
  let plain: Uint8Array;
  try {
    const { PDFDocument: Fork } = await import("@cantoo/pdf-lib");
    const dec = await Fork.load(bytes, { ignoreEncryption: true, password: "", updateMetadata: false });
    plain = await dec.save({ useObjectStreams: false });
  } catch (e) {
    if (e instanceof Error && /password/i.test(e.message)) {
      throw new Error("This PDF needs a password to open. Open it with the password, save an unprotected copy, then try again.");
    }
    throw new Error("Couldn't decrypt this PDF. Save an unprotected copy from your PDF reader, then try again.");
  }
  try {
    // The fork writes decrypted objects but keeps a stale /Encrypt entry in
    // the trailer; the content really is plain now, so drop that entry.
    doc = await PDFDocument.load(plain, { ignoreEncryption: true, updateMetadata: false });
    const enc = doc.context.trailerInfo.Encrypt;
    doc.context.trailerInfo.Encrypt = undefined;
    if (enc instanceof PDFRef) doc.context.delete(enc);
  } catch {
    throw new Error("Couldn't read this PDF after unlocking it. Save an unprotected copy from your PDF reader first.");
  }
  return doc;
}

// ---------------------------------------------------------------- images

export type LoadedImage = {
  bytes: Uint8Array;
  kind: "png" | "jpg";
  width: number;
  height: number;
  /** Object URL for on-screen previews. */
  url: string;
  name: string;
};

function jpegOrientation(bytes: Uint8Array): number {
  // Minimal EXIF reader: find APP1 "Exif", then tag 0x0112.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
  let i = 2;
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) return 1;
    const marker = bytes[i + 1];
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1 && bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78 && bytes[i + 6] === 0x69 && bytes[i + 7] === 0x66) {
      const t = i + 10; // TIFF header
      const le = bytes[t] === 0x49;
      const u16 = (o: number) => (le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
      const u32 = (o: number) =>
        le
          ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
          : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
      const ifd = t + u32(t + 4);
      const count = u16(ifd);
      for (let k = 0; k < count; k++) {
        const e = ifd + 2 + k * 12;
        if (e + 10 > bytes.length) break;
        if (u16(e) === 0x0112) return u16(e + 8) || 1;
      }
      return 1;
    }
    if (marker === 0xda) return 1;
    i += 2 + len;
  }
  return 1;
}

async function decodeToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Couldn't read this image. Use a PNG, JPG or WebP file.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser blocked the canvas this tool needs.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

export function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(async (b) => {
      if (!b) return reject(new Error("Couldn't encode the image."));
      resolve(new Uint8Array(await b.arrayBuffer()));
    }, "image/png")
  );
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      async (b) => {
        if (!b) return reject(new Error("Couldn't encode the image."));
        resolve(new Uint8Array(await b.arrayBuffer()));
      },
      "image/jpeg",
      quality
    )
  );
}

/**
 * Read an image file into bytes pdf-lib can embed. PNG and upright JPG are
 * kept byte-for-byte; rotated phone JPGs are turned upright; WebP, GIF, BMP
 * and anything else the browser can decode becomes PNG (transparency kept).
 */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (/\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type)) {
    throw new Error("HEIC photos aren't supported here. Convert them with HEIC to JPG first.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const canvas = await decodeToCanvas(new Blob([bytes as unknown as BlobPart], { type: file.type || "image/*" }));
  let out: Uint8Array = bytes;
  let kind: "png" | "jpg" = isJpg ? "jpg" : "png";
  if (isJpg && jpegOrientation(bytes) !== 1) {
    out = await canvasToJpegBytes(canvas);
  } else if (!isPng && !isJpg) {
    out = await canvasToPngBytes(canvas);
    kind = "png";
  }
  const url = URL.createObjectURL(new Blob([out as unknown as BlobPart], { type: kind === "png" ? "image/png" : "image/jpeg" }));
  return { bytes: out, kind, width: canvas.width, height: canvas.height, url, name: file.name };
}

/** Embed a loaded image once per document. */
export async function embedLoaded(doc: PDFDocument, img: { bytes: Uint8Array; kind: "png" | "jpg" }): Promise<PDFImage> {
  try {
    return img.kind === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
  } catch {
    // Unusual encodings (CMYK PNG, 16-bit, arithmetic JPEG): re-encode via canvas.
    const canvas = await decodeToCanvas(new Blob([img.bytes as unknown as BlobPart]));
    return doc.embedPng(await canvasToPngBytes(canvas));
  }
}

/**
 * Rasterise a line of text (for scripts the standard PDF fonts can't encode,
 * such as Devanagari or CJK). Returns PNG bytes plus the size in CSS px at
 * `pxSize`, rendered at `scale`× for print sharpness.
 */
export async function textToPng(
  text: string,
  family: string,
  pxSize: number,
  color: string,
  scale = 4,
  weight: number | string = 400
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const font = `${weight} ${pxSize}px ${family}`;
  const lines = text.split("\n");
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Your browser blocked the canvas this tool needs.");
  measure.font = font;
  const width = Math.max(1, ...lines.map((l) => measure.measureText(l).width));
  const lineH = pxSize * 1.2;
  const height = lineH * lines.length;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser blocked the canvas this tool needs.");
  ctx.scale(scale, scale);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  lines.forEach((l, i) => ctx.fillText(l, 0, i * lineH + pxSize * 0.95));
  return { bytes: await canvasToPngBytes(canvas), width, height };
}

/** Yield to the browser so progress bars repaint between pages. */
export const tick = () => new Promise<void>((r) => setTimeout(r));
