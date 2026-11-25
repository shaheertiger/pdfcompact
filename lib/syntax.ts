/**
 * A tiny regex syntax highlighter for code blocks in Markdown to PDF and
 * Jupyter Notebook to PDF. It only colours comments, strings, numbers,
 * keywords, built-ins and definition names, which is what makes printed code
 * readable; it is not a parser. Output is HTML with `data-pdf-color` spans
 * that lib/html-layout.ts draws in that colour. Colours are dark enough to
 * print well on white paper.
 */

const COLORS = {
  comment: "#6e7781",
  string: "#0a3069",
  number: "#0550ae",
  keyword: "#cf222e",
  builtin: "#953800",
  def: "#8250df",
  decorator: "#8250df",
} as const;

type Kind = keyof typeof COLORS;

type Lang = {
  keywords: Set<string>;
  builtins?: Set<string>;
  /** Line comment starters. */
  line: string[];
  block?: [string, string];
  /** Python-style triple-quoted strings. */
  triple?: boolean;
  /** Backtick template strings. */
  backtick?: boolean;
  /** Words after which the next identifier is a definition name. */
  defs?: Set<string>;
  decorators?: boolean;
};

const words = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

const PY: Lang = {
  keywords: words(
    "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case"
  ),
  builtins: words(
    "print len range enumerate zip map filter sorted sum min max abs round int float str bool list dict set tuple type isinstance open super self cls object Exception ValueError TypeError KeyError IndexError np pd plt"
  ),
  line: ["#"],
  triple: true,
  defs: words("def class"),
  decorators: true,
};

const JS: Lang = {
  keywords: words(
    "break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield async await of from as interface type enum implements public private protected readonly static null undefined true false"
  ),
  builtins: words("console window document Math JSON Object Array String Number Promise Map Set Date Error require module exports"),
  line: ["//"],
  block: ["/*", "*/"],
  backtick: true,
  defs: words("function class interface type enum"),
};

const SH: Lang = {
  keywords: words("if then else elif fi for while until do done case esac in function return export local readonly set unset source"),
  builtins: words("echo cd ls cat grep sed awk pip python python3 npm npx node git curl wget mkdir rm cp mv chmod sudo apt brew conda jupyter"),
  line: ["#"],
};

const SQL: Lang = {
  keywords: words(
    "select from where and or not insert into values update set delete create table drop alter add join left right inner outer full on group by order having limit offset as distinct union all case when then else end null is in like between exists primary key foreign references index view with asc desc count sum avg min max"
  ),
  line: ["--"],
  block: ["/*", "*/"],
};

const R: Lang = {
  keywords: words("if else repeat while function for in next break TRUE FALSE NULL Inf NaN NA return library require"),
  builtins: words("c list data.frame print paste paste0 length mean sum nrow ncol head tail summary plot ggplot aes"),
  line: ["#"],
};

const JULIA: Lang = {
  keywords: words("function end if elseif else for while return using import module struct mutable begin let do try catch finally true false nothing in const global local abstract type"),
  builtins: words("println print length push! collect sum map filter"),
  line: ["#"],
  defs: words("function struct module"),
};

const C_LIKE: Lang = {
  keywords: words(
    "auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while class public private protected new delete this true false null nullptr namespace using template typename bool package import extends implements final abstract interface throws throw try catch finally fn let mut pub impl trait match use mod crate self Self struct func go var type map chan defer"
  ),
  line: ["//"],
  block: ["/*", "*/"],
  backtick: true,
  defs: words("class struct fn func interface trait"),
};

const LANGS: Record<string, Lang> = {
  python: PY, py: PY, python3: PY, ipython: PY, ipython3: PY, sage: PY,
  javascript: JS, js: JS, jsx: JS, typescript: JS, ts: JS, tsx: JS, mjs: JS, json: JS,
  bash: SH, sh: SH, shell: SH, zsh: SH, console: SH, powershell: SH,
  sql: SQL, r: R, julia: JULIA, jl: JULIA,
  c: C_LIKE, cpp: C_LIKE, "c++": C_LIKE, java: C_LIKE, csharp: C_LIKE, cs: C_LIKE, go: C_LIKE, rust: C_LIKE, rs: C_LIKE,
  kotlin: C_LIKE, swift: C_LIKE, scala: C_LIKE, php: C_LIKE,
};

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const span = (kind: Kind, text: string) => `<span data-pdf-color="${COLORS[kind]}">${escapeHtml(text)}</span>`;

