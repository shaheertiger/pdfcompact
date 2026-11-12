/**
 * Table extraction from PDF text positions (pdf.js getTextContent), plus
 * cell parsing (numbers, dates) and .xlsx writing with exceljs.
 *
 * No "@/..." imports and no DOM access here, so the logic can be unit-tested
 * in Node with type stripping.
 */

// ---------------------------------------------------------------------------
// 1. Text items → chunks → rows
// ---------------------------------------------------------------------------

/** A run of text on one line, in PDF user space (y grows upwards). */
export type Chunk = {
  str: string;
  x: number;
  y: number;
  w: number;
  size: number;
  font: string;
};

export type Row = { y: number; size: number; chunks: Chunk[] };

type RawItem = { str?: string; transform?: number[]; width?: number; height?: number; fontName?: string };

/**
 * Turn pdf.js text items into chunks: items on the same line that sit close
 * together are merged ("Grocery" + "store" → "Grocery store"), wide gaps
 * start a new chunk. Rotated text is skipped.
 */
export function chunksFromItems(items: unknown[]): Chunk[] {
  const raw: Chunk[] = [];
  for (const it of items as RawItem[]) {
    if (!it || typeof it.str !== "string" || !it.transform) continue;
    const [a, b, c, d, e, f] = it.transform;
    if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) continue; // rotated or skewed
    const str = it.str.replace(/\s+/g, " ");
    if (!str.trim()) continue;
    const size = Math.abs(d) || Math.abs(a) || it.height || 10;
    raw.push({ str, x: e, y: f, w: it.width ?? str.length * size * 0.5, size, font: it.fontName ?? "" });
  }
  raw.sort((p, q) => q.y - p.y || p.x - q.x);

  // Group into lines first, then merge horizontally inside each line.
  const out: Chunk[] = [];
  for (const line of groupLines(raw)) {
    line.sort((p, q) => p.x - q.x);
    let cur: Chunk | null = null;
    for (const it of line) {
      if (cur) {
        const gap = it.x - (cur.x + cur.w);
        const em = Math.max(cur.size, it.size);
        if (gap < 0.55 * em && gap > -0.5 * em) {
          const needsSpace = gap > 0.12 * em && !cur.str.endsWith(" ") && !it.str.startsWith(" ");
          cur.str += (needsSpace ? " " : "") + it.str;
          cur.w = it.x + it.w - cur.x;
          cur.size = Math.max(cur.size, it.size);
          continue;
        }
        out.push(finish(cur));
      }
      cur = { ...it };
    }
    if (cur) out.push(finish(cur));
  }
  return out;
}

function finish(c: Chunk): Chunk {
  return { ...c, str: c.str.trim() };
}

