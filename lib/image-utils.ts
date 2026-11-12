/**
 * Browser-side image helpers shared by the image tools (compress, resize,
 * HEIC, JPG to PDF, edit text in image). Everything here runs on the user's
 * device with canvas and createImageBitmap; nothing is uploaded.
 */

export type OutputType = "image/jpeg" | "image/png" | "image/webp";

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export const HEIC_ACCEPT = "image/heic,image/heif,.heic,.heif";

export function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** True for files a browser can normally decode itself (JPG, PNG, WebP, GIF, BMP, AVIF). */
export function isBrowserImage(file: File): boolean {
  return (
    /^image\/(jpeg|png|webp|gif|bmp|avif)$/i.test(file.type) ||
    /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name)
  );
}

export function extFor(type: OutputType): string {
  return type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
}

export function labelFor(type: string): string {
  if (/jpe?g/i.test(type)) return "JPG";
  if (/png/i.test(type)) return "PNG";
  if (/webp/i.test(type)) return "WebP";
  if (/hei[cf]/i.test(type)) return "HEIC";
  return type.replace(/^image\//, "").toUpperCase() || "image";
}

/** Best guess at a file's real type, from its bytes first, then name and MIME. */
export async function sniffType(file: Blob & { name?: string }): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png";
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && head[8] === 0x57 && head[9] === 0x45)
    return "image/webp";
  const brand = String.fromCharCode(...head.slice(4, 12));
  if (/^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1)/.test(brand)) return "image/heic";
  if (/^ftypavi/.test(brand)) return "image/avif";
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return "image/gif";
  if (file.type) return file.type;
  const n = file.name ?? "";
  if (/\.jpe?g$/i.test(n)) return "image/jpeg";
  if (/\.png$/i.test(n)) return "image/png";
  if (/\.webp$/i.test(n)) return "image/webp";
  if (/\.hei[cf]$/i.test(n)) return "image/heic";
  return "";
}

/**
 * Decode an image with its EXIF rotation applied, so a portrait phone photo
 * comes out portrait. Falls back to an <img> element on browsers without
 * createImageBitmap options.
 */
export async function decodeImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Older Safari rejects the options bag; try the plain call, then <img>.
      try {
        return await createImageBitmap(file);
      } catch {
        /* fall through */
      }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error("This browser couldn't read that image. Try a JPG, PNG or WebP file.");
  } finally {
    // The decoded pixels stay usable after the URL is released.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function sourceSize(src: ImageBitmap | HTMLImageElement | HTMLCanvasElement): { width: number; height: number } {
  if (src instanceof HTMLImageElement) return { width: src.naturalWidth, height: src.naturalHeight };
  return { width: src.width, height: src.height };
}

export function releaseSource(src: ImageBitmap | HTMLImageElement | HTMLCanvasElement) {
  if (typeof ImageBitmap !== "undefined" && src instanceof ImageBitmap) src.close();
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

export function ctx2d(canvas: HTMLCanvasElement, willRead = false): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", willRead ? { willReadFrequently: true } : undefined);
  if (!ctx) throw new Error("Your browser blocked the canvas this tool needs. Try another browser.");
  return ctx;
}

/** The largest canvas side most browsers (including iOS Safari) accept safely. */
export const MAX_CANVAS_SIDE = 8192;
/** iOS Safari refuses canvases above ~16.7 megapixels. */
export const MAX_CANVAS_PIXELS = 16_000_000;

/** Scale factor that keeps a canvas within browser limits. */
export function safeScale(width: number, height: number): number {
  return Math.min(1, MAX_CANVAS_SIDE / width, MAX_CANVAS_SIDE / height, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)));
}

/**
 * Draw `src` into a new canvas of the given size with good downscaling:
 * halve repeatedly while the image is more than twice the target, then do
 * the final step with high-quality smoothing. This avoids the jagged,
 * shimmering result of one big drawImage step.
 */
