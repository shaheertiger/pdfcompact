/**
 * Evaluate PDF functions (ISO 32000 §7.10): Type 0 sampled (one input),
 * Type 2 exponential, Type 3 stitching and Type 4 PostScript calculator, and
 * arrays of one-output functions. Used by the grayscale converter to turn
 * gradients and spot-colour tint transforms into gray ones.
 */
import { PDFArray, PDFContext, PDFDict, PDFNumber, PDFName, PDFRawStream, PDFRef, PDFStream, decodePDFRawStream, type PDFObject } from "@cantoo/pdf-lib";

export type Fn = (x: number[]) => number[];

const N = (s: string) => PDFName.of(s);

function deref(ctx: PDFContext, o: PDFObject | undefined): PDFObject | undefined {
  return o instanceof PDFRef ? ctx.lookup(o) : o;
}

function nums(ctx: PDFContext, o: PDFObject | undefined): number[] | null {
  const a = deref(ctx, o);
  if (!(a instanceof PDFArray)) return null;
  const out: number[] = [];
  for (let i = 0; i < a.size(); i++) {
    const v = a.lookup(i);
    if (!(v instanceof PDFNumber)) return null;
    out.push(v.asNumber());
  }
  return out;
}

const clip = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const interp = (x: number, x0: number, x1: number, y0: number, y1: number) => (x1 === x0 ? y0 : y0 + ((x - x0) * (y1 - y0)) / (x1 - x0));

function clipRange(out: number[], range: number[] | null): number[] {
  if (!range) return out;
  return out.map((v, i) => (2 * i + 1 < range.length ? clip(v, range[2 * i], range[2 * i + 1]) : v));
}

export function makeFunction(ctx: PDFContext, obj: PDFObject | undefined, depth = 0): Fn | null {
  if (depth > 8) return null;
  const o = deref(ctx, obj);
  if (o instanceof PDFArray) {
    const parts = o.asArray().map((p) => makeFunction(ctx, p, depth + 1));
    if (parts.some((p) => !p)) return null;
    return (x) => parts.map((p) => p!(x)[0]);
  }
  const dict = o instanceof PDFStream ? o.dict : o;
  if (!(dict instanceof PDFDict)) return null;
  const type = (deref(ctx, dict.get(N("FunctionType"))) as PDFNumber | undefined)?.asNumber?.();
  const domain = nums(ctx, dict.get(N("Domain"))) ?? [0, 1];
  const range = nums(ctx, dict.get(N("Range")));
  const inClip = (x: number[]) => x.map((v, i) => (2 * i + 1 < domain.length ? clip(v, domain[2 * i], domain[2 * i + 1]) : v));

  if (type === 2) {
    const c0 = nums(ctx, dict.get(N("C0"))) ?? [0];
    const c1 = nums(ctx, dict.get(N("C1"))) ?? [1];
    const e = (deref(ctx, dict.get(N("N"))) as PDFNumber | undefined)?.asNumber?.() ?? 1;
    return (x) => {
      const t = Math.pow(inClip(x)[0], e);
      return clipRange(c0.map((c, i) => c + t * ((c1[i] ?? 0) - c)), range);
    };
  }

  if (type === 3) {
    const fns = deref(ctx, dict.get(N("Functions")));
    const bounds = nums(ctx, dict.get(N("Bounds"))) ?? [];
    const encode = nums(ctx, dict.get(N("Encode")));
    if (!(fns instanceof PDFArray) || !encode) return null;
    const parts = fns.asArray().map((p) => makeFunction(ctx, p, depth + 1));
    if (parts.some((p) => !p) || parts.length !== bounds.length + 1) return null;
    return (x) => {
      const v = inClip(x)[0];
      let k = 0;
      while (k < bounds.length && v >= bounds[k]) k++;
      const lo = k === 0 ? domain[0] : bounds[k - 1];
      const hi = k === bounds.length ? domain[1] : bounds[k];
      return clipRange(parts[k]!([interp(v, lo, hi, encode[2 * k], encode[2 * k + 1])]), range);
    };
  }

  if (type === 0 && o instanceof PDFRawStream && range) {
    const size = nums(ctx, dict.get(N("Size")));
    const bps = (deref(ctx, dict.get(N("BitsPerSample"))) as PDFNumber | undefined)?.asNumber?.() ?? 8;
    if (!size || size.length !== 1 || ![1, 2, 4, 8, 16, 32].includes(bps)) return null;
    let data: Uint8Array;
    try {
      data = decodePDFRawStream(o).decode();
    } catch {
      return null;
    }
    const nOut = range.length / 2;
    const encode = nums(ctx, dict.get(N("Encode"))) ?? [0, size[0] - 1];
    const decode = nums(ctx, dict.get(N("Decode"))) ?? range;
    const max = Math.pow(2, bps) - 1;
    const sample = (idx: number, j: number) => {
      const bit = (idx * nOut + j) * bps;
      let v = 0;
      for (let b = 0; b < bps; b++) {
        const pos = bit + b;
        v = v * 2 + ((data[pos >> 3] >> (7 - (pos & 7))) & 1);
      }
      return v;
    };
    return (x) => {
      const e = clip(interp(inClip(x)[0], domain[0], domain[1], encode[0], encode[1]), 0, size[0] - 1);
      const i0 = Math.floor(e);
      const i1 = Math.min(size[0] - 1, i0 + 1);
      const f = e - i0;
      const out: number[] = [];
      for (let j = 0; j < nOut; j++) {
        const s = sample(i0, j) * (1 - f) + sample(i1, j) * f;
        out.push(interp(s, 0, max, decode[2 * j], decode[2 * j + 1]));
      }
      return clipRange(out, range);
    };
  }

  if (type === 4 && o instanceof PDFRawStream && range) {
    let code: string;
    try {
      code = new TextDecoder("latin1").decode(decodePDFRawStream(o).decode());
    } catch {
      return null;
    }
    const prog = parsePostScript(code);
    if (!prog) return null;
    const nOut = range.length / 2;
    return (x) => {
      const stack: (number | boolean)[] = [...inClip(x)];
      runPostScript(prog, stack);
      const out = stack.slice(-nOut).map(Number);
      return clipRange(out, range);
    };
  }
  return null;
}