function groupLines<T extends { y: number; size: number }>(sorted: T[]): T[][] {
  const lines: T[][] = [];
  let cur: T[] = [];
  let y = 0;
  let size = 0;
  for (const it of sorted) {
    if (cur.length && Math.abs(it.y - y) <= 0.45 * Math.min(size, it.size)) {
      cur.push(it);
    } else {
      if (cur.length) lines.push(cur);
      cur = [it];
      y = it.y;
      size = it.size;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

/** Cluster chunks into visual rows, top to bottom, each row sorted left to right. */
export function rowsFromChunks(chunks: Chunk[]): Row[] {
  const sorted = [...chunks].sort((p, q) => q.y - p.y || p.x - q.x);
  return groupLines(sorted).map((cs) => {
    cs.sort((p, q) => p.x - q.x);
    return {
      y: cs.reduce((n, c) => n + c.y, 0) / cs.length,
      size: Math.max(...cs.map((c) => c.size)),
      chunks: cs,
    };
  });
}

// ---------------------------------------------------------------------------
// 2. Rows → tables
// ---------------------------------------------------------------------------

export type Column = { x0: number; x1: number };

export type Table = {
  kind: "table";
  columns: Column[];
  rows: string[][];
  /** First row looks like a header (all text, numbers below). */
  header: boolean;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type TextLine = {
  kind: "text";
  text: string;
  y: number;
  size: number;
  x: number;
  /** Separate pieces on the line, kept so a header orphaned at a page bottom can rejoin its table. */
  parts: { str: string; x0: number; x1: number }[];
};

export type PageBlock = Table | TextLine;

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Split a page's rows into table blocks and plain text lines, in reading order.
 * A table is a run of rows with 2+ separated chunks whose columns line up.
 */
export function detectBlocks(rows: Row[]): PageBlock[] {
  if (!rows.length) return [];
  const left = Math.min(...rows.flatMap((r) => r.chunks.map((c) => c.x)));
  const right = Math.max(...rows.flatMap((r) => r.chunks.map((c) => c.x + c.w)));
  const contentW = Math.max(1, right - left);

  const blocks: PageBlock[] = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i].chunks.length < 2) {
      blocks.push(textLine(rows[i]));
      i++;
      continue;
    }
    // Grow a candidate block.
    let j = i + 1;
    const pitches: number[] = [];
    while (j < rows.length) {
      const r = rows[j];
      const gap = rows[j - 1].y - r.y;
      const typical = pitches.length ? median(pitches) : 1.8 * r.size;
      const limit = Math.max(2.6 * r.size, 1.7 * typical);
      if (gap > limit) break;
      const multi = r.chunks.length >= 2;
      const narrowSingle = r.chunks.length === 1 && r.chunks[0].w < 0.4 * contentW;
      if (!multi && !narrowSingle) break;
      pitches.push(gap);
      j++;
    }
    // Trim trailing single-chunk rows; they belong to the text after the table.
    while (j - 1 > i && rows[j - 1].chunks.length < 2) j--;
    const candidate = rows.slice(i, j);
    const multiRows = candidate.filter((r) => r.chunks.length >= 2).length;
    const table = multiRows >= 2 ? buildTable(candidate) : null;
    if (table) {
      blocks.push(table);
    } else {
      for (const r of candidate) blocks.push(textLine(r));
    }
    i = j;
  }
  return blocks;
}

function textLine(r: Row): TextLine {
  return {
    kind: "text",
    text: r.chunks.map((c) => c.str).join(" "),
    y: r.y,
    size: r.size,
    x: r.chunks[0]?.x ?? 0,
    parts: r.chunks.map((c) => ({ str: c.str, x0: c.x, x1: c.x + c.w })),
  };
}

/** Find columns by how many rows cover each x position, then fill a grid. */
export function buildTable(rows: Row[]): Table | null {
  const all = rows.flatMap((r) => r.chunks);
  const left = Math.floor(Math.min(...all.map((c) => c.x)));
  const right = Math.ceil(Math.max(...all.map((c) => c.x + c.w)));
  const width = right - left + 1;
  if (width <= 0) return null;
  const count = new Uint16Array(width);
  rows.forEach((r) => {
    const seen = new Uint8Array(width);
    for (const c of r.chunks) {
      const a = Math.max(0, Math.floor(c.x) - left);
      const b = Math.min(width - 1, Math.ceil(c.x + c.w) - left);
      for (let x = a; x <= b; x++) seen[x] = 1;
    }
    for (let x = 0; x < width; x++) count[x] += seen[x];
  });
  const n = rows.length;
  // Bins covered by only a few rows (a title or one long cell) don't join columns together.
  const gapThr = n >= 12 ? Math.floor(n * 0.05) : 0;
  const regions: { x0: number; x1: number; support: number }[] = [];
  let start = -1;
  let peak = 0;
  for (let x = 0; x <= width; x++) {
    const on = x < width && count[x] > gapThr;
    if (on && start < 0) {
      start = x;
      peak = 0;
    }
    if (on) peak = Math.max(peak, count[x]);
    if (!on && start >= 0) {
      regions.push({ x0: start + left, x1: x - 1 + left, support: peak });
      start = -1;
    }
  }
  // Columns used by a single row (often a centred header cell) are folded into
  // the nearest real column instead of becoming a column of their own.
  const weakThr = n >= 3 ? Math.max(1, Math.floor(n * 0.08)) : 0;
  const columns = regions.filter((r) => r.support > weakThr).map(({ x0, x1 }) => ({ x0, x1 }));
  if (columns.length < 2) return null;

  const grid: string[][] = rows.map((r) => {
    const cells: string[] = columns.map(() => "");
    for (const c of r.chunks) {
      const k = bestColumn(columns, c.x, c.x + c.w);
      cells[k] = cells[k] ? `${cells[k]} ${c.str}` : c.str;
    }
    return cells;
  });

  // Every row needs content in 2+ columns for most of the block, or it isn't a table.
  const filled2 = grid.filter((cells) => cells.filter(Boolean).length >= 2).length;
  if (filled2 < Math.max(2, Math.ceil(n * 0.5))) return null;

  // Side-by-side columns of prose (a two-column layout) aren't a table.
  const cellsFlat = grid.flat().filter(Boolean);
  const avgLen = cellsFlat.reduce((s, c) => s + c.length, 0) / Math.max(1, cellsFlat.length);
  const anyNumeric = cellsFlat.some((c) => parseCell(c).kind !== "text");
  if (avgLen > 40 && !anyNumeric) return null;

  const merged = mergeContinuationRows(rows, grid);
  return {
    kind: "table",
    columns,
    rows: merged,
    header: looksLikeHeader(merged),
    top: rows[0].y + rows[0].size,
    bottom: rows[rows.length - 1].y,
    left,
    right,
  };
}

export function bestColumn(columns: Column[], x0: number, x1: number): number {
  let best = 0;
  let bestOverlap = -Infinity;
  columns.forEach((col, k) => {
    const overlap = Math.min(x1, col.x1) - Math.max(x0, col.x0);
    // overlap is negative (a distance) when there is none; the nearest column wins.
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = k;
    }
  });
  return best;
}

