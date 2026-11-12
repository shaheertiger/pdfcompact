/**
 * Word-level PDF comparison: text extraction with word positions (pdf.js),
 * a Myers diff over word tokens, grouping into changes, and flags for the
 * changes that matter in contracts: numbers, money, percentages, dates and
 * negations. Also builds the redline PDF and the plain-text report.
 */
import type { PdfDoc } from "@/lib/pdfjs";

export type Rect = [number, number, number, number]; // PDF user space: x1, y1, x2, y2

export type Word = {
  /** Text as it appears in the PDF. */
  t: string;
  /** Normalised form used for comparison. */
  n: string;
  /** 1-based page number. */
  p: number;
  /** Line id (increments across the whole document). */
  line: number;
  /** Bounding box in PDF user space. */
  r: Rect;
  /** Box as fractions of the rendered page: left, top, width, height. */
  v: [number, number, number, number];
};

export type DocText = {
  words: Word[];
  numPages: number;
  /** Pages with no extractable text. */
  emptyPages: number;
};

export type Flag = "negation" | "date" | "money" | "percent" | "number";
export type ChangeType = "replaced" | "added" | "removed";

export type Change = {
  id: number;
  type: ChangeType;
  removed: Word[];
  added: Word[];
  flags: Flag[];
  /** Human note for negations, e.g. 'adds "not"'. */
  negationNote?: string;
  /** Page in the original / changed document to show for this change. */
  aPage: number;
  bPage: number;
  /** A few equal words before and after, from the changed document when possible. */
  before: string;
  after: string;
  /** For pure deletions: where the text used to be, in the changed document. */
  bAnchor?: { p: number; x: number; y: number; h: number };
  /** For pure insertions: where the text was added, in the original. */
  aAnchor?: { p: number; x: number; y: number; h: number };
};

export type CompareResult = {
  changes: Change[];
  wordsA: number;
  wordsB: number;
  method: "words" | "lines";
};

/* ------------------------------------------------------------------ */
/* Text extraction                                                     */
/* ------------------------------------------------------------------ */

// Rough relative glyph widths (Helvetica-like) so a word's box lands close to
// the real glyphs when pdf.js gives us one item for a whole line.
function charWidth(ch: string): number {
  if (" ".includes(ch)) return 0.28;
  if ("ijl.,:;'|!I`".includes(ch)) return 0.25;
  if ('ftr()[]{}-/\\"'.includes(ch)) return 0.36;
  if ("mwMW@".includes(ch)) return 0.86;
  if (/[0-9]/.test(ch)) return 0.556;
  if (/[A-Z]/.test(ch)) return 0.68;
  if (/[a-z]/.test(ch)) return 0.53;
  return 0.6;
}

export function normalizeToken(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ");
}

type TextItemLike = { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean };

/**
 * Extract every word with its position. Calls onPage after each page so the
 * caller can update a progress bar and yield to the UI thread.
 */
