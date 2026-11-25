/**
 * Markdown → HTML for the PDF layout engine (Markdown to PDF and the
 * Markdown cells of Jupyter Notebook to PDF).
 *
 * Safety: the HTML is never inserted into the page. It is parsed with
 * DOMParser (scripts in a parsed document never run) and walked by
 * lib/html-layout.ts, which only draws text, tables and data: images.
 * Remote images are not fetched, so converting a file makes no requests.
 */
import { Marked } from "marked";
import { escapeHtml, highlight } from "./syntax";

export const CODE_SHADE = "#f3f4f6";

const md = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    code({ text, lang }) {
      return `<pre data-pdf-shade="${CODE_SHADE}"><code>${highlight(text.replace(/\n$/, ""), lang)}</code></pre>\n`;
    },
    // The layout engine skips <input>; draw GitHub task list boxes as text.
    checkbox({ checked }) {
      return checked ? "[x] " : "[ ] ";
    },
  },
});

export function markdownToHtml(source: string): string {
  const html = md.parse(source, { async: false }) as string;
  // Task lists print like GitHub: the [x] box replaces the bullet.
  return html.replace(/<ul>(\s*<li>\[[ x]\] )/g, '<ul style="list-style-type:none">$1');
}

/** Parse an HTML string into a detached document body the layout engine can walk. */
export function htmlBody(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html").body;
}

export { escapeHtml };
