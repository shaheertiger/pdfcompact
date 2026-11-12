/**
 * Vector flattening: draw each widget's (and optionally each comment's)
 * appearance stream into the page content, then remove the annotation and
 * the AcroForm. Text in the rest of the page stays selectable.
 *
 * Placement follows the PDF spec (12.5.5): the appearance's BBox, transformed
 * by its Matrix, is mapped onto the annotation's Rect.
 */
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFStream,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
} from "@cantoo/pdf-lib";

const N = (s: string) => PDFName.of(s);

export type FlattenInfo = { fields: number; widgets: number; comments: number };

export class FlattenError extends Error {
  constructor(public code: "encrypted" | "unreadable") {
    super(code);
  }
}

export async function loadForFlatten(bytes: Uint8Array): Promise<PDFDocument> {
  let doc: PDFDocument;
  try {
    // The fork decrypts files that carry only a permissions password; ones that need an open password throw.
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, password: "", updateMetadata: false });
  } catch (e) {
    if (e instanceof Error && /encrypt|password/i.test(e.name + e.message)) throw new FlattenError("encrypted");
    throw new FlattenError("unreadable");
  }
  if (doc.isEncrypted || doc.context.trailerInfo.Encrypt) throw new FlattenError("encrypted");
  return doc;
}

const SKIP = new Set(["/Link", "/Popup"]);

/** Count what there is to flatten. */
export function inspect(doc: PDFDocument): FlattenInfo {
  let widgets = 0;
  let comments = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i);
      if (!(a instanceof PDFDict)) continue;
      const st = a.lookup(N("Subtype"))?.toString() ?? "";
      if (st === "/Widget") widgets++;
      else if (!SKIP.has(st)) comments++;
    }
  }
  let fields = 0;
  try {
    const acro = doc.catalog.lookupMaybe(N("AcroForm"), PDFDict);
    if (acro) fields = doc.getForm().getFields().length;
  } catch {
    fields = 0;
  }
  return { fields, widgets, comments };
}

function nums(a: PDFArray | undefined, len: number): number[] | null {
  if (!a || a.size() < len) return null;
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    const v = a.lookup(i);
    if (!(v instanceof PDFNumber)) return null;
    out.push(v.asNumber());
  }
  return out;
}

/** A field attribute that may live on the widget or any parent field. */
function inherited(annot: PDFDict, key: string) {
  let d: PDFDict | undefined = annot;
  for (let depth = 0; d && depth < 10; depth++) {
    const v = d.lookup(N(key));
    if (v !== undefined) return v;
    d = d.lookupMaybe(N("Parent"), PDFDict);
  }
  return undefined;
}

/** The normal appearance stream to draw for an annotation, or null. */
function normalAppearance(doc: PDFDocument, annot: PDFDict): { ref: PDFRef; stream: PDFStream } | null {
  const ap = annot.lookupMaybe(N("AP"), PDFDict);
  if (!ap) return null;
  let n = ap.get(N("N"));
  let resolved = n instanceof PDFRef ? doc.context.lookup(n) : n;
  if (resolved instanceof PDFDict && !(resolved instanceof PDFStream)) {
    // Checkboxes and radio buttons: one appearance per state. The field's value
    // (/V) decides which one is on; /AS is only a cache of it and some tools
    // leave it stale, so trust /V when it names one of this widget's states.
    const states = resolved;
    const v = inherited(annot, "V");
    let state: PDFName | undefined;
    if (inherited(annot, "FT") === N("Btn") && v instanceof PDFName) {
      state = states.get(v) ? v : N("Off");
    } else {
      const as = annot.lookup(N("AS"));
      if (as instanceof PDFName) state = as;
    }
    if (!state) return null;
    n = states.get(state);
    resolved = n instanceof PDFRef ? doc.context.lookup(n) : n;
  }
  if (!(resolved instanceof PDFStream)) return null;
  const ref = n instanceof PDFRef ? n : doc.context.register(resolved);
  return { ref, stream: resolved };
}

/**
 * Flatten form fields (always) and, if `comments` is true, every other
 * annotation that has an appearance (highlights, stamps, ink, notes…). Links
 * are kept. Returns how many annotations were drawn into the pages.
 */
export function flattenAnnotations(doc: PDFDocument, comments: boolean): { widgets: number; comments: number } {
  // Fields with no appearance stream yet get one generated, so their values don't vanish.
  try {
    if (doc.catalog.lookupMaybe(N("AcroForm"), PDFDict)) doc.getForm().updateFieldAppearances();
  } catch {
    // Fields we can't regenerate are drawn from whatever appearance they already have.
  }

  let widgets = 0;
  let others = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    const keep: (PDFRef | PDFDict)[] = [];
    for (let i = 0; i < annots.size(); i++) {
      const raw = annots.get(i);
      const a = annots.lookup(i);
      if (!(a instanceof PDFDict)) continue;
      const st = a.lookup(N("Subtype"))?.toString() ?? "";
      const isWidget = st === "/Widget";
      if (st === "/Link" || (!isWidget && !comments)) {
        keep.push(raw as PDFRef | PDFDict);
        continue;
      }
      // Popups belong to comments being flattened; drop them with their parent.
      if (st === "/Popup") continue;
      const flags = (a.lookup(N("F")) as PDFNumber | undefined)?.asNumber?.() ?? 0;
      const hidden = (flags & 2) !== 0 || (flags & 32) !== 0;
      const app = hidden ? null : normalAppearance(doc, a);
      const rect = nums(a.lookupMaybe(N("Rect"), PDFArray), 4);
      if (app && rect) {
        const s = app.stream;
        s.dict.set(N("Type"), N("XObject"));
        s.dict.set(N("Subtype"), N("Form"));
        const bbox = nums(s.dict.lookupMaybe(N("BBox"), PDFArray), 4) ?? [0, 0, 1, 1];
        const m = nums(s.dict.lookupMaybe(N("Matrix"), PDFArray), 6) ?? [1, 0, 0, 1, 0, 0];
        const pts = [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[1]],
          [bbox[0], bbox[3]],
          [bbox[2], bbox[3]],
        ].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const [bx0, bx1, by0, by1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
        const [rx0, ry0, rx1, ry1] = [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])];
        const sx = bx1 - bx0 > 0 ? (rx1 - rx0) / (bx1 - bx0) : 1;
        const sy = by1 - by0 > 0 ? (ry1 - ry0) / (by1 - by0) : 1;
        const name = page.node.newXObject("Flat", app.ref);
        page.pushOperators(
          pushGraphicsState(),
          concatTransformationMatrix(sx, 0, 0, sy, rx0 - bx0 * sx, ry0 - by0 * sy),
          drawObject(name),
          popGraphicsState()
        );
        if (isWidget) widgets++;
        else others++;
      }
    }
    if (keep.length) page.node.set(N("Annots"), doc.context.obj(keep));
    else page.node.delete(N("Annots"));
  }
  // The fields are now plain page content: drop the interactive form (and any XFA).
  doc.catalog.delete(N("AcroForm"));
  return { widgets, comments: others };
}
