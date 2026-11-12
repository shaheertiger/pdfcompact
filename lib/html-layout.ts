/**
 * A small HTML → PDF flow-layout engine on pdf-lib, used by Word to PDF and
 * EPUB to PDF. It walks a DOM tree (headings, paragraphs, lists, quotes,
 * simple tables, images, links, bold/italic) and paginates it with the
 * standard PDF fonts. It is deliberately simple: no CSS cascade, no floats,
 * no columns, no headers or footers from the source document.
 */
import {
  PDFDocument,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { createSanitizer, type Sanitizer } from "./winansi";

export type LoadedImage = { bytes: Uint8Array; type: "png" | "jpg" };

export type LayoutOptions = {
  pageSize: "a4" | "letter";
  font: "sans" | "serif";
  /** Body text size in points. */
  baseSize?: number;
  pageNumbers?: boolean;
  /** Resolve an <img src> to PNG or JPEG bytes (convert other formats first). */
  loadImage: (src: string) => Promise<LoadedImage | null>;
  onProgress?: (fraction: number) => void;
  title?: string;
  author?: string;
};

export type LayoutResult = {
  bytes: Uint8Array;
  pages: number;
  replaced: number;
  samples: string[];
  images: number;
  skippedImages: number;
  links: number;
};

type Style = {
  bold: boolean;
  italic: boolean;
  mono: boolean;
  underline: boolean;
  strike: boolean;
  size: number;
  color: RGB;
  link?: string;
  shift: number; // baseline shift for sup/sub
};

type Token = { text: string; style: Style; space: boolean };
type InlineItem = { kind: "text"; text: string; style: Style } | { kind: "br" };

type Line = { tokens: { text: string; style: Style; x: number; w: number }[]; width: number; height: number; ascent: number };

const PAGE = { a4: [595.28, 841.89], letter: [612, 792] } as const;
const MARGIN = 64;
const BLACK = rgb(0.1, 0.1, 0.12);
const LINK = rgb(0.06, 0.32, 0.75);
const GREY = rgb(0.6, 0.6, 0.62);
const HEADING_SCALE: Record<string, number> = { h1: 2, h2: 1.55, h3: 1.27, h4: 1.1, h5: 1, h6: 0.92 };

const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "body", "center", "dd", "details", "dialog", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup",
  "hr", "html", "li", "main", "nav", "ol", "p", "pre", "section", "summary", "table", "ul", "img", "svg", "tr", "td", "th",
  "thead", "tbody", "tfoot", "caption",
]);
const SKIP_TAGS = new Set(["head", "script", "style", "title", "meta", "link", "noscript", "template", "rt", "rp", "button", "input", "select", "textarea", "iframe", "object", "video", "audio", "canvas"]);

function tag(el: Element): string {
  return (el.localName || el.nodeName).toLowerCase();
}

function inlineStyle(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  const s = el.getAttribute("style");
  if (!s) return out;
  for (const part of s.split(";")) {
    const i = part.indexOf(":");
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim().toLowerCase();
  }
  return out;
}

function hidden(el: Element): boolean {
  const st = inlineStyle(el);
  return st.display === "none" || st.visibility === "hidden" || el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true" && tag(el) !== "img";
}

function blockAlign(el: Element, inherited: Align): Align {
  const st = inlineStyle(el);
  const a = st["text-align"] || el.getAttribute("align")?.toLowerCase();
  if (a === "center" || tag(el) === "center") return "center";
  if (a === "right" || a === "end") return "right";
  if (a === "left" || a === "start" || a === "justify") return "left";
  return inherited;
}

type Align = "left" | "center" | "right";

type Ctx = {
  indent: number;
  align: Align;
  style: Style;
  bars: number[];
  pre: boolean;
  heading?: boolean;
};

function romanize(n: number): string {
  const map: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let out = "";
  for (const [v, s] of map) while (n >= v) {
    out += s;
    n -= v;
  }
  return out;
}

