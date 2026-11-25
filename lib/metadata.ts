/**
 * Read and remove PDF metadata.
 *
 * What gets removed:
 *  - the document Info dictionary (Title, Author, Subject, Keywords, Creator,
 *    Producer, CreationDate, ModDate, Trapped and any custom keys);
 *  - the XMP metadata stream on the catalog, plus XMP streams attached to
 *    pages, images and fonts;
 *  - PieceInfo (private application data, e.g. Illustrator or Acrobat edit history);
 *  - optionally, comment author names (/T) and comment dates (/M, /CreationDate);
 *  - the old file ID, replaced by a random one.
 * The file is rewritten from scratch and unreferenced objects are dropped, so
 * the old values don't survive as orphans or in earlier incremental saves.
 */
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
  decodePDFRawStream,
  type PDFObject,
} from "@cantoo/pdf-lib";
import { collectGarbage } from "./compress";

const N = (s: string) => PDFName.of(s);

export class MetadataError extends Error {
  constructor(public code: "encrypted" | "unreadable") {
    super(code);
  }
}

export type Field = { key: string; value: string };

export type MetadataReport = {
  info: Field[];
  xmp: Field[];
  /** XMP packet size in bytes (catalog stream), 0 if none. */
  xmpBytes: number;
  /** XMP streams on pages, images, fonts. */
  objectXmp: number;
  pieceInfo: number;
  /** Comments (markup annotations) that carry an author name. */
  commentAuthors: number;
  authorNames: string[];
  commentDates: number;
  attachments: number;
  pages: number;
};

export async function loadForMetadata(bytes: Uint8Array): Promise<PDFDocument> {
  let doc: PDFDocument;
  try {
    // Permissions-only (owner password) files are decrypted on load; open-password files throw.
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, password: "", updateMetadata: false });
  } catch (e) {
    if (e instanceof Error && /encrypt|password/i.test(e.name + e.message)) throw new MetadataError("encrypted");
    throw new MetadataError("unreadable");
  }
  if (doc.isEncrypted || doc.context.trailerInfo.Encrypt) throw new MetadataError("encrypted");
  return doc;
}

function text(o: PDFObject | undefined): string {
  if (o instanceof PDFString || o instanceof PDFHexString) {
    try {
      return o.decodeText();
    } catch {
      return o.asString();
    }
  }
  if (o instanceof PDFName) return o.decodeText();
  if (o === undefined) return "";
  return o.toString();
}

/** "D:20240102030405+01'00'" → "2024-01-02 03:04:05 +01:00" */
function prettyDate(v: string): string {
  const m = v.match(/^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz+-])?(\d{2})?'?(\d{2})?/);
  if (!m) return v;
  const [, y, mo = "01", d = "01", h = "00", mi = "00", s = "00", z, zh, zm] = m;
  const tz = !z ? "" : z.toUpperCase() === "Z" ? " UTC" : ` ${z}${zh ?? "00"}:${zm ?? "00"}`;
  return `${y}-${mo}-${d} ${h}:${mi}:${s}${tz}`;
}

function infoDict(doc: PDFDocument): PDFDict | undefined {
  const info = doc.context.trailerInfo.Info;
  const d = info instanceof PDFRef ? doc.context.lookup(info) : info;
  return d instanceof PDFDict ? d : undefined;
}

function streamText(s: PDFObject | undefined, doc: PDFDocument): { text: string; bytes: number } | null {
  const st = s instanceof PDFRef ? doc.context.lookup(s) : s;
  if (!(st instanceof PDFRawStream)) return null;
  try {
    const b = decodePDFRawStream(st).decode();
    return { text: new TextDecoder("utf-8").decode(b), bytes: b.length };
  } catch {
    return { text: "", bytes: st.contents.length };
  }
}

const XMP_LABELS: Record<string, string> = {
  "dc:title": "Title",
  "dc:creator": "Author",
  "dc:description": "Subject",
  "dc:subject": "Keywords",
  "dc:rights": "Rights",
  "pdf:Keywords": "Keywords",
  "pdf:Producer": "Producer",
  "xmp:CreatorTool": "Creator tool",
  "xmp:CreateDate": "Created",
  "xmp:ModifyDate": "Modified",
  "xmp:MetadataDate": "Metadata date",
  "xmpMM:DocumentID": "Document ID",
  "xmpMM:InstanceID": "Instance ID",
  "xmpMM:OriginalDocumentID": "Original document ID",
  "photoshop:AuthorsPosition": "Author's position",
  "xmpRights:Marked": "Rights marked",
};

