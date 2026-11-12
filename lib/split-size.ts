/**
 * Split a PDF into parts that each stay under a byte limit.
 *
 * Greedy page packing: every page's cost is estimated from the objects it
 * references (content streams, images, fonts), counting shared objects once
 * per part. Each finished part is saved and measured; a part that comes out
 * over the limit is rebuilt with a tighter budget. A single page bigger than
 * the limit goes into a part of its own and is reported.
 */
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, type PDFObject } from "pdf-lib";

export type SizePart = {
  /** 0-based page indices. */
  pages: number[];
  bytes: Uint8Array;
  /** True when this is one page that alone exceeds the limit. */
  oversize: boolean;
};

/** Remove page back-references that make pdf-lib copy the whole document into every part. */
function detachAnnotations(doc: PDFDocument): number {
  let removedLinks = 0;
  const pageRefs = new Set(doc.getPages().map((p) => p.ref.toString()));
  const pointsToPage = (v: PDFObject | undefined) => {
    const arr = v instanceof PDFRef ? doc.context.lookup(v) : v;
    if (!(arr instanceof PDFArray) || arr.size() === 0) return false;
    const first = arr.get(0);
    return first instanceof PDFRef && pageRefs.has(first.toString());
  };
  for (const page of doc.getPages()) {
    const annots = page.node.lookup(PDFName.of("Annots"));
    if (!(annots instanceof PDFArray)) continue;
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i);
      if (!(a instanceof PDFDict)) continue;
      a.delete(PDFName.of("P"));
      if (pointsToPage(a.get(PDFName.of("Dest")))) {
        a.delete(PDFName.of("Dest"));
        removedLinks++;
      }
      const act = a.lookup(PDFName.of("A"));
      if (act instanceof PDFDict && pointsToPage(act.get(PDFName.of("D")))) {
        a.delete(PDFName.of("A"));
        removedLinks++;
      }
    }
  }
  return removedLinks;
}

/** Object refs a page depends on, with their approximate size in bytes. */
function pageObjects(doc: PDFDocument, pageIndex: number, sizes: Map<string, number>): Set<string> {
  const page = doc.getPage(pageIndex);
  const seen = new Set<string>();
  const visit = (obj: PDFObject | undefined, isRoot = false) => {
    if (!obj) return;
    if (obj instanceof PDFRef) {
      const key = obj.toString();
      if (seen.has(key)) return;
      const target = doc.context.lookup(obj);
      if (!target) return;
      if (!isRoot && target instanceof PDFDict) {
        const type = target.get(PDFName.of("Type"));
        if (type === PDFName.of("Page") || type === PDFName.of("Pages")) return;
      }
      seen.add(key);
      if (!sizes.has(key)) sizes.set(key, target.sizeInBytes() + 24);
      visit(target);
      return;
    }
    if (obj instanceof PDFDict) {
      for (const [k, v] of obj.entries()) {
        if (k === PDFName.of("Parent") || k === PDFName.of("P")) continue;
        visit(v);
      }
      // Streams keep their dictionary in .dict
      return;
    }
    if (obj instanceof PDFArray) {
      for (let i = 0; i < obj.size(); i++) visit(obj.get(i));
      return;
    }
    const dict = (obj as unknown as { dict?: PDFDict }).dict;
    if (dict instanceof PDFDict) visit(dict);
  };
  visit(page.ref, true);
  // Inherited resources live on the parent Pages node.
  const res = page.node.Resources();
  if (res) visit(res);
  return seen;
}

export async function splitBySize(
  src: PDFDocument,
  limit: number,
  onProgress?: (done: number, total: number, label: string) => Promise<void> | void,
): Promise<{ parts: SizePart[]; removedLinks: number }> {
  const removedLinks = detachAnnotations(src);
  const n = src.getPageCount();
  const sizes = new Map<string, number>();
  const objs: Set<string>[] = [];
  for (let i = 0; i < n; i++) objs.push(pageObjects(src, i, sizes));

  const BASE = 1200; // header, catalog, page tree, xref
  const save = async (pages: number[]) => {
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, pages);
    copied.forEach((p) => out.addPage(p));
    return out.save({ useObjectStreams: true });
  };

  const parts: SizePart[] = [];
  let start = 0;
  let budget = limit * 0.97;
  let attempts = 0;
  while (start < n) {
    // Greedy: add pages while the estimated part size fits the budget.
    const used = new Set<string>();
    let est = BASE;
    const pages: number[] = [];
    for (let i = start; i < n; i++) {
      let add = 0;
      for (const k of objs[i]) if (!used.has(k)) add += sizes.get(k) ?? 0;
      if (pages.length > 0 && est + add > budget) break;
      for (const k of objs[i]) used.add(k);
      est += add;
      pages.push(i);
    }
    if (onProgress) await onProgress(start, n, `Saving part ${parts.length + 1}…`);
    const bytes = await save(pages);
    if (bytes.length <= limit || pages.length === 1) {
      parts.push({ pages, bytes, oversize: bytes.length > limit });
      start = pages[pages.length - 1] + 1;
      budget = limit * 0.97;
      attempts = 0;
    } else {
      // Over the limit: shrink the budget in proportion and rebuild this part.
      attempts++;
      const ratio = limit / bytes.length;
      budget = Math.min(budget * ratio * 0.98, est * ratio * 0.98);
      if (attempts > 6) {
        // Estimates keep missing: drop the last page and try again.
        budget = Math.max(BASE, est - 1);
      }
    }
  }
  if (onProgress) await onProgress(n, n, "Done");
  return { parts, removedLinks };
}

/** Decimal megabytes, as most upload forms count them. */
export const MB = 1_000_000;

export function formatMB(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 2 : 1)} MB`;
}
