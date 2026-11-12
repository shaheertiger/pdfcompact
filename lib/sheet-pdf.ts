/**
 * Excel / CSV → PDF: read cells (with their displayed, formatted values) and
 * lay them out as a printable table with pdf-lib.
 *
 * No "@/..." imports, so it can be exercised from Node in tests.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { createSanitizer, type Sanitizer } from "./winansi";
import { parseCell } from "./pdf-table";

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export type Align = "left" | "center" | "right";

export type CellData = {
  text: string;
  align: Align;
  bold?: boolean;
  italic?: boolean;
  fill?: RGB;
  color?: RGB;
  /** Columns this cell spans (horizontal merge), counted in sheet columns. */
  span?: number;
  /** Covered by a merged cell to its left. */
  covered?: boolean;
  border?: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };
};

export type SheetData = {
  name: string;
  hidden: boolean;
  /** rows[r][c], 0-based, null for empty cells. */
  rows: (CellData | null)[][];
  hiddenRows: Set<number>;
  hiddenCols: Set<number>;
  /** Width set in the file, in Excel character units. */
  colWidths: (number | undefined)[];
};

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Decode CSV bytes: UTF-8 (with or without BOM), else Windows-1252. */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function detectDelimiter(text: string): string {
  const candidates = [",", ";", "\t", "|"];
  const lines: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of text.slice(0, 20000)) {
    if (ch === '"') q = !q;
    if (ch === "\n" && !q) {
      lines.push(cur);
      cur = "";
      if (lines.length >= 10) break;
    } else cur += ch;
  }
  if (cur && lines.length < 10) lines.push(cur);
  let best = ",";
  let bestScore = 0;
  for (const d of candidates) {
    const counts = lines.map((l) => {
      let n = 0;
      let inQ = false;
      for (const ch of l) {
        if (ch === '"') inQ = !inQ;
        else if (ch === d && !inQ) n++;
      }
      return n;
    });
    const first = counts[0] ?? 0;
    if (!first) continue;
    const consistent = counts.filter((c) => c === first).length;
    const score = consistent * 100 + first;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** RFC 4180 CSV parser: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function csvToSheet(name: string, text: string): SheetData {
  const grid = parseCsv(text);
  const rows = grid.map((r) =>
    r.map((v): CellData | null => {
      if (v === "") return null;
      const kind = parseCell(v).kind;
      return { text: v, align: kind === "text" ? "left" : "right" };
    })
  );
  return { name, hidden: false, rows, hiddenRows: new Set(), hiddenCols: new Set(), colWidths: [] };
}

// ---------------------------------------------------------------------------
// Number formats
// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function splitSections(fmt: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < fmt.length; i++) {
    const ch = fmt[i];
    if (ch === '"') q = !q;
    if (ch === "\\" && !q) {
      cur += ch + (fmt[i + 1] ?? "");
      i++;
      continue;
    }
    if (ch === ";" && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Remove [Red], [$-409] and keep a currency symbol from [$€-407]. */
function stripBrackets(sec: string): string {
  return sec.replace(/\[([^\]]*)\]/g, (_, inner: string) => {
    const m = inner.match(/^\$([^-]*)/);
    if (m) return m[1] ? `"${m[1]}"` : "";
    if (/^(h+|m+|s+)$/i.test(inner)) return inner; // elapsed time [h]
    return "";
  });
}

function unquoted(sec: string): string {
  return sec.replace(/"[^"]*"/g, "").replace(/\\./g, "");
}

function isDateFormat(sec: string): boolean {
  return /[ydhs]|m/i.test(unquoted(sec).replace(/E\+|E-/gi, "")) && !/[0#?]/.test(unquoted(sec));
}

function literal(part: string): string {
  let out = "";
  for (let i = 0; i < part.length; i++) {
    const ch = part[i];
    if (ch === '"') {
      const end = part.indexOf('"', i + 1);
      out += part.slice(i + 1, end < 0 ? undefined : end);
      i = end < 0 ? part.length : end;
    } else if (ch === "\\") {
      out += part[i + 1] ?? "";
      i++;
    } else if (ch === "_") {
      out += " ";
      i++;
    } else if (ch === "*") {
      i++;
    } else if (ch === "@") {
      out += "\u0000";
    } else out += ch;
  }
  return out;
}

function groupThousands(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatNumberSection(value: number, sec: string, forceSign: boolean): string {
  const m = sec.match(/([#0?,]*[0#?])(\.([0#?]*))?/);
  if (!m || m.index === undefined) return literal(sec).replace("\u0000", String(value));
  let v = value;
  const prefix = literal(sec.slice(0, m.index));
  const suffix = literal(sec.slice(m.index + m[0].length));
  if (/%/.test(prefix + suffix)) v *= 100;
  const decimals = m[3] ? m[3].replace(/[^0#?]/g, "").length : 0;
  const optional = m[3] ? (m[3].match(/#/g) ?? []).length : 0;
  if (/E[+-]/i.test(suffix)) {
    return (forceSign && v < 0 ? "-" : "") + Math.abs(v).toExponential(decimals).toUpperCase().replace(/E\+?/, "E+");
  }
  let s = Math.abs(v).toFixed(decimals);
  if (optional) s = s.replace(new RegExp(`0{1,${optional}}$`), "").replace(/\.$/, "");
  const parts = s.split(".");
  let int = parts[0];
  const frac = parts[1];
  if (/^#/.test(m[1]) && int === "0" && !/0/.test(m[1])) int = "";
  if (m[1].includes(",")) int = groupThousands(int);
  const minInt = (m[1].match(/0/g) ?? []).length;
  if (int.length < minInt) int = int.padStart(minInt, "0");
  const num = frac !== undefined ? `${int}.${frac}` : int;
  return (forceSign && v < 0 ? "-" : "") + prefix + num + suffix.replace("E+", "");
}

function pad(n: number, w = 2) {
  return String(n).padStart(w, "0");
}

function formatDateSection(d: Date, sec: string): string {
  const hasAmPm = /AM\/PM|A\/P/i.test(sec);
  const tokens = sec.match(/"[^"]*"|\\.|yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|A\/P|\.0+|./gi) ?? [];
  let out = "";
  let lastWasHour = false;
  const Y = d.getUTCFullYear();
  const M = d.getUTCMonth();
  const D = d.getUTCDate();
  let H = d.getUTCHours();
  const Mi = d.getUTCMinutes();
  const S = d.getUTCSeconds();
  if (hasAmPm) H = H % 12 || 12;
  tokens.forEach((tok, i) => {
    const t = tok.toLowerCase();
    const next = tokens.slice(i + 1).find((x) => /^[a-z]/i.test(x))?.toLowerCase() ?? "";
    if (tok.startsWith('"')) out += tok.slice(1, -1);
    else if (tok.startsWith("\\")) out += tok[1];
    else if (t === "yyyy") out += Y;
    else if (t === "yy") out += pad(Y % 100);
    else if (t === "mmmmm") out += MONTHS[M][0];
    else if (t === "mmmm") out += MONTHS[M];
    else if (t === "mmm") out += MONTHS[M].slice(0, 3);
    else if (t === "mm" || t === "m") {
      const minute = lastWasHour || next.startsWith("s");
      out += minute ? (t === "mm" ? pad(Mi) : Mi) : t === "mm" ? pad(M + 1) : M + 1;
    } else if (t === "dddd") out += DAYS[d.getUTCDay()];
    else if (t === "ddd") out += DAYS[d.getUTCDay()].slice(0, 3);
    else if (t === "dd") out += pad(D);
    else if (t === "d") out += D;
    else if (t === "hh") out += pad(H);
    else if (t === "h") out += H;
    else if (t === "ss") out += pad(S);
    else if (t === "s") out += S;
    else if (t === "am/pm") out += d.getUTCHours() < 12 ? "AM" : "PM";
    else if (t === "a/p") out += d.getUTCHours() < 12 ? "A" : "P";
    else if (/^\.0+$/.test(t)) out += "." + pad(d.getUTCMilliseconds(), 3).slice(0, t.length - 1);
    else if (tok === "_") out += "";
    else out += tok;
    if (/^h/.test(t)) lastWasHour = true;
    else if (/^[a-z]/i.test(t) && !/^m/.test(t)) lastWasHour = false;
    else if (/^m/.test(t)) lastWasHour = false;
  });
  return out;
}

function serialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400000));
}

function generalNumber(v: number): string {
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  const abs = Math.abs(v);
  if (abs !== 0 && (abs < 1e-9 || abs >= 1e15)) return v.toExponential(5).replace(/\.?0+e/, "E").replace("e", "E");
  return String(Number(v.toPrecision(10)));
}

/** Format a number or date the way Excel shows it for common number formats. */
export function formatValue(value: number | Date, numFmt: string | undefined): string {
  const fmt = (numFmt ?? "General").trim();
  if (value instanceof Date) {
    if (!fmt || /^general$/i.test(fmt) || !isDateFormat(stripBrackets(splitSections(fmt)[0]))) {
      return value.toISOString().slice(0, 10);
    }
    return formatDateSection(value, stripBrackets(splitSections(fmt)[0]));
  }
  if (!fmt || /^general$/i.test(fmt) || fmt === "@") return generalNumber(value);
  const sections = splitSections(fmt).map(stripBrackets);
  let sec = sections[0];
  let forceSign = true;
  if (value < 0 && sections[1] !== undefined && sections[1] !== "") {
    sec = sections[1];
    forceSign = false;
  } else if (value === 0 && sections[2] !== undefined && sections[2] !== "") {
    sec = sections[2];
  }
  if (isDateFormat(sec)) return formatDateSection(serialToDate(value), sec);
  if (/^general$/i.test(sec.trim())) return generalNumber(value);
  return formatNumberSection(value, sec, forceSign);
}

// ---------------------------------------------------------------------------
// XLSX via exceljs
// ---------------------------------------------------------------------------

type ExcelJsModule = typeof import("exceljs");
type ExCell = import("exceljs").Cell;

function argbToRgb(argb: unknown): RGB | undefined {
  if (typeof argb !== "string" || !/^[0-9a-f]{8}$/i.test(argb)) return undefined;
  const n = parseInt(argb.slice(2), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function cellText(cell: ExCell): { text: string; kind: "number" | "text" | "bool" | "error" } {
  const fmt = cell.numFmt;
  const show = (v: unknown): { text: string; kind: "number" | "text" | "bool" | "error" } => {
    if (v === null || v === undefined) return { text: "", kind: "text" };
    if (typeof v === "number") return { text: formatValue(v, fmt), kind: "number" };
    if (v instanceof Date) return { text: formatValue(v, fmt), kind: "number" };
    if (typeof v === "boolean") return { text: v ? "TRUE" : "FALSE", kind: "bool" };
    if (typeof v === "string") return { text: v, kind: "text" };
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if ("error" in o) return { text: String(o.error), kind: "error" };
      if (Array.isArray(o.richText)) return { text: (o.richText as { text: string }[]).map((r) => r.text).join(""), kind: "text" };
      if ("formula" in o || "sharedFormula" in o) return show(o.result);
      if ("hyperlink" in o) return show(o.text);
      if ("text" in o) return show(o.text);
    }
    return { text: String(v), kind: "text" };
  };
  return show(cell.value);
}

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export async function readXlsx(data: ArrayBuffer, loadExcel: () => Promise<ExcelJsModule>): Promise<SheetData[]> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const sheets: SheetData[] = [];
  wb.eachSheet((ws) => {
    const rows: (CellData | null)[][] = [];
    const hiddenRows = new Set<number>();
    const hiddenCols = new Set<number>();
    const colWidths: (number | undefined)[] = [];
    const maxCol = ws.columnCount;
    for (let c = 1; c <= maxCol; c++) {
      const col = ws.getColumn(c);
      if (col.hidden) hiddenCols.add(c - 1);
      colWidths[c - 1] = col.width;
    }
    ws.eachRow({ includeEmpty: false }, (row, rn) => {
      if (row.hidden) hiddenRows.add(rn - 1);
      const out: (CellData | null)[] = [];
      row.eachCell({ includeEmpty: false }, (cell, cn) => {
        if (cell.isMerged && cell.master !== cell) {
          out[cn - 1] = { text: "", align: "left", covered: true };
          return;
        }
        const { text, kind } = cellText(cell);
        const style = cell.style ?? {};
        const fill =
          style.fill && style.fill.type === "pattern" && style.fill.pattern === "solid"
            ? argbToRgb((style.fill.fgColor as { argb?: string } | undefined)?.argb)
            : undefined;
        const h = style.alignment?.horizontal;
        const align: Align =
          h === "center" || h === "centerContinuous" ? "center" : h === "right" ? "right" : h === "left" ? "left" : kind === "number" ? "right" : kind === "text" ? "left" : "center";
        const b = style.border;
        const border = b
          ? { top: !!b.top?.style, bottom: !!b.bottom?.style, left: !!b.left?.style, right: !!b.right?.style }
          : undefined;
        if (!text && !fill && !border) return;
        out[cn - 1] = {
          text,
          align,
          bold: !!style.font?.bold,
          italic: !!style.font?.italic,
          fill: fill && !(fill.red > 0.99 && fill.green > 0.99 && fill.blue > 0.99) ? fill : undefined,
          color: argbToRgb((style.font?.color as { argb?: string } | undefined)?.argb),
          border,
        };
      });
      rows[rn - 1] = out;
    });
    // Horizontal merges: let the master cell's text use the merged width.
    const merges: string[] = ((ws.model as unknown as { merges?: string[] }).merges ?? []).filter(Boolean);
    for (const range of merges) {
      const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
      if (!m) continue;
      const r = +m[2] - 1;
      const c0 = colIndex(m[1]) - 1;
      const c1 = colIndex(m[3]) - 1;
      const master = rows[r]?.[c0];
      if (master && c1 > c0) master.span = c1 - c0 + 1;
    }
    for (let r = 0; r < rows.length; r++) if (!rows[r]) rows[r] = [];
    sheets.push({
      name: ws.name,
      hidden: ws.state !== "visible",
      rows,
      hiddenRows,
      hiddenCols,
      colWidths,
    });
  });
  return sheets;
}

/** True when the sheet has at least one non-empty cell. */
export function sheetHasContent(s: SheetData): boolean {
  return s.rows.some((r) => r?.some((c) => c && (c.text || c.fill)));
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export type PdfOptions = {
  pageSize: "a4" | "letter";
  orientation: "auto" | "portrait" | "landscape";
  fitWidth: boolean;
  gridlines: boolean;
  repeatHeader: boolean;
  overflow: "wrap" | "truncate";
  onProgress?: (fraction: number) => void;
};

export type PdfResult = { bytes: Uint8Array; pages: number; replaced: number; samples: string[]; splitColumns: boolean };

const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
const MARGIN = 36;
const PAD = 3;
const BASE_FONT = 9;
const MIN_FONT = 6;
const GRID = rgb(0.75, 0.75, 0.75);
const HEADER_FILL = rgb(0.93, 0.93, 0.93);

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };

function fontFor(f: Fonts, c: CellData | null | undefined, header: boolean): PDFFont {
  const bold = header || !!c?.bold;
  const italic = !!c?.italic;
  return bold ? (italic ? f.boldItalic : f.bold) : italic ? f.italic : f.regular;
}

function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/(\s+)/).filter((w) => w !== "");
    let line = "";
    for (const w of words) {
      const candidate = line + w;
      if (!line || font.widthOfTextAtSize(candidate.trimEnd(), size) <= width) {
        line = candidate;
        // A single word longer than the column: break it by characters.
        while (font.widthOfTextAtSize(line.trimEnd(), size) > width && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      } else {
        out.push(line.trimEnd());
        line = /^\s+$/.test(w) ? "" : w;
        while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

function truncate(text: string, font: PDFFont, size: number, width: number): string {
  const first = text.split("\n")[0];
  if (font.widthOfTextAtSize(first, size) <= width) return first;
  let lo = 0;
  let hi = first.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (font.widthOfTextAtSize(first.slice(0, mid) + "…", size) <= width) lo = mid;
    else hi = mid - 1;
  }
  return first.slice(0, lo).trimEnd() + "…";
}

/** Shrink the widest columns until the total fits (water-filling). */
function capWidths(widths: number[], target: number, min: number): number[] | null {
  const total = widths.reduce((a, b) => a + b, 0);
  if (total <= target) return widths;
  if (widths.length * min > target) return null;
  let lo = min;
  let hi = Math.max(...widths);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const sum = widths.reduce((a, w) => a + Math.min(w, mid), 0);
    if (sum > target) hi = mid;
    else lo = mid;
  }
  return widths.map((w) => Math.min(w, lo));
}

export async function sheetsToPdf(sheets: SheetData[], opts: PdfOptions): Promise<PdfResult> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const san: Sanitizer = createSanitizer();
  let splitColumns = false;
  const footers: { page: PDFPage; sheet: string }[] = [];
  const totalRows = sheets.reduce((n, s) => n + s.rows.length, 0) || 1;
  let doneRows = 0;

  for (const sheet of sheets) {
    // Visible used range.
    let maxCol = 0;
    let firstRow = -1;
    let lastRow = -1;
    sheet.rows.forEach((r, ri) => {
      if (sheet.hiddenRows.has(ri) || !r) return;
      r.forEach((c, ci) => {
        if (c && (c.text || c.fill || c.border) && !c.covered) {
          maxCol = Math.max(maxCol, ci + (c.span ?? 1));
          if (firstRow < 0) firstRow = ri;
          lastRow = ri;
        }
      });
    });
    if (firstRow < 0) continue;
    const cols = Array.from({ length: maxCol }, (_, i) => i).filter((c) => !sheet.hiddenCols.has(c));
    const rowIdx: number[] = [];
    for (let r = firstRow; r <= lastRow; r++) if (!sheet.hiddenRows.has(r)) rowIdx.push(r);
    const text = (r: number, c: number) => {
      const cell = sheet.rows[r]?.[c];
      return cell && !cell.covered ? san.clean(cell.text) : "";
    };
    // The header is the first row with most columns filled; a title row above it isn't repeated.
    const filledIn = (r: number) => cols.filter((c) => sheet.rows[r]?.[c]?.text).length;
    const widest = Math.max(...rowIdx.slice(0, 20).map(filledIn));
    let headerIndex = rowIdx.slice(0, 3).findIndex((r) => filledIn(r) >= Math.max(2, widest * 0.5));
    if (headerIndex < 0) headerIndex = 0;

    // Natural widths at the base size.
    const natural = cols.map((c) => {
      let w = 0;
      for (const r of rowIdx) {
        const cell = sheet.rows[r]?.[c];
        if (!cell || cell.covered || (cell.span ?? 1) > 1) continue;
        const f = fontFor(fonts, cell, opts.repeatHeader && r === rowIdx[headerIndex]);
        for (const line of text(r, c).split("\n")) w = Math.max(w, f.widthOfTextAtSize(line, BASE_FONT));
      }
      const set = sheet.colWidths[c];
      const fromFile = set ? set * 5.2 * (BASE_FONT / 11) : 0;
      return Math.min(260, Math.max(28, w + 2 * PAD + 1, fromFile));
    });
    const naturalTotal = natural.reduce((a, b) => a + b, 0);

    const [pw, ph] = SIZES[opts.pageSize];
    const landscape =
      opts.orientation === "landscape" || (opts.orientation === "auto" && naturalTotal > pw - 2 * MARGIN);
    const pageW = landscape ? ph : pw;
    const pageH = landscape ? pw : ph;
    const avail = pageW - 2 * MARGIN;

    // Decide font size, widths and column groups.
    let size = BASE_FONT;
    let widths = natural.slice();
    let groups: number[][] = [cols.map((_, i) => i)];
    if (naturalTotal > avail) {
      if (opts.fitWidth) {
        const scale = Math.max(MIN_FONT / BASE_FONT, avail / naturalTotal);
        size = BASE_FONT * scale;
        widths = natural.map((w) => w * scale);
        const capped = capWidths(widths, avail, Math.max(22, size * 3));
        if (capped) widths = capped;
        else groups = [];
      } else groups = [];
      if (!groups.length) {
        // Too many columns for one page: print them in groups, like Excel does.
        splitColumns = true;
        groups = [];
        let cur: number[] = [];
        let w = 0;
        widths = widths.map((x) => Math.min(x, avail));
        // Repeat the first column (usually row labels) on every group when it's narrow.
        const repeatFirst = widths[0] <= avail * 0.3;
        widths.forEach((x, i) => {
          if (cur.length && w + x > avail) {
            groups.push(cur);
            cur = repeatFirst ? [0] : [];
            w = repeatFirst ? widths[0] : 0;
          }
          cur.push(i);
          w += x;
        });
        if (cur.length) groups.push(cur);
      }
    }
    const lineH = size * 1.25;

    for (const group of groups) {
      let page: PDFPage | null = null;
      let y = 0;
      const newPage = () => {
        page = doc.addPage([pageW, pageH]);
        footers.push({ page, sheet: sheet.name });
        y = pageH - MARGIN;
      };

      // Pre-compute the lines of a row inside this group.
      const layoutRow = (r: number, header: boolean) => {
        const cells = group.map((gi, k) => {
          const c = cols[gi];
          const cell = sheet.rows[r]?.[c];
          let w = widths[gi];
          // A merged cell spans the next columns of the group.
          const span = cell?.span ?? 1;
          for (let s = 1; s < span && k + s < group.length && cols[group[k + s]] < c + span; s++) w += widths[group[k + s]];
          const f = fontFor(fonts, cell, header && opts.repeatHeader);
          const t = text(r, c);
          const inner = Math.max(4, w - 2 * PAD);
          const lines = !t ? [] : opts.overflow === "wrap" ? wrapText(t, f, size, inner) : [truncate(t, f, size, inner)];
          return { cell, font: f, lines, width: w };
        });
        const h = Math.max(1, ...cells.map((x) => x.lines.length)) * lineH + 2 * PAD - (lineH - size) / 2;
        return { cells, h };
      };

      const drawRow = (r: number, row: ReturnType<typeof layoutRow>, header: boolean) => {
        const pg = page as unknown as PDFPage;
        let x = MARGIN;
        const covered = new Set<number>();
        row.cells.forEach((c, k) => {
          const w = widths[group[k]];
          if (covered.has(k)) {
            x += w;
            return;
          }
          const span = c.cell?.span ?? 1;
          const c0 = cols[group[k]];
          for (let s = 1; s < span && k + s < group.length && cols[group[k + s]] < c0 + span; s++) covered.add(k + s);
          const fill = c.cell?.fill ?? (header && opts.repeatHeader ? HEADER_FILL : undefined);
          if (fill) pg.drawRectangle({ x, y: y - row.h, width: c.width, height: row.h, color: fill });
          if (opts.gridlines) {
            pg.drawRectangle({ x, y: y - row.h, width: c.width, height: row.h, borderColor: GRID, borderWidth: 0.4 });
          }
          const b = c.cell?.border;
          if (b) {
            const line = (x1: number, y1: number, x2: number, y2: number) =>
              pg.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.6, color: rgb(0, 0, 0) });
            if (b.top) line(x, y, x + c.width, y);
            if (b.bottom) line(x, y - row.h, x + c.width, y - row.h);
            if (b.left) line(x, y, x, y - row.h);
            if (b.right) line(x + c.width, y, x + c.width, y - row.h);
          }
          c.lines.forEach((ln, li) => {
            if (!ln) return;
            const tw = c.font.widthOfTextAtSize(ln, size);
            const align = c.cell?.align ?? "left";
            const tx = align === "right" ? x + c.width - PAD - tw : align === "center" ? x + (c.width - tw) / 2 : x + PAD;
            pg.drawText(ln, {
              x: tx,
              y: y - PAD - size * 0.82 - li * lineH,
              size,
              font: c.font,
              color: c.cell?.color ?? rgb(0, 0, 0),
            });
          });
          x += w;
        });
        void r;
        y -= row.h;
      };

      const headerAt = headerIndex;
      const headerRow = rowIdx[headerAt];
      const headerLayout = opts.repeatHeader ? layoutRow(headerRow, true) : null;
      newPage();
      for (let i = 0; i < rowIdx.length; i++) {
        const r = rowIdx[i];
        const isHeader = opts.repeatHeader && i === headerAt;
        const row = isHeader && headerLayout ? headerLayout : layoutRow(r, false);
        const maxH = pageH - 2 * MARGIN - 14 - (headerLayout?.h ?? 0);
        if (row.h > maxH) {
          // A single cell taller than a page: cut its lines to fit.
          const keep = Math.max(1, Math.floor((maxH - 2 * PAD) / lineH));
          row.cells.forEach((c) => {
            if (c.lines.length > keep) c.lines = [...c.lines.slice(0, keep - 1), "…"];
          });
          row.h = keep * lineH + 2 * PAD;
        }
        if (y - row.h < MARGIN + 14 && !(i === 0)) {
          newPage();
          if (headerLayout && i > headerAt) drawRow(headerRow, headerLayout, true);
        }
        drawRow(r, row, isHeader);
        if (++doneRows % 200 === 0) {
          opts.onProgress?.(Math.min(0.98, doneRows / (totalRows * groups.length)));
          await new Promise((res) => setTimeout(res));
        }
      }
    }
  }

  if (!footers.length) throw new Error("These sheets are empty, so there's nothing to put in a PDF.");
  const total = footers.length;
  footers.forEach(({ page, sheet }, i) => {
    const label = san.clean(`${sheet} · Page ${i + 1} of ${total}`);
    const w = fonts.regular.widthOfTextAtSize(label, 7);
    page.drawText(label, { x: page.getWidth() - MARGIN - w, y: MARGIN / 2, size: 7, font: fonts.regular, color: rgb(0.45, 0.45, 0.45) });
  });
  doc.setProducer("PDFCompact");
  doc.setCreator("PDFCompact Excel to PDF");
  const bytes = await doc.save();
  return { bytes, pages: total, replaced: san.replaced(), samples: san.samples(), splitColumns };
}