/**
 * A cell that wraps onto a second line shows up as an extra row with one or two
 * text cells. Fold it into the row above when it sits closer than a normal row
 * or when the key column (usually a date) is empty while it's filled almost everywhere.
 */
function mergeContinuationRows(rows: Row[], grid: string[][]): string[][] {
  if (grid.length < 3) return grid;
  const pitch = median(rows.slice(1).map((r, k) => rows[k].y - r.y));
  const col0Filled = grid.filter((g) => g[0]).length / grid.length;
  const out: string[][] = [grid[0].slice()];
  for (let k = 1; k < grid.length; k++) {
    const cells = grid[k];
    const filled = cells.map((c, idx) => (c ? idx : -1)).filter((idx) => idx >= 0);
    const numeric = filled.some((idx) => parseCell(cells[idx]).kind !== "text");
    const prev = out[out.length - 1];
    const gap = rows[k - 1].y - rows[k].y;
    const tight = gap < 0.75 * pitch;
    const orphan =
      filled.length === 1 && !cells[0] && col0Filled >= 0.8 && !!prev[filled[0]] && parseCell(prev[filled[0]]).kind === "text";
    const fewer = filled.length < Math.max(2, prev.filter(Boolean).length);
    if (!numeric && filled.length > 0 && fewer && (tight || orphan)) {
      for (const idx of filled) prev[idx] = prev[idx] ? `${prev[idx]} ${cells[idx]}` : cells[idx];
    } else {
      out.push(cells.slice());
    }
  }
  return out;
}

function looksLikeHeader(grid: string[][]): boolean {
  if (grid.length < 2) return false;
  const first = grid[0];
  const filled = first.filter(Boolean);
  if (filled.length < 2) return false;
  if (filled.some((c) => parseCell(c).kind !== "text")) return false;
  return grid.slice(1).some((r) => r.some((c) => parseCell(c).kind !== "text")) || filled.length === first.length;
}

// ---------------------------------------------------------------------------
// 3. Cell parsing
// ---------------------------------------------------------------------------

