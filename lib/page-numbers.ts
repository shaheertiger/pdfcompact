import { StandardFonts, type PDFDocument, type PDFFont } from "pdf-lib";
import { anchorAt, displaySize, hexToRgb, isolatePage } from "./pdf-stamp";

export type NumberPosition = "tl" | "tc" | "tr" | "bl" | "bc" | "br";
export type NumberFormat = "n" | "page-n" | "page-n-of" | "n-of" | "dash";
export type NumberFont = "helvetica" | "times" | "courier";

export const numberFormats: { value: NumberFormat; label: (n: number, total: number) => string }[] = [
  { value: "n", label: (n) => `${n}` },
  { value: "page-n", label: (n) => `Page ${n}` },
  { value: "page-n-of", label: (n, t) => `Page ${n} of ${t}` },
  { value: "n-of", label: (n, t) => `${n} / ${t}` },
  { value: "dash", label: (n) => `- ${n} -` },
];

export const standardFontFor: Record<NumberFont, StandardFonts> = {
  helvetica: StandardFonts.Helvetica,
  times: StandardFonts.TimesRoman,
  courier: StandardFonts.Courier,
};

export const cssFontFor: Record<NumberFont, string> = {
  helvetica: "Helvetica, Arial, sans-serif",
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
};

export type PageNumberOptions = {
  position: NumberPosition;
  format: NumberFormat;
  /** Number shown on the first numbered page. */
  start: number;
  /** 0-based indices of the pages that get a number, ascending. */
  pages: number[];
  fontSize: number;
  /** Distance from the page edge, in points. */
  margin: number;
  color: string;
  font: NumberFont;
};

export function labelFor(opts: Pick<PageNumberOptions, "format" | "start" | "pages">, k: number): string {
  const total = opts.start + opts.pages.length - 1;
  const fmt = numberFormats.find((f) => f.value === opts.format) ?? numberFormats[0];
  return fmt.label(opts.start + k, total);
}

/** Baseline-left position of the label on a page of the given display size. */
export function layoutLabel(
  pageW: number,
  pageH: number,
  textW: number,
  ascent: number,
  opts: Pick<PageNumberOptions, "position" | "margin">
): { x: number; baseline: number } {
  const col = opts.position[1];
  const x = col === "l" ? opts.margin : col === "r" ? pageW - opts.margin - textW : (pageW - textW) / 2;
  const baseline = opts.position[0] === "t" ? opts.margin + ascent : pageH - opts.margin;
  return { x, baseline };
}

export function ascentOf(font: PDFFont, size: number) {
  return font.heightAtSize(size, { descender: false });
}

/** Draw page numbers onto `doc` in place. */
export async function applyPageNumbers(
  doc: PDFDocument,
  opts: PageNumberOptions,
  onProgress?: (done: number, total: number) => Promise<void> | void
) {
  const font = await doc.embedFont(standardFontFor[opts.font]);
  const color = hexToRgb(opts.color);
  const pages = doc.getPages();
  for (let k = 0; k < opts.pages.length; k++) {
    const page = pages[opts.pages[k]];
    const text = labelFor(opts, k);
    const { width, height } = displaySize(page);
    const tw = font.widthOfTextAtSize(text, opts.fontSize);
    const { x, baseline } = layoutLabel(width, height, tw, ascentOf(font, opts.fontSize), opts);
    isolatePage(doc, page);
    const a = anchorAt(page, x, baseline);
    page.drawText(text, { x: a.x, y: a.y, rotate: a.rotate, size: opts.fontSize, font, color });
    if (onProgress && (k % 10 === 9 || k === opts.pages.length - 1)) await onProgress(k + 1, opts.pages.length);
  }
}
