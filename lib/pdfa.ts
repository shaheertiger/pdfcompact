/**
 * Image-based PDF/A-2b builder.
 *
 * Every page is rendered with pdf.js and stored as one JPEG in a new file
 * that has exactly what PDF/A-2b asks for and nothing it forbids:
 * an sRGB OutputIntent (ICC profile built below), XMP metadata with
 * pdfaid:part=2 / conformance=B that matches the Info dictionary, a file ID
 * in the trailer, no fonts, no transparency, no JavaScript, no encryption,
 * no annotations and no external content.
 */
import type { PdfDoc } from "@/lib/pdfjs";

/* ------------------------------------------------------------------ */
/* Minimal sRGB ICC profile (version 2.1, display class)               */
/* ------------------------------------------------------------------ */

/**
 * Builds a ~2.6 KB ICC v2 profile for sRGB IEC 61966-2.1: D50 white point,
 * Bradford-adapted sRGB primaries and the exact sRGB tone curve sampled at
 * 1024 points. Written from the published constants, no third-party bytes.
 */
export function buildSrgbIcc(): Uint8Array {
  const enc = new TextEncoder();
  const s15 = (v: number) => Math.round(v * 65536) | 0;

  const tag = (parts: (Uint8Array | number[])[]) => {
    const len = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  };
  const u32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const sig = (s: string) => Array.from(enc.encode(s));
  const xyz = (x: number, y: number, z: number) => tag([sig("XYZ "), u32(0), u32(s15(x)), u32(s15(y)), u32(s15(z))]);

  // textDescriptionType (v2 'desc')
  const descText = "sRGB IEC61966-2.1";
  const ascii = enc.encode(descText + "\0");
  const desc = tag([
    sig("desc"),
    u32(0),
    u32(ascii.length),
    ascii,
    u32(0), // unicode language code
    u32(0), // unicode count
    [0, 0], // scriptcode code
    [0], // scriptcode count
    new Array(67).fill(0),
  ]);
  const cprt = tag([sig("text"), u32(0), enc.encode("No copyright, use freely\0")]);
  const wtpt = xyz(0.9642, 1.0, 0.8249);
  const rXYZ = xyz(0.4361, 0.2225, 0.0139);
  const gXYZ = xyz(0.3851, 0.7169, 0.0971);
  const bXYZ = xyz(0.1431, 0.0606, 0.7141);
  const N = 1024;
  const curve: number[] = [];
  for (let i = 0; i < N; i++) {
    const v = i / (N - 1);
    const lin = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    const q = Math.round(lin * 65535);
    curve.push((q >> 8) & 255, q & 255);
  }
  const trc = tag([sig("curv"), u32(0), u32(N), curve]);

  const tags: [string, Uint8Array][] = [
    ["desc", desc],
    ["cprt", cprt],
    ["wtpt", wtpt],
    ["rXYZ", rXYZ],
    ["gXYZ", gXYZ],
    ["bXYZ", bXYZ],
    ["rTRC", trc],
  ];
  // gTRC and bTRC share the rTRC data.
  const tableLen = 4 + (tags.length + 2) * 12;
  let offset = 128 + tableLen;
  const pad4 = (n: number) => (n + 3) & ~3;
  const placed: { sig: string; off: number; data: Uint8Array }[] = [];
  for (const [s, d] of tags) {
    offset = pad4(offset);
    placed.push({ sig: s, off: offset, data: d });
    offset += d.length;
  }
  const total = pad4(offset);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  // Header
  dv.setUint32(0, total);
  out.set(enc.encode("none"), 4); // preferred CMM: none registered
  dv.setUint32(8, 0x02100000); // version 2.1
  out.set(enc.encode("mntr"), 12);
  out.set(enc.encode("RGB "), 16);
  out.set(enc.encode("XYZ "), 20);
  // Date: 2026-11-12 00:00:00
  [2026, 11, 12, 0, 0, 0].forEach((v, i) => dv.setUint16(24 + i * 2, v));
  out.set(enc.encode("acsp"), 36);
  dv.setUint32(64, 0); // rendering intent: perceptual
  dv.setInt32(68, s15(0.9642));
  dv.setInt32(72, s15(1.0));
  dv.setInt32(76, s15(0.8249));
  // Tag table
  let t = 128;
  dv.setUint32(t, tags.length + 2);
  t += 4;
  const entry = (s: string, off: number, size: number) => {
    out.set(enc.encode(s), t);
    dv.setUint32(t + 4, off);
    dv.setUint32(t + 8, size);
    t += 12;
  };
  for (const p of placed) entry(p.sig, p.off, p.data.length);
  const trcPlaced = placed.find((p) => p.sig === "rTRC")!;
  entry("gTRC", trcPlaced.off, trcPlaced.data.length);
  entry("bTRC", trcPlaced.off, trcPlaced.data.length);
  for (const p of placed) out.set(p.data, p.off);
  return out;
}