export type Parsed =
  | { kind: "number"; value: number; fmt: string }
  | { kind: "date"; value: Date; fmt: string }
  | { kind: "text"; value: string };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const CURRENCY: Record<string, string> = { $: '"$"', "€": '"€"', "£": '"£"', "¥": '"¥"', "₹": '"₹"' };

function validDate(y: number, m: number, d: number): Date | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
}

/** Parse a cell string into a real number or date when that's unambiguous. */
export function parseCell(input: string): Parsed {
  const s = input.trim();
  if (!s) return { kind: "text", value: "" };

  // Dates: ISO only for numeric forms (03/04/2026 could be March or April).
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const dt = validDate(+m[1], +m[2], +m[3]);
    if (dt) return { kind: "date", value: dt, fmt: "yyyy-mm-dd" };
  }
  m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3,9})\.?[ -](\d{4})$/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    const dt = mi >= 0 && monthNameOk(m[2]) ? validDate(+m[3], mi + 1, +m[1]) : null;
    if (dt) return { kind: "date", value: dt, fmt: "d mmm yyyy" };
  }
  m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/);
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    const dt = mi >= 0 && monthNameOk(m[1]) ? validDate(+m[3], mi + 1, +m[2]) : null;
    if (dt) return { kind: "date", value: dt, fmt: "mmm d, yyyy" };
  }

  // Numbers.
  let t = s.replace(/[  ]/g, " ");
  let negative = false;
  let currency = "";
  let percent = false;
  if (/^\(.*\)$/.test(t)) {
    negative = true;
    t = t.slice(1, -1).trim();
  }
  if (/^[-−–]/.test(t)) {
    negative = !negative;
    t = t.slice(1).trim();
  }
  const cur = t.match(/^([$€£¥₹])\s?/) ?? t.match(/\s?([$€£¥₹])$/);
  if (cur) {
    currency = cur[1];
    t = t.startsWith(cur[0]) ? t.slice(cur[0].length) : t.slice(0, -cur[0].length);
  }
  if (/^[-−–]/.test(t)) {
    negative = !negative;
    t = t.slice(1).trim();
  }
  if (/[-−–]$/.test(t) && t.length > 1) {
    negative = !negative; // trailing minus, as some bank statements print
    t = t.slice(0, -1).trim();
  }
  if (t.endsWith("%")) {
    percent = true;
    t = t.slice(0, -1).trim();
  }

  let value: number | null = null;
  let decimals = 0;
  let grouped = false;
  if (/^\d+(\.\d+)?$/.test(t) || /^\.\d+$/.test(t)) {
    if (/^0\d/.test(t) && !t.includes(".")) return { kind: "text", value: s }; // codes like 00123 keep their zeros
    value = parseFloat(t);
    decimals = t.split(".")[1]?.length ?? 0;
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) {
    value = parseFloat(t.replace(/,/g, ""));
    decimals = t.split(".")[1]?.length ?? 0;
    grouped = true;
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) || /^\d{1,3}( \d{3})+(,\d+)?$/.test(t)) {
    value = parseFloat(t.replace(/[. ]/g, "").replace(",", "."));
    decimals = t.split(",")[1]?.length ?? 0;
    grouped = true;
  } else if (/^\d+,\d{1,2}$/.test(t)) {
    value = parseFloat(t.replace(",", "."));
    decimals = t.split(",")[1].length;
  }
  if (value === null || !Number.isFinite(value) || t.replace(/\D/g, "").length > 15) {
    return { kind: "text", value: s };
  }
  if (negative) value = -value;
  const dec = decimals ? "." + "0".repeat(Math.min(decimals, 10)) : "";
  if (percent) return { kind: "number", value: value / 100, fmt: `0${dec}%` };
  const base = (grouped || currency ? "#,##0" : "0") + dec;
  return { kind: "number", value, fmt: currency ? `${CURRENCY[currency]}${base}` : base };
}

function monthNameOk(word: string): boolean {
  const w = word.toLowerCase().replace(/\.$/, "");
  const full = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "sept"];
  return w.length === 3 || full.includes(w);
}

// ---------------------------------------------------------------------------
// 4. Pages → sheets
// ---------------------------------------------------------------------------