export async function extractWords(
  pdf: PdfDoc,
  onPage?: (page: number, total: number) => Promise<void> | void,
): Promise<DocText> {
  const words: Word[] = [];
  let line = 0;
  let emptyPages = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const [ta, tb, tc, td, te, tf] = vp.transform as number[];
    const toView = (x: number, y: number): [number, number] => [ta * x + tc * y + te, tb * x + td * y + tf];
    const content = await page.getTextContent();
    const before = words.length;

    let lastY: number | null = null;
    let lastEndX = 0;
    let lastFs = 10;
    let lastEndedWithSpace = true;
    line++;

    for (const raw of content.items) {
      if (!("str" in raw)) continue;
      const item = raw as TextItemLike;
      const str = item.str;
      if (!str) {
        if (item.hasEOL) {
          line++;
          lastEndedWithSpace = true;
        }
        continue;
      }
      const [a, b, c, d, e, f] = item.transform;
      const fs = Math.hypot(c, d) || Math.hypot(a, b) || item.height || 10;
      const len = Math.hypot(a, b) || 1;
      const dx = a / len;
      const dy = b / len;
      // Unit "up" vector perpendicular to the baseline.
      const ux = -dy;
      const uy = dx;
      const height = item.height || fs;

      const sameLine = lastY !== null && Math.abs(f - lastY) < fs * 0.45;
      if (lastY !== null && !sameLine) {
        line++;
        lastEndedWithSpace = true;
      }

      // Distribute the item's width over its characters.
      const chars = Array.from(str);
      const weights = chars.map(charWidth);
      const totalW = weights.reduce((s, w) => s + w, 0) || 1;
      const unit = item.width / totalW;
      const offsets: number[] = [];
      let acc = 0;
      for (const w of weights) {
        offsets.push(acc);
        acc += w * unit;
      }
      offsets.push(acc);

      const startX = e;
      const gap = sameLine ? Math.abs(startX - lastEndX) : Infinity;
      const joinsPrev = sameLine && !lastEndedWithSpace && !/^\s/.test(str) && gap < fs * 0.25 && words.length > before;

      let i = 0;
      let first = true;
      while (i < chars.length) {
        while (i < chars.length && /\s/.test(chars[i])) i++;
        if (i >= chars.length) break;
        const s = i;
        while (i < chars.length && !/\s/.test(chars[i])) i++;
        const text = chars.slice(s, i).join("");
        const o0 = offsets[s];
        const o1 = offsets[i];
        // Quad corners in user space.
        const bx0 = e + dx * o0;
        const by0 = f + dy * o0;
        const bx1 = e + dx * o1;
        const by1 = f + dy * o1;
        const desc = height * 0.22;
        const asc = height * 0.9;
        const pts: [number, number][] = [
          [bx0 - ux * desc, by0 - uy * desc],
          [bx1 - ux * desc, by1 - uy * desc],
          [bx0 + ux * asc, by0 + uy * asc],
          [bx1 + ux * asc, by1 + uy * asc],
        ];
        const xs = pts.map((q) => q[0]);
        const ys = pts.map((q) => q[1]);
        const r: Rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];

        if (first && joinsPrev && s === 0) {
          const prev = words[words.length - 1];
          prev.t += text;
          prev.n = normalizeToken(prev.t);
          prev.r = [
            Math.min(prev.r[0], r[0]),
            Math.min(prev.r[1], r[1]),
            Math.max(prev.r[2], r[2]),
            Math.max(prev.r[3], r[3]),
          ];
          prev.v = viewBox(prev.r, toView, vp.width, vp.height);
        } else {
          words.push({ t: text, n: normalizeToken(text), p, line, r, v: viewBox(r, toView, vp.width, vp.height) });
        }
        first = false;
      }

      lastY = f;
      lastEndX = e + dx * item.width;
      lastFs = fs;
      lastEndedWithSpace = /\s$/.test(str);
      if (item.hasEOL) {
        line++;
        lastEndedWithSpace = true;
        lastY = null;
      }
    }
    void lastFs;
    if (words.length === before) emptyPages++;
    page.cleanup();
    if (onPage) await onPage(p, pdf.numPages);
  }
  return { words, numPages: pdf.numPages, emptyPages };
}

function viewBox(
  r: Rect,
  toView: (x: number, y: number) => [number, number],
  w: number,
  h: number,
): [number, number, number, number] {
  const a = toView(r[0], r[1]);
  const b = toView(r[2], r[3]);
  const l = Math.min(a[0], b[0]);
  const t = Math.min(a[1], b[1]);
  return [l / w, t / h, Math.abs(b[0] - a[0]) / w, Math.abs(b[1] - a[1]) / h];
}

/* ------------------------------------------------------------------ */
/* Myers diff                                                          */
/* ------------------------------------------------------------------ */

const EQ = 0;
const DEL = 1;
const INS = 2;
type Op = [type: number, ai: number, bi: number];

/** Myers O(ND) diff. Returns null if more than maxD edits are needed. */
function myers(a: Int32Array, b: Int32Array, maxD: number): Op[] | null {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  if (max === 0) return [];
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  let found = -1;
  const limit = Math.min(max, maxD);
  outer: for (let d = 0; d <= limit; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) x = v[off + k + 1];
      else x = v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[off + k] = x;
      if (x >= n && y >= m) {
        trace.push(v.slice(off - d, off + d + 1));
        found = d;
        break outer;
      }
    }
    trace.push(v.slice(off - d, off + d + 1));
  }
  if (found < 0) return null;

  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const prev = trace[d - 1]; // indices -(d-1)..(d-1) → prev[k + d - 1]
    const k = x - y;
    const at = (kk: number) => prev[kk + d - 1];
    let prevK: number;
    if (k === -d || (k !== d && at(k - 1) < at(k + 1))) prevK = k + 1;
    else prevK = k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push([EQ, x - 1, y - 1]);
      x--;
      y--;
    }
    if (prevK === k + 1) ops.push([INS, -1, prevY]);
    else ops.push([DEL, prevX, -1]);
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    ops.push([EQ, x - 1, y - 1]);
    x--;
    y--;
  }
  return ops.reverse();
}

function diffWithFallback(a: Int32Array, b: Int32Array, maxD: number): Op[] {
  const r = myers(a, b, maxD);
  if (r) return r;
  const ops: Op[] = [];
  for (let i = 0; i < a.length; i++) ops.push([DEL, i, -1]);
  for (let j = 0; j < b.length; j++) ops.push([INS, -1, j]);
  return ops;
}

