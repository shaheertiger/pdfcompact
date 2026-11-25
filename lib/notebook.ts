/**
 * Jupyter notebook (.ipynb, nbformat 4; nbformat 3 is mapped across) → HTML
 * for the PDF layout engine. Markdown cells go through marked, code cells are
 * highlighted, and outputs are picked in this order: PNG, JPEG, SVG, HTML,
 * Markdown, plain text. Error tracebacks lose their ANSI colour codes.
 *
 * Nothing here runs notebook code or inserts output HTML into the live page:
 * every HTML output is re-parsed on its own with DOMParser (which never runs
 * scripts), so a broken table can't swallow the cells after it.
 */
import { markdownToHtml, CODE_SHADE } from "./markdown-pdf";
import { escapeHtml, highlight } from "./syntax";

type Multi = string | string[] | undefined;
type Output = {
  output_type: string;
  name?: string;
  text?: Multi;
  data?: Record<string, Multi | object>;
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  ename?: string;
  evalue?: string;
  traceback?: string[];
};
type Cell = {
  cell_type: string;
  source: Multi;
  outputs?: Output[];
  execution_count?: number | null;
  attachments?: Record<string, Record<string, Multi>>;
};
export type Notebook = { cells: Cell[]; language: string; title?: string; nbformat: number };

export class NotebookError extends Error {}

const join = (v: Multi | object): string => (Array.isArray(v) ? v.join("") : typeof v === "string" ? v : "");

/** Strip ANSI colour/cursor escape codes from tracebacks and coloured logs. */
export function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "").replace(/\x1b\][^\x07]*\x07/g, "");
}

/** Resolve carriage-return progress bars ("10%\r20%\r100%") to what a terminal would show. */
function resolveCR(s: string): string {
  return s
    .split("\n")
    .map((line) => {
      const parts = line.split("\r");
      return parts.length > 1 ? parts.filter((p) => p !== "").pop() ?? "" : line;
    })
    .join("\n");
}

export function parseNotebook(text: string): Notebook {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new NotebookError("This file isn't valid notebook JSON. It may be cut off or not a real .ipynb file.");
  }
  if (!raw || typeof raw !== "object") throw new NotebookError("This file isn't a Jupyter notebook.");
  const nbformat = Number(raw.nbformat ?? 0);
  const meta = (raw.metadata ?? {}) as Record<string, Record<string, unknown> | string | undefined>;
  const ks = meta.kernelspec as Record<string, unknown> | undefined;
  const li = meta.language_info as Record<string, unknown> | undefined;
  const language = String(li?.name ?? ks?.language ?? "python").toLowerCase();
  const title = typeof meta.title === "string" ? meta.title : undefined;

  let cells: Cell[];
  if (Array.isArray(raw.cells)) {
    cells = raw.cells as Cell[];
  } else if (Array.isArray(raw.worksheets)) {
    // nbformat 3: cells live in worksheets, code is "input", outputs use "pyout"/"pyerr" and short MIME keys.
    const ws = (raw.worksheets as { cells?: Record<string, unknown>[] }[])[0]?.cells ?? [];
    cells = ws.map((c) => {
      const type = c.cell_type === "heading" ? "markdown" : String(c.cell_type);
      const src = join((c.source ?? c.input) as Multi);
      const level = Number(c.level ?? 1);
      return {
        cell_type: type,
        source: c.cell_type === "heading" ? `${"#".repeat(level)} ${src}` : src,
        execution_count: (c.prompt_number as number) ?? null,
        outputs: ((c.outputs as Record<string, unknown>[]) ?? []).map((o) => {
          const ot = String(o.output_type);
          if (ot === "stream") return { output_type: "stream", name: String(o.stream ?? "stdout"), text: o.text as Multi };
          if (ot === "pyerr") return { output_type: "error", ename: String(o.ename), evalue: String(o.evalue), traceback: o.traceback as string[] };
          const data: Record<string, Multi> = {};
          if (o.png) data["image/png"] = o.png as Multi;
          if (o.jpeg) data["image/jpeg"] = o.jpeg as Multi;
          if (o.svg) data["image/svg+xml"] = o.svg as Multi;
          if (o.html) data["text/html"] = o.html as Multi;
          if (o.text) data["text/plain"] = o.text as Multi;
          return { output_type: ot === "pyout" ? "execute_result" : "display_data", data, execution_count: (o.prompt_number as number) ?? null };
        }),
      };
    });
  } else {
    throw new NotebookError("This file has no notebook cells. Is it a Jupyter .ipynb file?");
  }
  return { cells, language, title, nbformat };
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const MUTED = "#6e7781";
const ERROR_SHADE = "#fdecec";
const STDERR_SHADE = "#fff6e5";

function prompt(label: string): string {
  return `<p data-pdf-color="${MUTED}"><small>${escapeHtml(label)}</small></p>`;
}

function preBlock(text: string, shade?: string, color?: string): string {
  const attrs = (shade ? ` data-pdf-shade="${shade}"` : "") + (color ? ` data-pdf-color="${color}"` : "");
  return `<pre${attrs}>${escapeHtml(text.replace(/\n+$/, ""))}</pre>`;
}

/** Re-parse untrusted output HTML on its own and return clean, balanced markup. */
function cleanHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link,meta,noscript,template,form,input,button").forEach((e) => e.remove());
  // Only inline data: images; never fetch anything.
  doc.querySelectorAll("img").forEach((img) => {
    if (!/^data:image\//i.test(img.getAttribute("src") ?? "")) img.removeAttribute("src");
  });
  return doc.body.innerHTML;
}