function alpha(n: number): string {
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

function cssLength(v: string | null | undefined, rel: number): number | null {
  if (!v) return null;
  const m = v.trim().match(/^([\d.]+)\s*(px|pt|%|em|in|cm|mm)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch ((m[2] || "px").toLowerCase()) {
    case "px":
      return n * 0.75;
    case "pt":
      return n;
    case "%":
      return (n / 100) * rel;
    case "em":
      return n * 11;
    case "in":
      return n * 72;
    case "cm":
      return (n / 2.54) * 72;
    case "mm":
      return (n / 25.4) * 72;
  }
  return null;
}

class Engine {
  doc!: PDFDocument;
  fonts!: Record<string, PDFFont>;
  page!: PDFPage;
  y = 0;
  pageW: number;
  pageH: number;
  base: number;
  family: "sans" | "serif";
  san: Sanitizer = createSanitizer();
  opts: LayoutOptions;
  images = 0;
  skippedImages = 0;
  links = 0;
  imageCache = new Map<string, PDFImage | null>();
  pendingMarker: { text: string; x: number; style: Style } | null = null;
  pendingHeading: { lines: Line[]; x: number; width: number; align: Align; bars: number[]; before: number; after: number } | null = null;
  /** Vertical space owed before the next block (collapsed like CSS margins). */
  gap = 0;
  /** Nothing has been drawn on the current page yet. */
  fresh = false;
  blocksDone = 0;
  blocksTotal = 1;
  lastYield = Date.now();

  constructor(opts: LayoutOptions) {
    this.opts = opts;
    const [w, h] = PAGE[opts.pageSize];
    this.pageW = w;
    this.pageH = h;
    this.base = opts.baseSize ?? 11;
    this.family = opts.font;
  }

  async init() {
    this.doc = await PDFDocument.create();
    const F = StandardFonts;
    const pick = this.family === "serif"
      ? [F.TimesRoman, F.TimesRomanBold, F.TimesRomanItalic, F.TimesRomanBoldItalic]
      : [F.Helvetica, F.HelveticaBold, F.HelveticaOblique, F.HelveticaBoldOblique];
    const mono = [F.Courier, F.CourierBold, F.CourierOblique, F.CourierBoldOblique];
    const keys = ["r", "b", "i", "bi"];
    this.fonts = {};
    for (let k = 0; k < 4; k++) {
      this.fonts[keys[k]] = await this.doc.embedFont(pick[k]);
      this.fonts["m" + keys[k]] = await this.doc.embedFont(mono[k]);
    }
    if (this.opts.title) this.doc.setTitle(this.san.clean(this.opts.title));
    if (this.opts.author) this.doc.setAuthor(this.san.clean(this.opts.author));
    this.doc.setProducer("PDFCompact");
  }

  get left() {
    return MARGIN;
  }
  get width() {
    return this.pageW - 2 * MARGIN;
  }
  get bottom() {
    return MARGIN;
  }

  font(s: Style): PDFFont {
    const k = s.bold ? (s.italic ? "bi" : "b") : s.italic ? "i" : "r";
    return this.fonts[(s.mono ? "m" : "") + k];
  }

  newPage() {
    this.page = this.doc.addPage([this.pageW, this.pageH]);
    this.y = this.pageH - MARGIN;
    this.fresh = true;
    this.gap = 0;
  }

  /** Make room for h points, starting a new page if needed. Returns true if a page break happened. */
  ensure(h: number): boolean {
    if (this.y - h < this.bottom && this.y < this.pageH - MARGIN - 1) {
      this.newPage();
      return true;
    }
    return false;
  }

  spaceBefore(pts: number) {
    this.gap = Math.max(this.gap, pts);
  }

  /**
   * Apply the owed vertical gap before a block whose first piece is `next`
   * points tall. A heading waiting to be drawn is placed here, together with
   * that first piece, so a heading never ends up alone at a page bottom.
   */
  applyGap(next = 0) {
    const ph = this.pendingHeading;
    if (ph) {
      this.pendingHeading = null;
      const after = Math.max(this.gap, ph.after);
      this.gap = ph.before;
      this.rawGap();
      const hh = ph.lines.reduce((n, l) => n + l.height, 0);
      this.ensure(Math.min(hh + after + next, this.pageH - 2 * MARGIN));
      const marker = this.pendingMarker; // belongs to the list item after the heading
      this.pendingMarker = null;
      for (const l of ph.lines) {
        this.ensure(l.height);
        this.drawLine(l, ph.x, ph.width, ph.align, ph.bars);
        this.y -= l.height;
      }
      this.pendingMarker = marker;
      this.gap = after;
    }
    this.rawGap();
  }

  rawGap() {
    if (this.gap && this.y < this.pageH - MARGIN - 1) this.y -= this.gap;
    this.gap = 0;
  }

  async tick() {
    this.blocksDone++;
    if (Date.now() - this.lastYield > 50) {
      this.opts.onProgress?.(Math.min(0.97, this.blocksDone / this.blocksTotal));
      await new Promise((r) => setTimeout(r));
      this.lastYield = Date.now();
    }
  }

  // ---------------------------------------------------------------- inline

  /** Turn inline items into tokens (words and single spaces) with whitespace collapsed. */
  tokenize(items: InlineItem[], pre: boolean): (Token | "br")[] {
    const out: (Token | "br")[] = [];
    let lastSpace = true;
    for (const it of items) {
      if (it.kind === "br") {
        out.push("br");
        lastSpace = true;
        continue;
      }
      const text = this.san.clean(it.text);
      if (pre) {
        const lines = text.split("\n");
        lines.forEach((ln, i) => {
          if (i > 0) out.push("br");
          // Keep runs of spaces in preformatted text as separate space tokens.
          for (const piece of ln.split(/( )/)) if (piece) out.push({ text: piece, style: it.style, space: piece === " " });
        });
        continue;
      }
      for (const piece of text.split(/(\s+)/)) {
        if (!piece) continue;
        if (/^\s+$/.test(piece)) {
          if (!lastSpace) out.push({ text: " ", style: it.style, space: true });
          lastSpace = true;
        } else {
          out.push({ text: piece, style: it.style, space: false });
          lastSpace = false;
        }
      }
    }
    return out;
  }

  measure(text: string, s: Style): number {
    return this.font(s).widthOfTextAtSize(text, s.size);
  }

  /** Greedy line breaking. Breaks only at spaces, or inside words that are wider than the line. */
  breakLines(tokens: (Token | "br")[], width: number, minHeight: number): Line[] {
    const lines: Line[] = [];
    let cur: Line = { tokens: [], width: 0, height: minHeight, ascent: minHeight * 0.75 };
    let pendingSpace: Token | null = null;
    const push = () => {
      lines.push(cur);
      cur = { tokens: [], width: 0, height: minHeight, ascent: minHeight * 0.75 };
      pendingSpace = null;
    };
    const addTok = (t: Token, w: number) => {
      cur.tokens.push({ text: t.text, style: t.style, x: cur.width, w });
      cur.width += w;
      cur.height = Math.max(cur.height, t.style.size * 1.35);
      cur.ascent = Math.max(cur.ascent, t.style.size * 0.95);
    };
    // Group words: consecutive non-space tokens without a space between them.
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === "br") {
        push();
        i++;
        continue;
      }
      if (t.space) {
        if (cur.tokens.length) pendingSpace = t;
        i++;
        continue;
      }
      const word: Token[] = [];
      while (i < tokens.length && tokens[i] !== "br" && !(tokens[i] as Token).space) word.push(tokens[i++] as Token);
      const widths = word.map((w) => this.measure(w.text, w.style));
      const wordW = widths.reduce((a, b) => a + b, 0);
      const spaceW = pendingSpace ? this.measure(" ", pendingSpace.style) : 0;
      if (cur.tokens.length && cur.width + spaceW + wordW > width) push();
      if (pendingSpace && cur.tokens.length) addTok(pendingSpace, spaceW);
      pendingSpace = null;
      if (wordW <= width - cur.width) {
        word.forEach((w, k) => addTok(w, widths[k]));
        continue;
      }
      // Word longer than a line: split it by characters.
      for (const w of word) {
        let rest = w.text;
        while (rest) {
          let n = rest.length;
          while (n > 1 && this.measure(rest.slice(0, n), w.style) > width - cur.width) n--;
          if (n === 1 && cur.tokens.length && this.measure(rest.slice(0, 1), w.style) > width - cur.width) {
            push();
            continue;
          }
          const piece = rest.slice(0, n);
          addTok({ ...w, text: piece }, this.measure(piece, w.style));
          rest = rest.slice(n);
          if (rest) push();
        }
      }
    }
    if (cur.tokens.length || !lines.length) lines.push(cur);
    // Drop trailing spaces.
    for (const l of lines) {
      while (l.tokens.length && l.tokens[l.tokens.length - 1].text === " ") {
        l.width -= l.tokens.pop()!.w;
      }
    }
    return lines;
  }

  drawLine(line: Line, x: number, width: number, align: Align, bars: number[], page = this.page, top = this.y) {
    const baseline = top - line.ascent - (line.height - line.ascent) * 0.25;
    if (page === this.page) this.fresh = false;
    const offset = align === "center" ? (width - line.width) / 2 : align === "right" ? width - line.width : 0;
    if (this.pendingMarker && page === this.page) {
      const m = this.pendingMarker;
      page.drawText(m.text, { x: m.x, y: baseline, size: m.style.size, font: this.font(m.style), color: m.style.color });
      this.pendingMarker = null;
    }
    // Draw runs of same-style words as one string: better copy/paste, smaller files.
    const same = (a: Style, b: Style) =>
      a === b ||
      (a.bold === b.bold && a.italic === b.italic && a.mono === b.mono && a.size === b.size && a.shift === b.shift &&
        a.underline === b.underline && a.strike === b.strike && a.link === b.link && a.color === b.color);
    const runs: { text: string; style: Style; x: number; w: number }[] = [];
    for (const t of line.tokens) {
      const last = runs[runs.length - 1];
      if (last && same(last.style, t.style) && Math.abs(last.x + last.w - t.x) < 0.01) {
        last.text += t.text;
        last.w += t.w;
      } else runs.push({ ...t });
    }
    for (const r of runs) {
      const tx = x + offset + r.x;
      const s = r.style;
      if (r.text.trim()) {
        page.drawText(r.text, { x: tx, y: baseline + s.shift, size: s.size, font: this.font(s), color: s.color });
      }
      if (s.underline || s.link) {
        page.drawLine({ start: { x: tx, y: baseline - 1.5 }, end: { x: tx + r.w, y: baseline - 1.5 }, thickness: 0.5, color: s.color });
      }
      if (s.strike) {
        page.drawLine({ start: { x: tx, y: baseline + s.size * 0.3 }, end: { x: tx + r.w, y: baseline + s.size * 0.3 }, thickness: 0.6, color: s.color });
      }
      if (s.link) this.addLink(page, s.link, tx, baseline - s.size * 0.25, tx + r.w, baseline + s.size * 0.85);
    }
    for (const bx of bars) {
      page.drawRectangle({ x: bx, y: top - line.height, width: 2, height: line.height, color: GREY });
    }
  }

  addLink(page: PDFPage, url: string, x0: number, y0: number, x1: number, y1: number) {
    const annot = this.doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x0, y0, x1, y1],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    });
    page.node.addAnnot(this.doc.context.register(annot));
    this.links++;
  }

  /** Lay out and draw a paragraph of inline items with page breaks between lines. */
  paragraph(items: InlineItem[], ctx: Ctx) {
    if (!items.some((i) => i.kind === "br" || i.text.trim() || ctx.pre)) return;
    // Remove leading/trailing breaks.
    while (items.length && items[items.length - 1].kind === "br") items.pop();
    const tokens = this.tokenize(items, ctx.pre);
    if (!tokens.length) return;
    const x = this.left + ctx.indent;
    const width = this.width - ctx.indent;
    const lines = this.breakLines(tokens, width, ctx.style.size * 1.35);
    if (ctx.heading && this.pendingHeading) {
      this.pendingHeading.lines.push(...lines);
      return;
    }
    this.applyGap(lines[0].height + (lines[1]?.height ?? 0));
    for (const line of lines) {
      if (this.ensure(line.height)) {
        /* new page */
      }
      this.drawLine(line, x, width, ctx.align, ctx.bars);
      this.y -= line.height;
    }
  }

  // ---------------------------------------------------------------- blocks

  styleFor(el: Element, s: Style): Style {
    const t = tag(el);
    const st = inlineStyle(el);
    const out = { ...s };
    if (t === "b" || t === "strong" || t === "th" || /^h[1-6]$/.test(t) || st["font-weight"] === "bold" || +st["font-weight"] >= 600) out.bold = true;
    if (st["font-weight"] === "normal") out.bold = false;
    if (t === "i" || t === "em" || t === "cite" || t === "var" || t === "dfn" || st["font-style"] === "italic") out.italic = true;
    if (t === "u" || t === "ins" || st["text-decoration"]?.includes("underline")) out.underline = true;
    if (t === "s" || t === "strike" || t === "del" || st["text-decoration"]?.includes("line-through")) out.strike = true;
    if (t === "code" || t === "kbd" || t === "samp" || t === "tt" || t === "pre") {
      out.mono = true;
      out.size = s.size * 0.92;
    }
    if (t === "small") out.size = s.size * 0.85;
    if (t === "sup" || t === "sub") {
      out.size = s.size * 0.7;
      out.shift = t === "sup" ? s.size * 0.35 : -s.size * 0.15;
    }
    if (t === "a") {
      const href = el.getAttribute("href") ?? "";
      if (/^(https?:|mailto:)/i.test(href)) {
        out.link = href;
        out.color = LINK;
      }
    }
    return out;
  }

  async block(el: Element, ctx: Ctx): Promise<void> {
    const t = tag(el);
    if (SKIP_TAGS.has(t) || hidden(el)) return;
    await this.tick();
    if (/^h[1-6]$/.test(t)) {
      const size = this.base * HEADING_SCALE[t];
      if (this.pendingHeading) this.applyGap(size * 1.35);
      this.spaceBefore(size * 0.9);
      const style = { ...this.styleFor(el, ctx.style), size, bold: true };
      const align = blockAlign(el, ctx.align);
      // Hold the heading back until the next block is placed (keep with next).
      const before = this.gap;
      this.gap = 0;
      this.pendingHeading = { lines: [], x: this.left + ctx.indent, width: this.width - ctx.indent, align, bars: ctx.bars, before, after: size * 0.4 };
      await this.flow(el, { ...ctx, style, align, heading: true });
      if (this.pendingHeading && !this.pendingHeading.lines.length) {
        this.pendingHeading = null;
        this.gap = before;
      }
      return;
    }
    switch (t) {
      case "p":
      case "div":
      case "section":
      case "article":
      case "header":
      case "footer":
      case "main":
      case "nav":
      case "aside":
      case "address":
      case "figure":
      case "figcaption":
      case "center":
      case "body":
      case "html":
      case "details":
      case "summary":
      case "hgroup":
      case "fieldset":
      case "form":
      case "dl":
      case "caption": {
        const st = inlineStyle(el);
        if (t === "p" || t === "figcaption") this.spaceBefore(this.base * 0.25);
        if (/(always|page)/.test(st["page-break-before"] ?? "") || /page/.test(st["break-before"] ?? "")) {
          if (this.y < this.pageH - MARGIN - 1) this.newPage();
        }
        const style = t === "figcaption" ? { ...this.styleFor(el, ctx.style), italic: true, size: ctx.style.size * 0.9 } : this.styleFor(el, ctx.style);
        await this.flow(el, { ...ctx, style, align: blockAlign(el, ctx.align) });
        if (t === "p" || t === "figcaption" || t === "dl") this.spaceBefore(this.base * 0.55);
        return;
      }
      case "dt":
        this.spaceBefore(this.base * 0.3);
        await this.flow(el, { ...ctx, style: { ...ctx.style, bold: true } });
        return;
      case "dd":
        await this.flow(el, { ...ctx, indent: ctx.indent + 22 });
        return;
      case "blockquote": {
        this.spaceBefore(this.base * 0.5);
        const barX = this.left + ctx.indent + 4;
        await this.flow(el, { ...ctx, indent: ctx.indent + 20, bars: [...ctx.bars, barX], style: { ...ctx.style, color: rgb(0.25, 0.25, 0.28) } });
        this.spaceBefore(this.base * 0.5);
        return;
      }
      case "pre": {
        this.spaceBefore(this.base * 0.4);
        await this.flow(el, { ...ctx, pre: true, style: this.styleFor(el, ctx.style) });
        this.spaceBefore(this.base * 0.6);
        return;
      }
      case "hr": {
        this.spaceBefore(this.base * 0.5);
        this.applyGap(8);
        this.ensure(8);
        this.page.drawLine({
          start: { x: this.left + ctx.indent, y: this.y - 4 },
          end: { x: this.left + this.width, y: this.y - 4 },
          thickness: 0.7,
          color: GREY,
        });
        this.y -= 8;
        this.spaceBefore(this.base * 0.5);
        return;
      }
      case "ul":
      case "ol":
        await this.list(el, ctx);
        return;
      case "li":
        // A stray <li> outside a list.
        await this.listItem(el, ctx, "•");
        return;
      case "table":
        await this.table(el, ctx);
        return;
      case "img":
        await this.image(el.getAttribute("src") ?? el.getAttribute("data-src") ?? "", el, ctx);
        return;
      case "svg": {
        // Covers in EPUBs are often <svg><image href="cover.jpg"/></svg>.
        const img = Array.from(el.getElementsByTagName("*")).find((e) => tag(e) === "image");
        const href = img?.getAttribute("href") ?? img?.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (href) await this.image(href, img!, ctx);
        return;
      }
      default:
        await this.flow(el, ctx);
    }
  }

  /** Walk children: runs of inline content become paragraphs, block children recurse. */
  async flow(el: Element, ctx: Ctx) {
    let items: InlineItem[] = [];
    const flush = () => {
      if (items.length) this.paragraph(items, ctx);
      items = [];
    };
    const visitInline = async (node: Node, style: Style): Promise<void> => {
      if (node.nodeType === 3) {
        items.push({ kind: "text", text: node.nodeValue ?? "", style });
        return;
      }
      if (node.nodeType !== 1) return;
      const child = node as Element;
      const t = tag(child);
      if (SKIP_TAGS.has(t) || hidden(child)) return;
      if (t === "br") {
        items.push({ kind: "br" });
        return;
      }
      if (BLOCK_TAGS.has(t)) {
        flush();
        await this.block(child, { ...ctx, style: style === ctx.style ? ctx.style : style });
        return;
      }
      const s = this.styleFor(child, style);
      for (const c of Array.from(child.childNodes)) await visitInline(c, s);
    };
    for (const c of Array.from(el.childNodes)) await visitInline(c, ctx.style);
    flush();
  }

  async list(el: Element, ctx: Ctx) {
    const ordered = tag(el) === "ol";
    const type = el.getAttribute("type") ?? "1";
    let n = parseInt(el.getAttribute("start") ?? "1", 10) || 1;
    const st = inlineStyle(el)["list-style-type"] ?? "";
    this.spaceBefore(this.base * 0.3);
    for (const child of Array.from(el.children)) {
      if (tag(child) !== "li") {
        await this.block(child, { ...ctx, indent: ctx.indent + 20 });
        continue;
      }
      const v = parseInt(child.getAttribute("value") ?? "", 10);
      if (v) n = v;
      let marker = "•";
      if (ordered) {
        if (type === "a" || st === "lower-alpha" || st === "lower-latin") marker = `${alpha(n)}.`;
        else if (type === "A" || st === "upper-alpha") marker = `${alpha(n).toUpperCase()}.`;
        else if (type === "i" || st === "lower-roman") marker = `${romanize(n)}.`;
        else if (type === "I" || st === "upper-roman") marker = `${romanize(n).toUpperCase()}.`;
        else marker = `${n}.`;
        n++;
      } else if (st === "none") marker = "";
      else if (ctx.indent >= 40) marker = "–";
      await this.listItem(child, ctx, marker);
    }
    this.spaceBefore(this.base * 0.4);
  }

  async listItem(li: Element, ctx: Ctx, marker: string) {
    const indent = ctx.indent + 20;
    const style = { ...ctx.style, underline: false, link: undefined, strike: false, shift: 0 };
    const mw = this.measure(marker, style);
    this.spaceBefore(this.base * 0.15);
    this.pendingMarker = marker ? { text: marker, x: this.left + indent - mw - 5, style: { ...style, color: BLACK } } : null;
    // Paragraph spacing inside list items is tighter.
    await this.flow(li, { ...ctx, indent });
    this.pendingMarker = null;
  }

  // ---------------------------------------------------------------- images

  async image(src: string, el: Element, ctx: Ctx) {
    if (!src) return;
    let img = this.imageCache.get(src);
    if (img === undefined) {
      try {
        const loaded = await this.opts.loadImage(src);
        img = loaded ? (loaded.type === "png" ? await this.doc.embedPng(loaded.bytes) : await this.doc.embedJpg(loaded.bytes)) : null;
      } catch {
        img = null;
      }
      this.imageCache.set(src, img);
    }
    if (!img) {
      this.skippedImages++;
      const alt = el.getAttribute("alt");
      if (alt) this.paragraph([{ kind: "text", text: `[${alt}]`, style: { ...ctx.style, italic: true, color: GREY } }], ctx);
      return;
    }
    const maxW = this.width - ctx.indent;
    const maxH = this.pageH - 2 * MARGIN;
    const st = inlineStyle(el);
    let w = cssLength(st.width ?? el.getAttribute("width"), maxW) ?? img.width * 0.75;
    let h = cssLength(st.height ?? el.getAttribute("height"), maxH) ?? (w * img.height) / img.width;
    if (!st.height && !el.getAttribute("height")) h = (w * img.height) / img.width;
    if (w > maxW) {
      h *= maxW / w;
      w = maxW;
    }
    if (h > maxH) {
      w *= maxH / h;
      h = maxH;
    }
    this.spaceBefore(this.base * 0.3);
    this.applyGap(h);
    this.ensure(h);
    const align = blockAlign(el, ctx.align);
    const x = this.left + ctx.indent + (align === "center" ? (maxW - w) / 2 : align === "right" ? maxW - w : 0);
    this.page.drawImage(img, { x, y: this.y - h, width: w, height: h });
    this.fresh = false;
    if (this.pendingMarker) {
      const m = this.pendingMarker;
      this.page.drawText(m.text, { x: m.x, y: this.y - m.style.size, size: m.style.size, font: this.font(m.style), color: m.style.color });
      this.pendingMarker = null;
    }
    this.y -= h;
    this.images++;
    this.spaceBefore(this.base * 0.4);
  }

  // ---------------------------------------------------------------- tables

  async table(el: Element, ctx: Ctx) {
    type Cell = { items: InlineItem[]; header: boolean; span: number; align: Align };
    const rows: Cell[][] = [];
    const collectRows = (node: Element) => {
      for (const child of Array.from(node.children)) {
        const t = tag(child);
        if (t === "tr") {
          const cells: Cell[] = [];
          for (const c of Array.from(child.children)) {
            const ct = tag(c);
            if (ct !== "td" && ct !== "th") continue;
            const items: InlineItem[] = [];
            const header = ct === "th" || tag(node) === "thead";
            const base = { ...ctx.style, size: ctx.style.size * 0.92, bold: header || ctx.style.bold };
            this.collectInline(c, this.styleFor(c, base), items);
            cells.push({ items, header, span: Math.max(1, parseInt(c.getAttribute("colspan") ?? "1", 10) || 1), align: blockAlign(c, "left") });
          }
          if (cells.length) rows.push(cells);
        } else if (t === "thead" || t === "tbody" || t === "tfoot") collectRows(child);
      }
    };
    collectRows(el);
    if (!rows.length) return;
    const nCols = Math.min(30, Math.max(...rows.map((r) => r.reduce((n, c) => n + c.span, 0))));
    const PADX = 4;
    const PADY = 3;
    const avail = this.width - ctx.indent;

    // Content widths per column (single-span cells only).
    const minW = Array<number>(nCols).fill(12);
    const maxW = Array<number>(nCols).fill(12);
    const tokenRows = rows.map((r) =>
      r.map((c) => {
        const tokens = this.tokenize(c.items, false);
        return { cell: c, tokens };
      })
    );
    for (const r of tokenRows) {
      let col = 0;
      for (const { cell, tokens } of r) {
        if (col >= nCols) break;
        if (cell.span === 1) {
          let lineW = 0;
          let longest = 0;
          let cur = 0;
          for (const t of tokens) {
            if (t === "br") {
              lineW = Math.max(lineW, cur);
              cur = 0;
              continue;
            }
            const w = this.measure(t.text, t.style);
            cur += w;
            if (!t.space) longest = Math.max(longest, w);
          }
          lineW = Math.max(lineW, cur);
          minW[col] = Math.max(minW[col], Math.min(longest, avail / 3) + 2 * PADX);
          maxW[col] = Math.max(maxW[col], lineW + 2 * PADX);
        }
        col += cell.span;
      }
    }
    const sumMax = maxW.reduce((a, b) => a + b, 0);
    const sumMin = minW.reduce((a, b) => a + b, 0);
    let widths: number[];
    if (sumMax <= avail) widths = maxW;
    else if (sumMin >= avail) widths = minW.map((w) => (w * avail) / sumMin);
    else {
      const extra = avail - sumMin;
      const flex = maxW.map((w, i) => w - minW[i]);
      const flexSum = flex.reduce((a, b) => a + b, 0) || 1;
      widths = minW.map((w, i) => w + (extra * flex[i]) / flexSum);
    }
    const x0 = this.left + ctx.indent;

    this.spaceBefore(this.base * 0.5);
    this.applyGap(ctx.style.size * 1.3 + 6);
    for (const r of tokenRows) {
      await this.tick();
      let col = 0;
      const laid = r.map(({ cell, tokens }) => {
        const span = Math.min(cell.span, nCols - col);
        const x = x0 + widths.slice(0, col).reduce((a, b) => a + b, 0);
        const w = widths.slice(col, col + span).reduce((a, b) => a + b, 0);
        col += span;
        const lines = tokens.length ? this.breakLines(tokens, Math.max(6, w - 2 * PADX), cell.items.length ? ctx.style.size * 1.25 : 0) : [];
        return { cell, x, w, lines, h: lines.reduce((n, l) => n + l.height, 0) };
      });
      const filled = col;
      const maxRowH = this.pageH - 2 * MARGIN;
      let rowH = Math.max(ctx.style.size * 1.3, ...laid.map((c) => c.h)) + 2 * PADY;
      if (rowH > maxRowH) {
        for (const c of laid) {
          let h = 0;
          const keep: Line[] = [];
          for (const l of c.lines) {
            if (h + l.height > maxRowH - 2 * PADY) break;
            keep.push(l);
            h += l.height;
          }
          c.lines = keep;
          c.h = h;
        }
        rowH = maxRowH;
      }
      this.ensure(rowH);
      const top = this.y;
      this.fresh = false;
      for (const c of laid) {
        if (c.cell.header) this.page.drawRectangle({ x: c.x, y: top - rowH, width: c.w, height: rowH, color: rgb(0.94, 0.94, 0.95) });
        this.page.drawRectangle({ x: c.x, y: top - rowH, width: c.w, height: rowH, borderColor: rgb(0.7, 0.7, 0.72), borderWidth: 0.5 });
        let ly = top - PADY;
        for (const l of c.lines) {
          this.drawLine(l, c.x + PADX, c.w - 2 * PADX, c.cell.align, [], this.page, ly);
          ly -= l.height;
        }
      }
      // Empty trailing columns still get a border so the grid looks complete.
      if (filled < nCols) {
        const x = x0 + widths.slice(0, filled).reduce((a, b) => a + b, 0);
        const w = widths.slice(filled).reduce((a, b) => a + b, 0);
        this.page.drawRectangle({ x, y: top - rowH, width: w, height: rowH, borderColor: rgb(0.7, 0.7, 0.72), borderWidth: 0.5 });
      }
      for (const bx of ctx.bars) this.page.drawRectangle({ x: bx, y: top - rowH, width: 2, height: rowH, color: GREY });
      this.y -= rowH;
    }
    this.spaceBefore(this.base * 0.7);
  }

  /** Flatten a table cell's content into inline items, with line breaks between blocks. */
  collectInline(el: Element, style: Style, out: InlineItem[]) {
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3) {
        out.push({ kind: "text", text: node.nodeValue ?? "", style });
        continue;
      }
      if (node.nodeType !== 1) continue;
      const c = node as Element;
      const t = tag(c);
      if (SKIP_TAGS.has(t) || hidden(c)) continue;
      if (t === "br") {
        out.push({ kind: "br" });
        continue;
      }
      if (t === "img") {
        const alt = c.getAttribute("alt");
        if (alt) out.push({ kind: "text", text: `[${alt}]`, style: { ...style, italic: true } });
        continue;
      }
      const block = BLOCK_TAGS.has(t) && t !== "td" && t !== "th";
      const hasText = out.some((i) => i.kind === "text" && i.text.trim());
      if (block && hasText && out[out.length - 1]?.kind !== "br") out.push({ kind: "br" });
      if (t === "li") out.push({ kind: "text", text: "• ", style });
      this.collectInline(c, this.styleFor(c, style), out);
      if (block && out.length && out[out.length - 1]?.kind !== "br") out.push({ kind: "br" });
    }
    while (out.length && out[out.length - 1].kind === "br") out.pop();
  }

  // ---------------------------------------------------------------- run

  countBlocks(el: Element): number {
    return el.getElementsByTagName("*").length + 1;
  }

  async run(sections: Element[]): Promise<LayoutResult> {
    await this.init();
    this.blocksTotal = sections.reduce((n, s) => n + this.countBlocks(s), 0) || 1;
    const style: Style = { bold: false, italic: false, mono: false, underline: false, strike: false, size: this.base, color: BLACK, shift: 0 };
    for (const section of sections) {
      if (!this.page || !this.fresh) this.newPage();
      await this.flow(section, { indent: 0, align: "left", style, bars: [], pre: false });
      this.applyGap();
    }
    const pages = this.doc.getPages();
    if (this.opts.pageNumbers) {
      const f = this.fonts.r;
      pages.forEach((p, i) => {
        const label = String(i + 1);
        const w = f.widthOfTextAtSize(label, 9);
        p.drawText(label, { x: (p.getWidth() - w) / 2, y: MARGIN / 2 - 3, size: 9, font: f, color: GREY });
      });
    }
    const bytes = await this.doc.save();
    return {
      bytes,
      pages: pages.length,
      replaced: this.san.replaced(),
      samples: this.san.samples(),
      images: this.images,
      skippedImages: this.skippedImages,
      links: this.links,
    };
  }
}