/** Diff two word lists, trimming the common prefix and suffix first. */
function diffTokens(a: Int32Array, b: Int32Array, maxD: number): Op[] | null {
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const mid = myers(a.subarray(pre, a.length - suf), b.subarray(pre, b.length - suf), maxD);
  if (!mid) return null;
  const ops: Op[] = [];
  for (let i = 0; i < pre; i++) ops.push([EQ, i, i]);
  for (const [t, ai, bi] of mid) ops.push([t, ai < 0 ? -1 : ai + pre, bi < 0 ? -1 : bi + pre]);
  for (let i = 0; i < suf; i++) ops.push([EQ, a.length - suf + i, b.length - suf + i]);
  return ops;
}

/**
 * Line-anchored diff for long, heavily changed documents: diff lines first,
 * then diff words inside each changed block. Keeps time and memory bounded.
 */
function diffByLines(A: Word[], B: Word[], ka: Int32Array, kb: Int32Array): Op[] {
  const group = (W: Word[]) => {
    const lines: { start: number; end: number }[] = [];
    for (let i = 0; i < W.length; i++) {
      if (i === 0 || W[i].line !== W[i - 1].line) lines.push({ start: i, end: i + 1 });
      else lines[lines.length - 1].end = i + 1;
    }
    return lines;
  };
  const la = group(A);
  const lb = group(B);
  const ids = new Map<string, number>();
  const key = (keys: Int32Array, l: { start: number; end: number }) => {
    const s = Array.from(keys.subarray(l.start, l.end)).join(",");
    let id = ids.get(s);
    if (id === undefined) {
      id = ids.size;
      ids.set(s, id);
    }
    return id;
  };
  const lka = Int32Array.from(la.map((l) => key(ka, l)));
  const lkb = Int32Array.from(lb.map((l) => key(kb, l)));
  const lineOps = diffWithFallback(lka, lkb, 20000);

  const ops: Op[] = [];
  let delLines: number[] = [];
  let insLines: number[] = [];
  const flush = () => {
    if (!delLines.length && !insLines.length) return;
    const aIdx: number[] = [];
    const bIdx: number[] = [];
    for (const li of delLines) for (let i = la[li].start; i < la[li].end; i++) aIdx.push(i);
    for (const li of insLines) for (let i = lb[li].start; i < lb[li].end; i++) bIdx.push(i);
    const sub = diffWithFallback(
      Int32Array.from(aIdx.map((i) => ka[i])),
      Int32Array.from(bIdx.map((i) => kb[i])),
      2500,
    );
    for (const [t, ai, bi] of sub) ops.push([t, ai < 0 ? -1 : aIdx[ai], bi < 0 ? -1 : bIdx[bi]]);
    delLines = [];
    insLines = [];
  };
  for (const [t, ai, bi] of lineOps) {
    if (t === EQ) {
      flush();
      const lA = la[ai];
      const lB = lb[bi];
      for (let i = 0; i < lA.end - lA.start; i++) ops.push([EQ, lA.start + i, lB.start + i]);
    } else if (t === DEL) delLines.push(ai);
    else insLines.push(bi);
  }
  flush();
  return ops;
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

// English month names count only when capitalised ("may" and "march" are also verbs).
const EN_MONTHS =
  /^(Jan(uary)?|Feb(ruary)?|Mar(ch)?|Apr(il)?|May|June?|July?|Aug(ust)?|Sep(t(ember)?)?|Oct(ober)?|Nov(ember)?|Dec(ember)?|JAN(UARY)?|FEB(RUARY)?|MAR(CH)?|APR(IL)?|MAY|JUNE?|JULY?|AUG(UST)?|SEP(T(EMBER)?)?|OCT(OBER)?|NOV(EMBER)?|DEC(EMBER)?)\.?,?$/;
const ES_MONTHS =
  /^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\.?,?$/i;
const MONTHS = { test: (t: string) => EN_MONTHS.test(t) || ES_MONTHS.test(t) };
const WEEKDAYS = /^(Mon|Tues?|Wed(nes)?|Thu(rs)?|Fri|Sat(ur)?|Sun)(day)?\.?,?$/;
const NUMERIC_DATE = /^\(?\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}[.,;:)]*$/;
const YEAR = /^\(?(19|20)\d{2}[.,;:)]*$/;
const DAY = /^\(?\d{1,2}(st|nd|rd|th)?[.,;:)]*$/i;
const MONEY = /[$€£¥₹]|^(usd|eur|gbp|inr|cad|aud|chf|jpy|dollars?|euros?|pounds?|rupees?)[.,;:]*$/i;
const PERCENT = /%|^(percent|per cent|pct)[.,;:]*$/i;
const DIGIT = /\d/;
const LIST_MARKER = /^\(?(\d{1,3}|[a-z]|[ivx]{1,4})[.)]$/i;