export type SheetRow = { cells: string[]; header?: boolean };
export type Sheet = { name: string; rows: SheetRow[] };

export type PageResult = { page: number; blocks: PageBlock[]; textChars: number };

export type SheetMode = "per-page" | "single";

function rowKey(cells: string[]) {
  return cells.map((c) => c.trim().toLowerCase()).join("|");
}

/** Map the columns of `b` onto `a` when every column of b lines up with one of a, in order. */
function columnMap(a: Column[], b: Column[]): number[] | null {
  const map: number[] = [];
  let last = -1;
  for (const col of b) {
    let best = -1;
    let bestOverlap = 0;
    a.forEach((ac, k) => {
      const ov = Math.min(ac.x1, col.x1) - Math.max(ac.x0, col.x0);
      if (ov > bestOverlap) {
        bestOverlap = ov;
        best = k;
      }
    });
    if (best <= last) return null;
    map.push(best);
    last = best;
  }
  return map;
}

/** Page furniture (running headers, footers, page numbers) is at most this many lines per side. */
const FURNITURE_LINES = 3;

/**
 * Build sheets from per-page blocks. In "single" mode a table that continues
 * on the next page with the same columns is joined onto the same table: a
 * repeated header row is dropped, and the few lines of footer/header text
 * between the two parts are treated as page furniture and skipped. A header
 * row left alone at the bottom of a page rejoins its table on the next page.
 */
export function buildSheets(pages: PageResult[], mode: SheetMode, includeText: boolean): Sheet[] {
  const sheets: Sheet[] = [];
  let sheet: Sheet | null = null;
  let lastTable: Table | null = null;
  let lastHeader: string | null = null;
  /** Text after the last table of the previous page (single mode). */
  let deferred: TextLine[] = [];

  const out = () => sheet as Sheet;
  const pushBlank = () => {
    const s = out();
    if (s.rows.length && s.rows[s.rows.length - 1].cells.some(Boolean)) s.rows.push({ cells: [] });
  };
  const emitText = (lines: TextLine[]) => {
    if (!includeText || !lines.length) return;
    if (lastTable) pushBlank();
    for (const l of lines) out().rows.push({ cells: l.parts.map((x) => x.str) });
  };
  const emitTable = (t: Table, rows: string[][], header: boolean) => {
    pushBlank();
    rows.forEach((cells, k) => out().rows.push({ cells, header: header && k === 0 }));
    lastHeader = header && rows.length ? rowKey(rows[0]) : null;
    lastTable = t;
  };
  /** Try to use a multi-part line as the header of table t. */
  const asHeader = (line: TextLine, t: Table): string[] | null => {
    if (line.parts.length < 2 || t.header) return null;
    const cells = t.columns.map(() => "");
    const used = new Set<number>();
    for (const part of line.parts) {
      const k = bestColumn(t.columns, part.x0, part.x1);
      used.add(k);
      cells[k] = cells[k] ? `${cells[k]} ${part.str}` : part.str;
    }
    return used.size >= 2 && cells.every((c) => parseCell(c).kind === "text") ? cells : null;
  };

  for (const p of pages) {
    if (mode === "per-page" || !sheet) {
      if (sheet) emitText(deferred);
      sheet = { name: mode === "per-page" ? `Page ${p.page}` : "Tables", rows: [] };
      sheets.push(sheet);
      lastTable = null;
      lastHeader = null;
      deferred = [];
    }

    if (mode === "per-page") {
      for (const b of p.blocks) {
        if (b.kind === "text") emitText([b]);
        else emitTable(b, b.rows, b.header);
        if (b.kind === "text") lastTable = null;
      }
      continue;
    }

    const firstT = p.blocks.findIndex((b) => b.kind === "table");
    let lastT = -1;
    p.blocks.forEach((b, i) => {
      if (b.kind === "table") lastT = i;
    });
    if (firstT < 0) {
      // No table on this page: everything is plain text and the run of tables is broken.
      emitText([...deferred, ...(p.blocks as TextLine[])]);
      deferred = [];
      lastTable = null;
      continue;
    }
    const leading = p.blocks.slice(0, firstT) as TextLine[];
    const trailing = p.blocks.slice(lastT + 1) as TextLine[];

    p.blocks.slice(firstT, lastT + 1).forEach((b, k) => {
      if (b.kind === "text") {
        emitText([b]);
        lastTable = null;
        return;
      }
      if (k > 0) {
        emitTable(b, b.rows, b.header);
        return;
      }
      // First table on the page: does it continue the previous page's table?
      const map =
        lastTable && deferred.length <= FURNITURE_LINES && leading.length <= FURNITURE_LINES
          ? columnMap(lastTable.columns, b.columns)
          : null;
      if (map && lastTable) {
        const width = lastTable.columns.length;
        let rows = b.rows.map((r) => {
          const o = Array<string>(width).fill("");
          r.forEach((c, j) => (o[map[j]] = c));
          return o;
        });
        if (lastHeader && rows.length && rowKey(rows[0]) === lastHeader) rows = rows.slice(1);
        rows.forEach((cells) => out().rows.push({ cells }));
        deferred = [];
        return;
      }
      // Not a continuation. A header orphaned at the end of the previous page
      // (possibly followed by a footer line or two) can still belong to this table.
      const around = [...deferred, ...leading];
      let orphanAt = -1;
      let header: string[] | null = null;
      for (let j = around.length - 1, skipped = 0; j >= 0 && skipped <= 2; j--) {
        if (around[j].parts.length >= 2) {
          header = asHeader(around[j], b);
          if (header) orphanAt = j;
          break;
        }
        skipped++;
      }
      const before = orphanAt >= 0 ? around.filter((_, j) => j !== orphanAt) : around;
      lastTable = null;
      emitText(before);
      deferred = [];
      if (header) emitTable(b, [header, ...b.rows], true);
      else emitTable(b, b.rows, b.header);
    });
    deferred = trailing;
  }
  if (sheet) emitText(deferred);
  return sheets.filter((s) => s.rows.some((r) => r.cells.some(Boolean)));
}