/** Lay out one or more HTML sections (each starts on a new page) into a PDF. */
export async function htmlToPdf(sections: Element[], opts: LayoutOptions): Promise<LayoutResult> {
  return new Engine(opts).run(sections);
}

/**
 * Browser image loader helper: PNG and JPEG bytes pass through, anything the
 * browser can decode (GIF, WebP, BMP, SVG) is redrawn to PNG on a canvas.
 */
export async function toEmbeddable(bytes: Uint8Array, mime: string): Promise<LoadedImage | null> {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (isPng) return { bytes, type: "png" };
  if (isJpg) return { bytes, type: "jpg" };
  if (typeof document === "undefined") return null;
  const blob = new Blob([bytes as unknown as BlobPart], { type: mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const w = img.naturalWidth || 600;
    const h = img.naturalHeight || 400;
    const scale = Math.min(1, 2400 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const c2d = canvas.getContext("2d");
    if (!c2d) return null;
    c2d.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    return png ? { bytes: new Uint8Array(await png.arrayBuffer()), type: "png" } : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decode a data: URI to bytes and its MIME type. */
export function dataUriBytes(src: string): { bytes: Uint8Array; mime: string } | null {
  const m = src.match(/^data:([^;,]*)(;base64)?,([\s\S]*)$/);
  if (!m) return null;
  if (m[2]) {
    const bin = atob(m[3]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, mime: m[1] };
  }
  return { bytes: new TextEncoder().encode(decodeURIComponent(m[3])), mime: m[1] };
}