const NEGATIONS = new Set([
  "not",
  "no",
  "never",
  "none",
  "nobody",
  "nothing",
  "neither",
  "nor",
  "nowhere",
  "cannot",
  "can't",
  "won't",
  "shan't",
  "don't",
  "doesn't",
  "didn't",
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "shouldn't",
  "wouldn't",
  "couldn't",
  "mustn't",
  "needn't",
  "hasn't",
  "haven't",
  "hadn't",
  "without",
  "unless",
  "except",
  "excluding",
  "notwithstanding",
]);

function bare(t: string): string {
  return t
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}']+$/gu, "")
    .replace(/'$/, "");
}

export function isNegation(t: string): boolean {
  const b = bare(normalizeToken(t));
  return NEGATIONS.has(b) || /^non-\p{L}/u.test(b);
}

function isDateToken(t: string): boolean {
  return MONTHS.test(t) || WEEKDAYS.test(t) || NUMERIC_DATE.test(t);
}

function classify(removed: Word[], added: Word[], neighbors: Word[], type: ChangeType) {
  const flags = new Set<Flag>();
  const changed = [...removed, ...added].map((w) => w.n);
  const nearMonth = neighbors.some((w) => MONTHS.test(w.n));

  for (const t of changed) {
    if (isDateToken(t) || ((YEAR.test(t) || DAY.test(t)) && nearMonth)) flags.add("date");
  }
  const countNeg = (ws: Word[]) => {
    const found: string[] = [];
    for (const w of ws) if (isNegation(w.t)) found.push(bare(normalizeToken(w.t)));
    return found;
  };
  const negA = countNeg(removed);
  const negB = countNeg(added);
  let negationNote: string | undefined;
  if (negA.length !== negB.length || negA.join(" ") !== negB.join(" ")) {
    const addedNeg = negB.filter((x) => !negA.includes(x));
    const removedNeg = negA.filter((x) => !negB.includes(x));
    if (addedNeg.length || removedNeg.length || negA.length !== negB.length) {
      flags.add("negation");
      const parts: string[] = [];
      if (addedNeg.length) parts.push(`adds "${[...new Set(addedNeg)].join('", "')}"`);
      if (removedNeg.length) parts.push(`removes "${[...new Set(removedNeg)].join('", "')}"`);
      if (!parts.length) parts.push(negB.length > negA.length ? `adds "${negB[0]}"` : `removes "${negA[0]}"`);
      negationNote = parts.join(", ");
    }
  }

  // Money and percentages: the changed token, or a currency/percent word right beside it.
  const all = [...removed, ...added];
  const longPassage = type !== "replaced" && all.length > 6;
  for (const w of all) {
    if (!DIGIT.test(w.n)) {
      if (!longPassage && MONEY.test(w.n) && /[$€£¥₹]/.test(w.n)) flags.add("money");
      continue;
    }
    if (MONEY.test(w.n)) flags.add("money");
    else if (PERCENT.test(w.n)) flags.add("percent");
    else if (!flags.has("date") || !(YEAR.test(w.n) || DAY.test(w.n) || NUMERIC_DATE.test(w.n))) {
      if (longPassage && LIST_MARKER.test(w.n)) continue;
      if (NUMERIC_DATE.test(w.n)) continue;
      flags.add("number");
    }
  }
  if (!longPassage) {
    // "30 days" → "60 days" where the unit word is a neighbour: still a number.
    const nb = neighbors.map((w) => w.n.toLowerCase());
    if (all.some((w) => DIGIT.test(w.n)) && nb.some((x) => /^(percent|per)$/.test(x)) && !flags.has("percent"))
      flags.add("percent");
    if (all.some((w) => DIGIT.test(w.n)) && nb.some((x) => MONEY.test(x)) && !flags.has("money")) flags.add("money");
  }

  const order: Flag[] = ["negation", "money", "percent", "date", "number"];
  return { flags: order.filter((f) => flags.has(f)), negationNote };
}

/* ------------------------------------------------------------------ */
/* Compare                                                             */
/* ------------------------------------------------------------------ */

