"use client";

import type { PdfDoc } from "@/lib/pdfjs";

/**
 * Pull one page's text with pdf.js, keeping line breaks and the spaces that
 * PDFs often encode as gaps between text runs rather than space characters.
 */
export async function pageText(pdf: PdfDoc, pageNumber: number): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  let out = "";
  let lastY: number | null = null;
  let lastEnd: number | null = null;
  let lastH = 10;

  for (const item of content.items) {
    if (!("str" in item)) continue;
    const [, , c, d, x, y] = item.transform as number[];
    const h = Math.hypot(c, d) || item.height || lastH;
    if (lastY !== null && Math.abs(y - lastY) > Math.max(h, lastH) * 0.5) {
      // New line; a gap of nearly two lines means a new paragraph.
      if (!out.endsWith("\n")) out += "\n";
      if (Math.abs(y - lastY) > Math.max(h, lastH) * 1.9 && !out.endsWith("\n\n")) out += "\n";
    } else if (lastEnd !== null && out && !/\s$/.test(out) && !/^\s/.test(item.str)) {
      // A wide jump on the same line is a table column: use a tab so it pastes into a spreadsheet.
      const gap = x - lastEnd;
      if (gap > h * 2) out += "\t";
      else if (gap > h * 0.15) out += " ";
    }
    // pdf.js fills wide gaps with one synthetic space item; a wide one is a table column.
    if (item.str && !item.str.trim() && item.width > h * 2) {
      if (out && !/\s$/.test(out)) out += "\t";
    } else out += item.str;
    if (item.hasEOL) out += "\n";
    if (item.str || item.hasEOL) {
      lastY = y;
      lastEnd = x + item.width;
      lastH = h;
    }
  }
  page.cleanup();
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