type Prog = (string | number | Prog)[];

function parsePostScript(src: string): Prog | null {
  const toks = src.match(/[{}]|[^\s{}]+/g) ?? [];
  let i = 0;
  const block = (): Prog => {
    const out: Prog = [];
    while (i < toks.length) {
      const t = toks[i++];
      if (t === "{") out.push(block());
      else if (t === "}") return out;
      else if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) out.push(parseFloat(t));
      else out.push(t);
    }
    return out;
  };
  const top = block();
  return top.length === 1 && Array.isArray(top[0]) ? (top[0] as Prog) : top;
}

function runPostScript(prog: Prog, s: (number | boolean)[]) {
  const pop = () => s.pop() as number;
  for (let k = 0; k < prog.length; k++) {
    const t = prog[k];
    if (typeof t === "number") {
      s.push(t);
      continue;
    }
    if (Array.isArray(t)) {
      // Blocks are consumed by the following if / ifelse.
      const next = prog[k + 1];
      if (next === "if") {
        if (s.pop()) runPostScript(t, s);
        k++;
      } else if (Array.isArray(next) && prog[k + 2] === "ifelse") {
        runPostScript(s.pop() ? t : next, s);
        k += 2;
      }
      continue;
    }
    let a: number, b: number;
    switch (t) {
      case "true": s.push(true); break;
      case "false": s.push(false); break;
      case "add": b = pop(); a = pop(); s.push(a + b); break;
      case "sub": b = pop(); a = pop(); s.push(a - b); break;
      case "mul": b = pop(); a = pop(); s.push(a * b); break;
      case "div": b = pop(); a = pop(); s.push(b === 0 ? 0 : a / b); break;
      case "idiv": b = pop(); a = pop(); s.push(b === 0 ? 0 : Math.trunc(a / b)); break;
      case "mod": b = pop(); a = pop(); s.push(b === 0 ? 0 : a % b); break;
      case "neg": s.push(-pop()); break;
      case "abs": s.push(Math.abs(pop())); break;
      case "ceiling": s.push(Math.ceil(pop())); break;
      case "floor": s.push(Math.floor(pop())); break;
      case "round": s.push(Math.round(pop())); break;
      case "truncate": case "cvi": s.push(Math.trunc(pop())); break;
      case "cvr": break;
      case "sqrt": s.push(Math.sqrt(pop())); break;
      case "sin": s.push(Math.sin((pop() * Math.PI) / 180)); break;
      case "cos": s.push(Math.cos((pop() * Math.PI) / 180)); break;
      case "atan": b = pop(); a = pop(); s.push(((Math.atan2(a, b) * 180) / Math.PI + 360) % 360); break;
      case "exp": b = pop(); a = pop(); s.push(Math.pow(a, b)); break;
      case "ln": s.push(Math.log(pop())); break;
      case "log": s.push(Math.log10(pop())); break;
      case "dup": s.push(s[s.length - 1]); break;
      case "pop": s.pop(); break;
      case "exch": b = pop(); a = pop(); s.push(b, a); break;
      case "copy": { const n = pop(); s.push(...s.slice(s.length - n)); break; }
      case "index": { const n = pop(); s.push(s[s.length - 1 - n]); break; }
      case "roll": {
        const j = pop();
        const n = pop();
        if (n > 0) {
          const part = s.splice(s.length - n, n);
          const r = ((j % n) + n) % n;
          s.push(...part.slice(n - r), ...part.slice(0, n - r));
        }
        break;
      }
      case "eq": { const y = s.pop(); const x = s.pop(); s.push(x === y); break; }
      case "ne": { const y = s.pop(); const x = s.pop(); s.push(x !== y); break; }
      case "gt": b = pop(); a = pop(); s.push(a > b); break;
      case "ge": b = pop(); a = pop(); s.push(a >= b); break;
      case "lt": b = pop(); a = pop(); s.push(a < b); break;
      case "le": b = pop(); a = pop(); s.push(a <= b); break;
      case "and": { const y = s.pop(); const x = s.pop(); s.push(typeof x === "boolean" ? x && (y as boolean) : (x as number) & (y as number)); break; }
      case "or": { const y = s.pop(); const x = s.pop(); s.push(typeof x === "boolean" ? x || (y as boolean) : (x as number) | (y as number)); break; }
      case "xor": { const y = s.pop(); const x = s.pop(); s.push(typeof x === "boolean" ? x !== y : (x as number) ^ (y as number)); break; }
      case "not": { const x = s.pop(); s.push(typeof x === "boolean" ? !x : ~(x as number)); break; }
      case "bitshift": b = pop(); a = pop(); s.push(b >= 0 ? a << b : a >> -b); break;
    }
  }
}