export function compareTexts(A: Word[], B: Word[], options: { ignoreCase?: boolean } = {}): CompareResult {
  const ids = new Map<string, number>();
  const keyOf = (w: Word) => {
    let k = w.n;
    if (options.ignoreCase) {
      const stripped = k.toLowerCase().replace(/[^\p{L}\p{N}%$€£¥₹]/gu, "");
      k = stripped || k;
    }
    let id = ids.get(k);
    if (id === undefined) {
      id = ids.size;
      ids.set(k, id);
    }
    return id;
  };
  const ka = Int32Array.from(A.map(keyOf));
  const kb = Int32Array.from(B.map(keyOf));
  // With ignoreCase, drop words that vanish entirely (pure punctuation) from both sides.
  let method: CompareResult["method"] = "words";
  let ops = diffTokens(ka, kb, 4000);
  if (!ops) {
    method = "lines";
    ops = diffByLines(A, B, ka, kb);
  }

  // Group runs of DEL/INS separated by EQ runs; merge tiny equal runs between changes.
  type Run = { eq: boolean; ops: Op[] };
  const runs: Run[] = [];
  for (const op of ops) {
    const eq = op[0] === EQ;
    const last = runs[runs.length - 1];
    if (last && last.eq === eq) last.ops.push(op);
    else runs.push({ eq, ops: [op] });
  }
  const size = (r: Run) => {
    let d = 0;
    let i = 0;
    for (const o of r.ops) {
      if (o[0] === DEL) d++;
      else i++;
    }
    return Math.max(d, i);
  };
  for (let i = 1; i < runs.length - 1; i++) {
    const r = runs[i];
    if (!r.eq || !runs[i - 1] || runs[i - 1].eq || runs[i + 1].eq) continue;
    const len = r.ops.length;
    if (len <= 2 && len * 2 < Math.max(size(runs[i - 1]), size(runs[i + 1]))) {
      // Turn the equal run into a delete + insert and merge the three runs.
      const conv: Op[] = [];
      for (const [, ai] of r.ops) conv.push([DEL, ai, -1]);
      for (const [, , bi] of r.ops) conv.push([INS, -1, bi]);
      runs[i - 1].ops.push(...conv, ...runs[i + 1].ops);
      runs.splice(i, 2);
      i--;
    }
  }

  const changes: Change[] = [];
  let lastA = -1;
  let lastB = -1;
  for (let ri = 0; ri < runs.length; ri++) {
    const r = runs[ri];
    if (r.eq) {
      const lo = r.ops[r.ops.length - 1];
      lastA = lo[1];
      lastB = lo[2];
      continue;
    }
    const removed: Word[] = [];
    const added: Word[] = [];
    for (const [t, ai, bi] of r.ops) {
      if (t === DEL) removed.push(A[ai]);
      else added.push(B[bi]);
    }
    // Ignore changes that are only whitespace-equivalent (shouldn't happen) or empty.
    if (!removed.length && !added.length) continue;
    const next = runs[ri + 1];
    const nextA = next ? next.ops[0][1] : -1;
    const nextB = next ? next.ops[0][2] : -1;
    const type: ChangeType = removed.length && added.length ? "replaced" : added.length ? "added" : "removed";

    const ctxSrcB = lastB >= 0 || nextB >= 0;
    const ctxBefore = ctxSrcB ? B.slice(Math.max(0, lastB - 5), lastB + 1) : A.slice(Math.max(0, lastA - 5), lastA + 1);
    const ctxAfter = ctxSrcB
      ? nextB >= 0
        ? B.slice(nextB, nextB + 6)
        : []
      : nextA >= 0
        ? A.slice(nextA, nextA + 6)
        : [];
    const neighbors = [...ctxBefore.slice(-3), ...ctxAfter.slice(0, 3)];
    const { flags, negationNote } = classify(removed, added, neighbors, type);

    const aRef = removed[0] ?? (lastA >= 0 ? A[lastA] : nextA >= 0 ? A[nextA] : undefined);
    const bRef = added[0] ?? (lastB >= 0 ? B[lastB] : nextB >= 0 ? B[nextB] : undefined);

    const change: Change = {
      id: changes.length + 1,
      type,
      removed,
      added,
      flags,
      negationNote,
      aPage: aRef?.p ?? 1,
      bPage: bRef?.p ?? 1,
      before: ctxBefore.map((w) => w.t).join(" "),
      after: ctxAfter.map((w) => w.t).join(" "),
    };
    if (type === "removed") {
      // Mark the gap in the changed document: right after the previous word, or before the next one.
      const prevW = lastB >= 0 ? B[lastB] : undefined;
      const nextW = nextB >= 0 ? B[nextB] : undefined;
      const ref = prevW && (!nextW || prevW.p === removed[0].p || nextW.p !== removed[0].p) ? prevW : nextW;
      if (ref) {
        const x = ref === prevW ? ref.r[2] + 1 : ref.r[0] - 1;
        change.bAnchor = { p: ref.p, x, y: ref.r[1], h: ref.r[3] - ref.r[1] };
        change.bPage = ref.p;
      }
    }
    if (type === "added") {
      const prevW = lastA >= 0 ? A[lastA] : undefined;
      const nextW = nextA >= 0 ? A[nextA] : undefined;
      const ref = prevW ?? nextW;
      if (ref) {
        const x = ref === prevW ? ref.r[2] + 1 : ref.r[0] - 1;
        change.aAnchor = { p: ref.p, x, y: ref.r[1], h: ref.r[3] - ref.r[1] };
        change.aPage = ref.p;
      }
    }
    changes.push(change);
  }
  return { changes, wordsA: A.length, wordsB: B.length, method };
}

