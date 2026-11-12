import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { registry, type ToolEntry } from "@/lib/registry";

export type Limit = { label: string; value: string };
export type Step = { name: string; text: string };
export type Faq = { q: string; a: string };

export type ToolContent = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  answer: string;
  limits: Limit[];
  howto: { question: string; steps: Step[] };
  faq: Faq[];
  related: string[];
  updated: string;
  keywords: string[];
  /** Rendered article body (HTML), already auto-linked. */
  bodyHtml: string;
  /** H2 headings in the body, for the on-page contents list. */
  headings: { id: string; text: string }[];
};

export type ContentLocale = "en" | "es";

const CONTENT_DIRS: Record<ContentLocale, string> = {
  en: path.join(process.cwd(), "content", "tools"),
  es: path.join(process.cwd(), "content", "es"),
};

/** Link targets for auto-linking: other tools in the same language. */
function linkTargets(locale: ContentLocale): { slug: string; name: string; href: string }[] {
  if (locale === "es") {
    return registry
      .filter((t) => t.es)
      .map((t) => ({ slug: t.slug, name: t.es!.name, href: `/es/${t.es!.slug}` }));
  }
  return registry.map((t) => ({ slug: t.slug, name: t.name, href: `/${t.slug}` }));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toIsoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v ?? "");
}

/**
 * Link the first plain-text mention of every other tool's name, skipping
 * headings, existing links, code and tools the page already links to.
 */
export function autoLink(html: string, currentSlug: string, locale: ContentLocale = "en"): string {
  const candidates = linkTargets(locale)
    .filter((t) => t.slug !== currentSlug && !html.includes(`href="${t.href}"`))
    .sort((a, b) => b.name.length - a.name.length);
  const linked = new Set<string>();
  const parts = html.split(/(<[^>]+>)/);
  let blocked = 0;
  const blockers = /^<\/?(a|h[1-6]|code|pre|th|strong|summary)\b/i;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith("<")) {
      if (blockers.test(part)) blocked += part.startsWith("</") ? -1 : 1;
      continue;
    }
    if (blocked > 0 || !part.trim()) continue;
    let text = part;
    for (const t of candidates) {
      if (linked.has(t.slug)) continue;
      const re = new RegExp(`\\b(${t.name.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")})\\b`, "i");
      const m = text.match(re);
      if (!m || m.index === undefined) continue;
      text =
        text.slice(0, m.index) +
        `<a href="${t.href}">${m[1]}</a>` +
        text.slice(m.index + m[1].length);
      linked.add(t.slug);
    }
    parts[i] = text;
  }
  return parts.join("");
}

function renderBody(md: string, slug: string, locale: ContentLocale) {
  const headings: { id: string; text: string }[] = [];
  let html = marked.parse(md, { async: false, gfm: true }) as string;
  html = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, level: string, inner: string) => {
    const id = slugify(inner);
    if (level === "2") headings.push({ id, text: inner.replace(/<[^>]+>/g, "") });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  html = html
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, "</table></div>")
    .replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" rel="noopener" target="_blank"');
  return { html: autoLink(html, slug, locale), headings };
}

export function renderInline(md: string): string {
  return marked.parseInline(md, { async: false }) as string;
}

export function stripMarkdown(md: string): string {
  return md.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`]/g, "");
}

const cache = new Map<string, ToolContent>();

/** Load a tool's page content. `slug` is always the English registry slug. */
export function getToolContent(slug: string, locale: ContentLocale = "en"): ToolContent {
  const key = `${locale}:${slug}`;
  // Cache only in production builds so Markdown edits show up in `next dev`.
  const hit = process.env.NODE_ENV === "production" ? cache.get(key) : undefined;
  if (hit) return hit;
  const tool = registry.find((t) => t.slug === slug);
  const fileSlug = locale === "es" ? tool?.es?.slug : slug;
  if (!fileSlug) throw new Error(`No ${locale} page for ${slug}`);
  const file = path.join(CONTENT_DIRS[locale], `${fileSlug}.md`);
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  const { html, headings } = renderBody(content, slug, locale);
  const result: ToolContent = {
    slug,
    title: data.title,
    description: data.description,
    h1: data.h1,
    lead: data.lead,
    answer: data.answer,
    limits: data.limits ?? [],
    howto: data.howto ?? { question: "", steps: [] },
    faq: data.faq ?? [],
    related: data.related ?? [],
    updated: toIsoDate(data.updated),
    keywords: data.keywords ?? [],
    bodyHtml: html,
    headings,
  };
  cache.set(key, result);
  return result;
}

export function hasContent(slug: string, locale: ContentLocale): boolean {
  const tool = registry.find((t) => t.slug === slug);
  const fileSlug = locale === "es" ? tool?.es?.slug : slug;
  return Boolean(fileSlug) && fs.existsSync(path.join(CONTENT_DIRS[locale], `${fileSlug}.md`));
}

export function getRelated(content: ToolContent): ToolEntry[] {
  return content.related
    .map((s) => registry.find((t) => t.slug === s))
    .filter((t): t is ToolEntry => Boolean(t));
}