// ---------------------------------------------------------------------------
// 5. Writing .xlsx
// ---------------------------------------------------------------------------

function displayLength(p: Parsed, raw: string): number {
  if (p.kind === "date") return 11;
  if (p.kind === "number") return raw.replace(/[()]/g, "").length + 1;
  return Math.max(...raw.split("\n").map((l) => l.length));
}

function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31).trim() || "Sheet";
  let n = 2;
  let out = base;
  while (used.has(out.toLowerCase())) {
    const suffix = ` (${n++})`;
    base = base.slice(0, 31 - suffix.length);
    out = base + suffix;
  }
  used.add(out.toLowerCase());
  return out;
}

type ExcelJsModule = typeof import("exceljs");

/** Write sheets to an .xlsx file. Numbers and ISO dates become real values. */
export async function writeXlsx(sheets: Sheet[], loadExcel: () => Promise<ExcelJsModule>): Promise<Uint8Array> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = "PDFCompact";
  wb.created = new Date();
  const used = new Set<string>();
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(safeSheetName(sheet.name, used));
    const widths: number[] = [];
    sheet.rows.forEach((r, ri) => {
      const row = ws.getRow(ri + 1);
      r.cells.forEach((raw, ci) => {
        if (!raw) return;
        const p = parseCell(raw);
        const cell = row.getCell(ci + 1);
        if (r.header || p.kind === "text") {
          cell.value = raw;
        } else {
          cell.value = p.value;
          cell.numFmt = p.fmt;
        }
        if (r.header) cell.font = { bold: true };
        widths[ci] = Math.max(widths[ci] ?? 0, displayLength(r.header ? { kind: "text", value: raw } : p, raw));
      });
      row.commit();
    });
    widths.forEach((w, ci) => {
      ws.getColumn(ci + 1).width = Math.min(60, Math.max(8, Math.ceil(w * 1.1) + 2));
    });
    if (sheet.rows[0]?.header) ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