/** Highlight `code` for `lang` (a Markdown fence info string or kernel language). Unknown languages are escaped only. */
export function highlight(code: string, lang?: string | null): string {
  const L = lang ? LANGS[lang.trim().toLowerCase().split(/\s+/)[0]] : undefined;
  if (!L) return escapeHtml(code);
  let out = "";
  let i = 0;
  let plain = "";
  let nextIsDef = false;
  const flush = () => {
    if (plain) out += escapeHtml(plain);
    plain = "";
  };
  const emit = (kind: Kind, text: string) => {
    flush();
    out += span(kind, text);
  };
  const n = code.length;
  while (i < n) {
    const rest = code.startsWith.bind(code);
    // Comments
    const lc = L.line.find((c) => rest(c, i));
    if (lc && !(L === SH && i > 0 && /[\w$}]/.test(code[i - 1]))) {
      let j = code.indexOf("\n", i);
      if (j < 0) j = n;
      emit("comment", code.slice(i, j));
      i = j;
      continue;
    }
    if (L.block && rest(L.block[0], i)) {
      let j = code.indexOf(L.block[1], i + L.block[0].length);
      j = j < 0 ? n : j + L.block[1].length;
      emit("comment", code.slice(i, j));
      i = j;
      continue;
    }
    const c = code[i];
    // Strings (with optional Python prefixes like f"", rb'')
    const prefix = L === PY ? code.slice(i).match(/^[rRbBuUfF]{1,2}(?=["'])/)?.[0] ?? "" : "";
    const q = code[i + prefix.length];
    const prevWord = i > 0 && /[\w]/.test(code[i - 1]);
    if (!prevWord && (q === '"' || q === "'" || (q === "`" && L.backtick))) {
      const start = i;
      let j = i + prefix.length;
      const triple = L.triple && (code.startsWith(q.repeat(3), j));
      if (triple) {
        const end = code.indexOf(q.repeat(3), j + 3);
        j = end < 0 ? n : end + 3;
      } else {
        j++;
        while (j < n && code[j] !== q) {
          if (code[j] === "\\") j++;
          else if (code[j] === "\n" && q !== "`") break;
          j++;
        }
        j = Math.min(n, j + 1);
      }
      emit("string", code.slice(start, j));
      i = j;
      continue;
    }
    // Numbers
    if (/[0-9]/.test(c) && !prevWord) {
      const m = code.slice(i).match(/^(0[xob][0-9a-f_]+|\d[\d_]*(\.\d*)?(e[+-]?\d+)?j?)/i);
      if (m) {
        emit("number", m[0]);
        i += m[0].length;
        continue;
      }
    }
    // Decorators
    if (c === "@" && L.decorators) {
      const m = code.slice(i).match(/^@[\w.]+/);
      if (m) {
        emit("decorator", m[0]);
        i += m[0].length;
        continue;
      }
    }
    // Identifiers and keywords
    if (/[A-Za-z_$]/.test(c)) {
      const m = code.slice(i).match(/^[A-Za-z_$][\w$!]*/)!;
      const w = m[0];
      const kw = L === SQL ? L.keywords.has(w.toLowerCase()) : L.keywords.has(w);
      if (nextIsDef && !kw) {
        emit("def", w);
        nextIsDef = false;
      } else if (kw) {
        emit("keyword", w);
        nextIsDef = Boolean(L.defs?.has(w));
      } else if (L.builtins?.has(w)) emit("builtin", w);
      else plain += w;
      i += w.length;
      continue;
    }
    if (!/\s/.test(c)) nextIsDef = false;
    plain += c;
    i++;
  }
  flush();
  return out;
}