/* ------------------------------------------------------------------ */
/* XMP                                                                 */
/* ------------------------------------------------------------------ */

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** XML 1.0 forbids most control characters; strip them so the packet stays valid. */
const xmlSafe = (s: string) => xmlEscape(s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, ""));

function isoDate(d: Date) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function buildXmp(meta: {
  title: string;
  producer: string;
  creatorTool: string;
  date: Date;
  documentId: string;
}) {
  const date = isoDate(meta.date);
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
    xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/">
   <pdfaid:part>2</pdfaid:part>
   <pdfaid:conformance>B</pdfaid:conformance>
   <dc:format>application/pdf</dc:format>
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlSafe(meta.title)}</rdf:li></rdf:Alt></dc:title>
   <xmp:CreateDate>${date}</xmp:CreateDate>
   <xmp:ModifyDate>${date}</xmp:ModifyDate>
   <xmp:MetadataDate>${date}</xmp:MetadataDate>
   <xmp:CreatorTool>${xmlSafe(meta.creatorTool)}</xmp:CreatorTool>
   <pdf:Producer>${xmlSafe(meta.producer)}</pdf:Producer>
   <xmpMM:DocumentID>uuid:${meta.documentId}</xmpMM:DocumentID>
   <xmpMM:InstanceID>uuid:${meta.documentId}</xmpMM:InstanceID>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/* ------------------------------------------------------------------ */
/* Conversion                                                          */
/* ------------------------------------------------------------------ */

export type PdfaOptions = { dpi: number; quality: number; title: string };

/** iOS Safari refuses canvases above about 16.7 million pixels. */
const MAX_PIXELS = 16_000_000;

function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function convertToPdfa(
  pdf: PdfDoc,
  opts: PdfaOptions,
  onProgress?: (done: number, total: number) => Promise<void> | void,
): Promise<{ bytes: Uint8Array; reducedPages: number[] }> {
  const { PDFDocument, PDFName, PDFHexString, PDFString } = await import("pdf-lib");
  const out = await PDFDocument.create({ updateMetadata: false });
  const reducedPages: number[] = [];

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    let scale = opts.dpi / 72;
    const px = vp1.width * vp1.height * scale * scale;
    if (px > MAX_PIXELS) {
      scale *= Math.sqrt(MAX_PIXELS / px);
      reducedPages.push(n);
    }
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(vp.width));
    canvas.height = Math.max(1, Math.round(vp.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser blocked the canvas this tool needs.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Render without form fields or annotation appearances being interactive; print intent shows what prints.
    await page.render({ canvas, canvasContext: ctx, viewport: vp, intent: "print" }).promise;
    page.cleanup();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Couldn't encode a page image."))),
        "image/jpeg",
        opts.quality,
      ),
    );
    canvas.width = 0;
    canvas.height = 0;
    const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const p = out.addPage([vp1.width, vp1.height]);
    p.drawImage(jpg, { x: 0, y: 0, width: vp1.width, height: vp1.height });
    if (onProgress) await onProgress(n, pdf.numPages);
  }

  // Document information, mirrored exactly in XMP.
  const now = new Date();
  now.setMilliseconds(0);
  const title = opts.title.trim() || "Untitled";
  const producer = "pdfcompact.com PDF to PDF/A (pdf-lib)";
  const creatorTool = "pdfcompact.com PDF to PDF/A";
  out.setTitle(title);
  out.setProducer(producer);
  out.setCreator(creatorTool);
  out.setCreationDate(now);
  out.setModificationDate(now);

  const id = uuid();
  const xmp = buildXmp({ title, producer, creatorTool, date: now, documentId: id });
  const ctx = out.context;
  const metadata = ctx.stream(new TextEncoder().encode(xmp), { Type: "Metadata", Subtype: "XML" });
  out.catalog.set(PDFName.of("Metadata"), ctx.register(metadata));

  const icc = buildSrgbIcc();
  const iccStream = ctx.flateStream(icc, { N: 3 });
  const intent = ctx.obj({
    Type: "OutputIntent",
    S: "GTS_PDFA1",
    OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
    RegistryName: PDFString.of("http://www.color.org"),
    DestOutputProfile: ctx.register(iccStream),
  });
  out.catalog.set(PDFName.of("OutputIntents"), ctx.obj([ctx.register(intent)]));

  const idHex = id.replace(/-/g, "").toUpperCase();
  ctx.trailerInfo.ID = ctx.obj([PDFHexString.of(idHex), PDFHexString.of(idHex)]);

  // Classic cross-reference table, no object streams: the most widely accepted layout.
  const bytes = await out.save({ useObjectStreams: false });
  return { bytes, reducedPages };
}