export function resizeToCanvas(
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  outW: number,
  outH: number,
  background?: string
): HTMLCanvasElement {
  let cur: CanvasImageSource = src;
  let cw = srcW;
  let ch = srcH;
  while (cw / 2 >= outW && ch / 2 >= outH && cw > 2 && ch > 2) {
    const nw = Math.round(cw / 2);
    const nh = Math.round(ch / 2);
    const step = makeCanvas(nw, nh);
    const sctx = ctx2d(step);
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
    cur = step;
    cw = nw;
    ch = nh;
  }
  const out = makeCanvas(outW, outH);
  const octx = ctx2d(out);
  if (background) {
    octx.fillStyle = background;
    octx.fillRect(0, 0, out.width, out.height);
  }
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(cur, 0, 0, cw, ch, 0, 0, out.width, out.height);
  return out;
}

export function canvasBlob(canvas: HTMLCanvasElement, type: OutputType, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("The browser couldn't encode the image. It may be too large for this device."))),
      type,
      quality
    )
  );
}

/** Does the browser actually encode WebP? (Old Safari silently returns PNG.) */
let webpSupport: boolean | null = null;
export function canEncodeWebp(): boolean {
  if (webpSupport === null) {
    try {
      webpSupport = makeCanvas(1, 1).toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport;
}

/** True if any pixel is not fully opaque. */
export function canvasHasAlpha(canvas: HTMLCanvasElement): boolean {
  const ctx = ctx2d(canvas, true);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

/** Paint a canvas onto a solid background (for JPG output of a transparent image). */
export function flattenCanvas(canvas: HTMLCanvasElement, background = "#ffffff"): HTMLCanvasElement {
  const out = makeCanvas(canvas.width, canvas.height);
  const ctx = ctx2d(out);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

/** Draw a decoded source into a same-size canvas. */
export function sourceToCanvas(src: ImageBitmap | HTMLImageElement, maxScale = 1): HTMLCanvasElement {
  const { width, height } = sourceSize(src);
  const s = Math.min(maxScale, safeScale(width, height));
  if (s < 1) return resizeToCanvas(src, width, height, Math.round(width * s), Math.round(height * s));
  const c = makeCanvas(width, height);
  ctx2d(c).drawImage(src, 0, 0);
  return c;
}

/**
 * Read the EXIF orientation tag (1–8) from JPEG bytes. Returns 1 when there
 * is no tag. Only the first 128 KB are scanned; EXIF lives in APP1 near the start.
 */
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let off = 2;
  const end = Math.min(view.byteLength, 131072);
  while (off + 4 < end) {
    const marker = view.getUint16(off);
    if ((marker & 0xff00) !== 0xff00) return 1;
    const len = view.getUint16(off + 2);
    if (marker === 0xffe1 && off + 10 < end && view.getUint32(off + 4) === 0x45786966) {
      const tiff = off + 10;
      if (tiff + 8 > view.byteLength) return 1;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      if (ifd + 2 > view.byteLength) return 1;
      const count = view.getUint16(ifd, little);
      for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > view.byteLength) return 1;
        if (view.getUint16(entry, little) === 0x0112) {
          const v = view.getUint16(entry + 8, little);
          return v >= 1 && v <= 8 ? v : 1;
        }
      }
      return 1;
    }
    if (marker === 0xffda) return 1; // start of scan: no EXIF before the image data
    off += 2 + len;
  }
  return 1;
}

/** Read width/height from a JPEG's SOF marker without decoding it. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let off = 2;
  while (off + 9 < view.byteLength) {
    const marker = view.getUint16(off);
    if ((marker & 0xff00) !== 0xff00) return null;
    if (marker >= 0xffc0 && marker <= 0xffcf && marker !== 0xffc4 && marker !== 0xffc8 && marker !== 0xffcc) {
      return { height: view.getUint16(off + 5), width: view.getUint16(off + 7) };
    }
    off += 2 + view.getUint16(off + 2);
  }
  return null;
}

/**
 * Turn an iPhone HEIC/HEIF photo into something the browser can draw.
 * Safari decodes HEIC natively; everywhere else we load heic2any (about
 * 1.3 MB, fetched only when the first HEIC file is converted).
 */
export async function decodeHeic(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await decodeImage(file);
  } catch {
    /* not natively supported: use the bundled decoder */
  }
  const { heicToJpegBlob } = await import("@/lib/heic");
  const jpeg = await heicToJpegBlob(file, 0.95);
  return decodeImage(jpeg);
}

/** Does this browser decode HEIC itself (Safari 17+)? Cached after the first check. */
export async function nativeHeicDecode(file: Blob): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

/** Stable short hash for de-duplicating byte arrays. */
export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));