/** Merge the boxes of consecutive words on the same line into one box per line. */
export function lineBoxes(ws: Word[]): { p: number; r: Rect; v: [number, number, number, number] }[] {
  const out: { p: number; line: number; r: Rect; v: [number, number, number, number] }[] = [];
  for (const w of ws) {
    const last = out[out.length - 1];
    if (last && last.p === w.p && last.line === w.line) {
      last.r = [
        Math.min(last.r[0], w.r[0]),
        Math.min(last.r[1], w.r[1]),
        Math.max(last.r[2], w.r[2]),
        Math.max(last.r[3], w.r[3]),
      ];
      const l = Math.min(last.v[0], w.v[0]);
      const t = Math.min(last.v[1], w.v[1]);
      const r = Math.max(last.v[0] + last.v[2], w.v[0] + w.v[2]);
      const b = Math.max(last.v[1] + last.v[3], w.v[1] + w.v[3]);
      last.v = [l, t, r - l, b - t];
    } else out.push({ p: w.p, line: w.line, r: [...w.r] as Rect, v: [...w.v] as [number, number, number, number] });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Summary text                                                        */
/* ------------------------------------------------------------------ */

export const FLAG_LABELS: Record<Flag, [string, string]> = {
  negation: ["negation", "negations"],
  date: ["date", "dates"],
  money: ["money amount", "money amounts"],
  percent: ["percentage", "percentages"],
  number: ["number", "numbers"],
};

export function countFlags(changes: Change[]): Record<Flag, number> {
  const c: Record<Flag, number> = { negation: 0, date: 0, money: 0, percent: 0, number: 0 };
  for (const ch of changes) for (const f of ch.flags) c[f]++;
  return c;
}

export function countTypes(changes: Change[]): Record<ChangeType, number> {
  const c: Record<ChangeType, number> = { replaced: 0, added: 0, removed: 0 };
  for (const ch of changes) c[ch.type]++;
  return c;
}

/** Each change counted once, by its most important flag (or its type when unflagged). */
export function summaryLine(changes: Change[]): string {
  if (!changes.length) return "No differences in the text.";
  const primary: Record<string, number> = {};
  for (const ch of changes) {
    const k = ch.flags[0] ?? ch.type;
    primary[k] = (primary[k] ?? 0) + 1;
  }
  const names: Record<string, [string, string]> = {
    ...FLAG_LABELS,
    replaced: ["wording change", "wording changes"],
    added: ["passage added", "passages added"],
    removed: ["passage removed", "passages removed"],
  };
  const parts: string[] = [];
  for (const k of ["money", "percent", "number", "date", "negation", "replaced", "added", "removed"]) {
    const n = primary[k];
    if (n) parts.push(`${n} ${names[k][n === 1 ? 0 : 1]}`);
  }
  return `${changes.length} change${changes.length === 1 ? "" : "s"}: ${parts.join(", ")}`;
}

export const wordsText = (ws: Word[]) => ws.map((w) => w.t).join(" ");

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function changeHeadline(ch: Change): string {
  if (ch.type === "replaced") return `"${trunc(wordsText(ch.removed), 140)}" → "${trunc(wordsText(ch.added), 140)}"`;
  if (ch.type === "added") return `Added: "${trunc(wordsText(ch.added), 280)}"`;
  return `Removed: "${trunc(wordsText(ch.removed), 280)}"`;
}

export function flagText(ch: Change): string {
  const names = ch.flags.map((f) =>
    f === "negation" && ch.negationNote ? `negation (${ch.negationNote})` : FLAG_LABELS[f][0],
  );
  return names.length ? names.join(", ") : ch.type === "replaced" ? "wording" : ch.type;
}

export function buildReport(result: CompareResult, nameA: string, nameB: string): string {
  const lines: string[] = [];
  lines.push("PDF comparison report");
  lines.push("=====================");
  lines.push(`Original: ${nameA}`);
  lines.push(`Changed:  ${nameB}`);
  lines.push(
    `Created:  ${new Date().toISOString().slice(0, 16).replace("T", " ")} (in your browser at pdfcompact.com)`,
  );
  lines.push("");
  lines.push(summaryLine(result.changes));
  lines.push("Compares the text layer only: formatting, images and layout changes are not detected.");
  lines.push("");
  for (const ch of result.changes) {
    lines.push(`#${ch.id}  [${flagText(ch).toUpperCase()}]  original p.${ch.aPage} / changed p.${ch.bPage}`);
    if (ch.removed.length) lines.push(`  - Removed: ${wordsText(ch.removed)}`);
    if (ch.added.length) lines.push(`  + Added:   ${wordsText(ch.added)}`);
    lines.push(`  Context:   …${ch.before} [${ch.type === "removed" ? "×" : wordsText(ch.added)}] ${ch.after}…`);
    lines.push("");
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Redline PDF                                                         */
/* ------------------------------------------------------------------ */

export async function buildRedline(
  changedBytes: Uint8Array,
  result: CompareResult,
  nameA: string,
  nameB: string,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, PDFName, PDFString, PDFHexString, PDFArray } = await import("pdf-lib");
  const doc = await PDFDocument.load(changedBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const charset = new Set(font.getCharacterSet());
  const safe = (s: string) =>
    Array.from(normalizeToken(s).replace(/[…]/g, "..."))
      .map((ch) => (ch === "\n" ? " " : charset.has(ch.codePointAt(0)!) ? ch : "?"))
      .join("");

  const green = rgb(0.13, 0.7, 0.33);
  const red = rgb(0.86, 0.15, 0.15);
  const pages = doc.getPages();

  const addNote = (pageIdx: number, x: number, y: number, text: string) => {
    const page = pages[pageIdx];
    const annot = doc.context.obj({
      Type: "Annot",
      Subtype: "Text",
      Rect: [x, y, x + 18, y + 18],
      Contents: PDFHexString.fromText(text),
      T: PDFString.of("PDFCompact compare"),
      Name: "Comment",
      C: [0.86, 0.15, 0.15],
      F: 4,
    });
    const ref = doc.context.register(annot);
    const annots = page.node.lookup(PDFName.of("Annots"));
    if (annots instanceof PDFArray) annots.push(ref);
    else page.node.set(PDFName.of("Annots"), doc.context.obj([ref]));
  };

  const label = (pageIdx: number, x: number, y: number, n: number, color: ReturnType<typeof rgb>) => {
    const page = pages[pageIdx];
    const s = String(n);
    const size = 6.5;
    const w = bold.widthOfTextAtSize(s, size) + 3;
    page.drawRectangle({ x, y, width: w, height: size + 2, color, opacity: 0.9 });
    page.drawText(s, { x: x + 1.5, y: y + 1.6, size, font: bold, color: rgb(1, 1, 1) });
  };

  // Note icons go in the right margin, level with the change, so they never cover text.
  const noteX = (pageIdx: number) => {
    const box = pages[pageIdx].getCropBox();
    return box.x + box.width - 22;
  };

  for (const ch of result.changes) {
    if (ch.added.length) {
      const boxes = lineBoxes(ch.added);
      for (const b of boxes) {
        const page = pages[b.p - 1];
        if (!page) continue;
        page.drawRectangle({
          x: b.r[0] - 0.6,
          y: b.r[1],
          width: b.r[2] - b.r[0] + 1.2,
          height: b.r[3] - b.r[1],
          color: green,
          opacity: 0.3,
          borderColor: green,
          borderOpacity: 0.7,
          borderWidth: 0.4,
        });
        if (ch.removed.length) {
          // A red underline means these words replaced other wording.
          page.drawLine({
            start: { x: b.r[0] - 0.6, y: b.r[1] - 0.6 },
            end: { x: b.r[2] + 0.6, y: b.r[1] - 0.6 },
            thickness: 0.8,
            color: red,
            opacity: 0.85,
          });
        }
      }
      const first = ch.added[0];
      const pi = first.p - 1;
      if (!pages[pi]) continue;
      label(pi, first.r[0] - 1, first.r[3] + 0.5, ch.id, ch.removed.length ? red : green);
      if (ch.removed.length) addNote(pi, noteX(pi), first.r[1] - 3, `#${ch.id} was: ${wordsText(ch.removed)}`);
    } else if (ch.bAnchor) {
      const a = ch.bAnchor;
      const pi = a.p - 1;
      const page = pages[pi];
      if (!page) continue;
      page.drawLine({ start: { x: a.x, y: a.y - 1 }, end: { x: a.x, y: a.y + a.h + 1 }, thickness: 1.4, color: red });
      page.drawLine({
        start: { x: a.x - 2.5, y: a.y - 1 },
        end: { x: a.x + 2.5, y: a.y - 1 },
        thickness: 1,
        color: red,
      });
      label(pi, a.x + 1.5, a.y + a.h + 0.5, ch.id, red);
      addNote(pi, noteX(pi), a.y - 3, `#${ch.id} removed: ${wordsText(ch.removed)}`);
    }
  }

  // Summary page(s) at the front.
  const first = pages[0];
  const fs = first ? first.getSize() : { width: 595.28, height: 841.89 };
  const [pw, ph] = fs.width < fs.height ? [fs.width, fs.height] : [595.28, 841.89];
  const margin = 48;
  const maxW = pw - margin * 2;
  const summaryPages: ReturnType<typeof doc.insertPage>[] = [];
  let page = doc.insertPage(0, [pw, ph]);
  summaryPages.push(page);
  let y = ph - margin;

  const newPage = () => {
    page = doc.insertPage(summaryPages.length, [pw, ph]);
    summaryPages.push(page);
    y = ph - margin;
  };
  const wrap = (text: string, f: typeof font, size: number, width: number) => {
    const words = safe(text).split(/\s+/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const tryS = cur ? cur + " " + w : w;
      if (f.widthOfTextAtSize(tryS, size) <= width) cur = tryS;
      else {
        if (cur) out.push(cur);
        let piece = w;
        while (f.widthOfTextAtSize(piece, size) > width && piece.length > 1) {
          let cut = piece.length - 1;
          while (cut > 1 && f.widthOfTextAtSize(piece.slice(0, cut), size) > width) cut--;
          out.push(piece.slice(0, cut));
          piece = piece.slice(cut);
        }
        cur = piece;
      }
    }
    if (cur) out.push(cur);
    return out;
  };
  const write = (
    text: string,
    opts: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {},
  ) => {
    const size = opts.size ?? 9.5;
    const f = opts.f ?? font;
    const indent = opts.indent ?? 0;
    for (const ln of wrap(text, f, size, maxW - indent)) {
      if (y - size < margin) newPage();
      y -= size * 1.35;
      page.drawText(ln, { x: margin + indent, y, size, font: f, color: opts.color ?? rgb(0.1, 0.1, 0.1) });
    }
    y -= opts.gap ?? 0;
  };

  write("Comparison summary", { size: 18, f: bold, gap: 6 });
  write(`Original: ${nameA}`, { size: 9.5 });
  write(`Changed: ${nameB}`, { size: 9.5, gap: 4 });
  write(summaryLine(result.changes), { size: 11, f: bold, gap: 4 });
  write(
    "The pages after this summary are the Changed document. Green boxes mark inserted or replaced words (a red underline means they replaced other wording); a red bar marks where text was deleted. Numbers match the list below. Hover the note icons in a PDF viewer to read the old wording. Page numbers refer to the Changed document. Only the text layer was compared: formatting, images and layout are not checked.",
    { size: 8.5, color: rgb(0.35, 0.35, 0.35), gap: 10 },
  );
  if (!result.changes.length) write("No differences were found in the text of these two files.", { size: 11 });

  for (const ch of result.changes) {
    if (y - 40 < margin) newPage();
    const color = ch.flags.length ? red : rgb(0.1, 0.1, 0.1);
    write(`#${ch.id}  ${flagText(ch).toUpperCase()}  ·  changed p.${ch.bPage} (original p.${ch.aPage})`, {
      size: 9,
      f: bold,
      color,
    });
    if (ch.removed.length)
      write(`- Removed: ${wordsText(ch.removed)}`, { size: 9, indent: 10, color: rgb(0.7, 0.1, 0.1) });
    if (ch.added.length) write(`+ Added: ${wordsText(ch.added)}`, { size: 9, indent: 10, color: rgb(0.05, 0.45, 0.2) });
    write(`Context: ...${ch.before} [${ch.type === "removed" ? "deleted" : wordsText(ch.added)}] ${ch.after}...`, {
      size: 8,
      indent: 10,
      color: rgb(0.4, 0.4, 0.4),
      gap: 7,
    });
  }
  summaryPages.forEach((p, i) =>
    p.drawText(`Summary ${i + 1} of ${summaryPages.length} · made with pdfcompact.com/compare-pdf`, {
      x: margin,
      y: margin / 2,
      size: 7,
      font,
      color: rgb(0.55, 0.55, 0.55),
    }),
  );
  return doc.save();
}