/** Pull the human-readable fields out of an XMP packet. */
function parseXmp(xml: string): Field[] {
  const out: Field[] = [];
  if (typeof DOMParser === "undefined") return out;
  const doc = new DOMParser().parseFromString(xml.replace(/^[^<]+/, ""), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return [{ key: "XMP", value: `${xml.length} characters (couldn't be parsed)` }];
  const seen = new Set<string>();
  const add = (key: string, value: string) => {
    value = value.trim().replace(/\s+/g, " ");
    if (!value || seen.has(key + value)) return;
    seen.add(key + value);
    out.push({ key, value: value.length > 160 ? value.slice(0, 157) + "…" : value });
  };
  for (const desc of Array.from(doc.getElementsByTagNameNS("*", "Description"))) {
    // Attributes form: <rdf:Description xmp:CreatorTool="Word">
    for (const a of Array.from(desc.attributes)) {
      if (a.name.startsWith("xmlns") || a.name === "rdf:about") continue;
      add(XMP_LABELS[a.name] ?? a.name, a.value);
    }
    for (const el of Array.from(desc.children)) {
      const name = el.tagName;
      if (name === "xmpMM:History") {
        const n = el.getElementsByTagNameNS("*", "li").length;
        if (n) add("Edit history", `${n} ${n === 1 ? "entry" : "entries"}`);
        continue;
      }
      const items = el.getElementsByTagNameNS("*", "li");
      const value = items.length ? Array.from(items).map((li) => li.textContent ?? "").join(", ") : el.textContent ?? "";
      add(XMP_LABELS[name] ?? name, value);
    }
  }
  return out;
}

const MARKUP_SKIP = new Set(["/Widget", "/Link", "/Popup"]);

function* annotations(doc: PDFDocument): Generator<PDFDict> {
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i);
      if (a instanceof PDFDict) yield a;
    }
  }
}

function forEachDict(doc: PDFDocument, fn: (d: PDFDict) => void) {
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict) fn(obj);
    else if (obj instanceof PDFStream) fn(obj.dict);
  }
}

export function readMetadata(doc: PDFDocument): MetadataReport {
  const info: Field[] = [];
  const d = infoDict(doc);
  if (d) {
    for (const [k, v] of d.entries()) {
      const key = k.decodeText();
      const resolved = v instanceof PDFRef ? doc.context.lookup(v) : v;
      let value = text(resolved);
      if (/Date$/.test(key)) value = prettyDate(value);
      if (value.trim()) info.push({ key, value: value.length > 160 ? value.slice(0, 157) + "…" : value });
    }
  }
  const xmpStream = streamText(doc.catalog.get(N("Metadata")), doc);
  const xmp = xmpStream ? parseXmp(xmpStream.text) : [];

  let objectXmp = 0;
  let pieceInfo = 0;
  const catalogMeta = doc.catalog.get(N("Metadata"));
  forEachDict(doc, (dict) => {
    const m = dict.get(N("Metadata"));
    if (m && dict !== doc.catalog && m !== catalogMeta) objectXmp++;
    if (dict.get(N("PieceInfo"))) pieceInfo++;
  });

  let commentAuthors = 0;
  let commentDates = 0;
  const names = new Set<string>();
  for (const a of annotations(doc)) {
    const st = a.lookup(N("Subtype"))?.toString() ?? "";
    if (MARKUP_SKIP.has(st)) continue;
    const t = a.lookup(N("T"));
    if (t) {
      commentAuthors++;
      const name = text(t).trim();
      if (name) names.add(name);
    }
    if (a.get(N("M")) || a.get(N("CreationDate"))) commentDates++;
  }

  let attachments = 0;
  forEachDict(doc, (dict) => {
    if (dict.get(N("Type")) === N("Filespec") && dict.get(N("EF"))) attachments++;
  });

  return {
    info,
    xmp,
    xmpBytes: xmpStream?.bytes ?? 0,
    objectXmp,
    pieceInfo,
    commentAuthors,
    authorNames: [...names].slice(0, 5),
    commentDates,
    attachments,
    pages: doc.getPageCount(),
  };
}

export type StripOptions = { keepTitle: boolean; comments: boolean };

export function stripMetadata(doc: PDFDocument, opts: StripOptions): void {
  const ctx = doc.context;
  const title = opts.keepTitle ? infoDict(doc)?.lookup(N("Title")) : undefined;

  // 1. Info dictionary: replace with an empty one (or one holding only the title).
  const fresh = ctx.obj({});
  if (title instanceof PDFString || title instanceof PDFHexString) fresh.set(N("Title"), title);
  ctx.trailerInfo.Info = ctx.register(fresh);

  // 2. XMP on the catalog and on every other object, and private application data.
  forEachDict(doc, (dict) => {
    dict.delete(N("Metadata"));
    dict.delete(N("PieceInfo"));
  });
  doc.catalog.delete(N("Metadata"));
  doc.catalog.delete(N("PieceInfo"));

  // 3. Comment authors and dates. Form fields keep /T: there it's the field's name.
  if (opts.comments) {
    for (const a of annotations(doc)) {
      const st = a.lookup(N("Subtype"))?.toString() ?? "";
      if (st === "/Widget" || st === "/Link") continue;
      a.delete(N("T"));
      a.delete(N("M"));
      a.delete(N("CreationDate"));
    }
  }

  // 4. A new random file ID, so the copy can't be matched to the original by ID.
  const rnd = () => {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return PDFHexString.of(Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(""));
  };
  const id = rnd();
  ctx.trailerInfo.ID = ctx.obj([id, id]) as PDFArray;

  // 5. Drop the old Info and XMP objects that nothing points to any more.
  collectGarbage(ctx);
}

export async function saveStripped(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
}