function htmlText(html: string): string {
  return new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
}

/** Protect $…$ and $$…$$ from Markdown emphasis; formulas are printed as their LaTeX source. */
function stashMath(src: string): { text: string; restore: (html: string) => string } {
  const stash: string[] = [];
  const text = src.replace(/\$\$[\s\S]+?\$\$|(?<![\\$])\$(?!\s)[^$\n]+?(?<!\s)\$/g, (m) => {
    stash.push(m);
    return `MATHSTASH${stash.length - 1}X`;
  });
  return { text, restore: (html) => html.replace(/MATHSTASH(\d+)X/g, (_m, i) => escapeHtml(stash[+i])) };
}

export type NotebookHtmlOptions = { hideCode: boolean; prompts: boolean };

export type NotebookStats = { markdown: number; code: number; images: number; errors: number; html: number; interactive: number };

export function notebookToHtml(nb: Notebook, opts: NotebookHtmlOptions): { html: string; stats: NotebookStats } {
  const parts: string[] = [];
  const stats: NotebookStats = { markdown: 0, code: 0, images: 0, errors: 0, html: 0, interactive: 0 };
  for (const cell of nb.cells) {
    const src = join(cell.source);
    if (cell.cell_type === "markdown") {
      stats.markdown++;
      let text = src;
      // Pasted images live in the cell as attachments: attachment:name.png
      if (cell.attachments) {
        text = text.replace(/attachment:([^\s)"']+)/g, (m, name: string) => {
          const att = cell.attachments?.[decodeURIComponent(name)];
          if (!att) return m;
          const mime = Object.keys(att).find((k) => k.startsWith("image/"));
          return mime ? `data:${mime};base64,${join(att[mime]).replace(/\s+/g, "")}` : m;
        });
      }
      const { text: safe, restore } = stashMath(text);
      parts.push(`<div>${cleanHtml(restore(markdownToHtml(safe)))}</div>`);
      continue;
    }
    if (cell.cell_type === "raw") {
      if (src.trim()) parts.push(preBlock(src));
      continue;
    }
    if (cell.cell_type !== "code") continue;
    stats.code++;
    const n = cell.execution_count ?? " ";
    if (!opts.hideCode && src.trim()) {
      if (opts.prompts) parts.push(prompt(`In [${n}]:`));
      parts.push(`<pre data-pdf-shade="${CODE_SHADE}"><code>${highlight(src, nb.language)}</code></pre>`);
    }
    for (const out of cell.outputs ?? []) {
      const ot = out.output_type;
      if (ot === "stream") {
        const text = resolveCR(stripAnsi(join(out.text)));
        if (text.trim()) parts.push(preBlock(text, out.name === "stderr" ? STDERR_SHADE : undefined));
        continue;
      }
      if (ot === "error") {
        stats.errors++;
        const tb = out.traceback?.length ? out.traceback.map(stripAnsi).join("\n") : `${out.ename}: ${out.evalue}`;
        parts.push(preBlock(tb, ERROR_SHADE, "#82071e"));
        continue;
      }
      if (ot !== "execute_result" && ot !== "display_data") continue;
      const data = out.data ?? {};
      if (ot === "execute_result" && opts.prompts && !opts.hideCode) parts.push(prompt(`Out[${out.execution_count ?? n}]:`));
      const meta = (out.metadata ?? {}) as Record<string, { width?: number } | undefined>;
      const img = (["image/png", "image/jpeg", "image/svg+xml"] as const).find((k) => data[k]);
      if (img) {
        stats.images++;
        const body = join(data[img] as Multi);
        const src =
          img === "image/svg+xml"
            ? `data:image/svg+xml;base64,${toBase64(new TextEncoder().encode(body))}`
            : `data:${img};base64,${body.replace(/\s+/g, "")}`;
        const w = meta[img]?.width;
        parts.push(`<p><img src="${src}"${w ? ` width="${Math.round(w)}"` : ""} alt="Figure"></p>`);
        continue;
      }
      if (data["text/html"]) {
        const html = cleanHtml(join(data["text/html"] as Multi));
        // Script-driven outputs (Plotly, Bokeh, widgets) are empty once scripts are removed.
        if (/<(table|img)\b/i.test(html) || htmlText(html).trim()) {
          stats.html++;
          parts.push(`<div>${html}</div>`);
          continue;
        }
      }
      if (data["text/markdown"]) {
        parts.push(`<div>${cleanHtml(markdownToHtml(join(data["text/markdown"] as Multi)))}</div>`);
        continue;
      }
      const plain = data["text/plain"] ?? data["text/latex"];
      if (plain) parts.push(preBlock(stripAnsi(join(plain as Multi))));
      else if (Object.keys(data).length) {
        stats.interactive++;
        parts.push(`<p data-pdf-color="${MUTED}"><em>[Interactive output (${escapeHtml(Object.keys(data)[0])}) can't be printed. Save the chart as a static image in the notebook to include it.]</em></p>`);
      }
    }
  }
  return { html: parts.join("\n"), stats };
}

/** Title for the PDF: notebook metadata, else the first heading. */
export function notebookTitle(nb: Notebook): string | undefined {
  if (nb.title) return nb.title;
  for (const c of nb.cells) {
    if (c.cell_type !== "markdown") continue;
    const m = join(c.source).match(/^#\s+(.+)$/m);
    if (m) return m[1].trim();
  }
  return undefined;
}
