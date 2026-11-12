// Content linter. Runs before every build (npm run prebuild) and fails it on
// any rule break, so a page can't ship without its answer, limits, FAQ and
// a title that promises something. Run alone with: npm run check:content
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { registry } = await import(join(root, "lib", "registry.ts"));
const contentDir = join(root, "content", "tools");
const clientsIndex = readFileSync(join(root, "components", "tools", "index.tsx"), "utf8");

const STATIC_ROUTES = new Set(["/", "/about", "/contact", "/privacy", "/terms", "/how-it-works", "/es"]);
const SLUGS = new Set(registry.map((t) => t.slug));
const ES_SLUGS = new Set(registry.filter((t) => t.es).map((t) => t.es.slug));
const BANNED = [
  /no (file )?size limit/i,
  /unlimited (file )?size/i,
  /military[- ]grade/i,
  /bank[- ](level|grade)/i,
  /ai[- ]powered/i,
  /100\s?% accura/i,
  /(^|\s)#1(\s|$)/,
  /best in the world/i,
  /lightning[- ]fast/i,
];

const errors = [];
const warn = [];
const fail = (slug, msg) => errors.push(`${slug}: ${msg}`);

const words = (s) => (String(s ?? "").match(/[\p{L}\p{N}][\p{L}\p{N}'’.%-]*/gu) ?? []).length;
const today = new Date().toISOString().slice(0, 10);

function checkLinks(slug, text, where) {
  for (const m of String(text).matchAll(/\]\((\/[^)\s]*)\)|href="(\/[^"]*)"/g)) {
    const href = (m[1] ?? m[2]).split("#")[0] || "/";
    const path = href.replace(/\/$/, "") || "/";
    const esPage = path.startsWith("/es/") && ES_SLUGS.has(path.slice(4));
    if (!SLUGS.has(path.slice(1)) && !STATIC_ROUTES.has(path) && !esPage) {
      fail(slug, `broken internal link ${href} in ${where}`);
    }
  }
}

const titles = new Map();
const descriptions = new Map();

const pages = [
  ...registry.map((tool) => ({ tool, locale: "en", fileSlug: tool.slug, dir: "tools" })),
  ...registry.filter((t) => t.es).map((tool) => ({ tool, locale: "es", fileSlug: tool.es.slug, dir: "es" })),
];

// Locale-specific wording rules.
const L = {
  en: {
    free: /free/i,
    promise: /(\d|No Upload|No Sign[- ]?Up|No Watermark|No Install|Offline)/i,
    limitRows: ["price", "where it runs"],
    trouble: /troubleshoot|not working|problems|fix/i,
  },
  es: {
    free: /gratis/i,
    promise: /(\d|Sin subir|Sin registro|Sin marca de agua|Sin instalar|Sin conexión)/i,
    limitRows: ["precio", "dónde funciona"],
    trouble: /problemas|soluci|no funciona/i,
  },
};
// English words that must not appear in Spanish headings (half-translated pages).
const ENGLISH_IN_ES = /\b(the|and|how|with|your|what|why|file|files|free|page|pages|size)\b/i;

for (const { tool, locale, fileSlug, dir } of pages) {
  const { size } = tool;
  const slug = locale === "en" ? tool.slug : `es/${fileSlug}`;
  const file = join(root, "content", dir, `${fileSlug}.md`);
  const rules = L[locale];
  if (locale === "en" && !clientsIndex.includes(`"${tool.slug}":`)) fail(slug, "no client component registered in components/tools/index.tsx");
  if (!existsSync(file)) {
    fail(slug, `missing content file content/${dir}/${fileSlug}.md`);
    continue;
  }
  const { data: fm, content: body } = matter(readFileSync(file, "utf8"));

  // 1. Title: ≤ 62 chars, tool + measurable promise.
  const title = String(fm.title ?? "");
  if (!title) fail(slug, "missing title");
  if (title.length > 62) fail(slug, `title is ${title.length} chars (max 62): "${title}"`);
  if (!/—/.test(title)) fail(slug, `title needs "Tool — promise" with an em dash: "${title}"`);
  if (!rules.free.test(title)) fail(slug, `title must say ${locale === "es" ? "Gratis" : "Free"}: "${title}"`);
  if (!rules.promise.test(title))
    fail(slug, `title needs a measurable promise (a number or "No Upload"/"No Sign-Up"…): "${title}"`);
  if (titles.has(title)) fail(slug, `duplicate title with ${titles.get(title)}`);
  titles.set(title, slug);

  // 2. Meta description 110–160.
  const desc = String(fm.description ?? "");
  if (desc.length < 110 || desc.length > 160) fail(slug, `description is ${desc.length} chars (110–160)`);
  if (descriptions.has(desc)) fail(slug, `duplicate description with ${descriptions.get(desc)}`);
  descriptions.set(desc, slug);

  // 3–4. H1 and lead.
  const h1 = String(fm.h1 ?? "");
  if (!h1 || !/—/.test(h1)) fail(slug, `h1 must be "Tool — job": "${h1}"`);
  if (h1.length > 70) fail(slug, `h1 is ${h1.length} chars (max 70)`);
  if (!fm.lead || String(fm.lead).length > 120) fail(slug, "lead missing or over 120 chars");

  // 6. Quick answer 40–70 words.
  const aw = words(fm.answer);
  if (aw < 40 || aw > 70) fail(slug, `answer is ${aw} words (40–70)`);

  // 7. Limits table 6–9 rows.
  const limits = Array.isArray(fm.limits) ? fm.limits : [];
  if (limits.length < 6 || limits.length > 9) fail(slug, `limits has ${limits.length} rows (6–9)`);
  for (const l of limits) if (!l?.label || !l?.value) fail(slug, "limits row needs label and value");
  const labels = limits.map((l) => String(l?.label).toLowerCase());
  for (const need of rules.limitRows) {
    if (!labels.some((l) => l.includes(need))) fail(slug, `limits table needs a "${need}" row`);
  }

  // 8. How-to.
  const howto = fm.howto ?? {};
  if (!String(howto.question ?? "").endsWith("?")) fail(slug, "howto.question must be a question");
  const steps = Array.isArray(howto.steps) ? howto.steps : [];
  if (steps.length < 3 || steps.length > 7) fail(slug, `howto has ${steps.length} steps (3–7)`);
  for (const s of steps) if (!s?.name || !s?.text) fail(slug, "howto step needs name and text");

  // 9–12. Body: H2 searches, one table, use cases, troubleshooting table.
  const h2s = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  const h3s = [...body.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  const tables = (body.match(/^\|.*\|\s*\n\|\s*:?-{3,}/gm) ?? []).length;
  if (h2s.length < 3) fail(slug, `body has ${h2s.length} H2s (need 3+)`);
  if (h3s.length < (size === "main" ? 4 : 2)) fail(slug, `body has ${h3s.length} H3 use cases (need ${size === "main" ? 4 : 2}+)`);
  if (tables < 2) fail(slug, `body has ${tables} tables (need a comparison table and a troubleshooting table)`);
  if (!h2s.some((h) => rules.trouble.test(h))) fail(slug, "body needs a troubleshooting H2");
  if (/^# /m.test(body)) fail(slug, "body must not contain an H1 (the template renders it)");

  // 13. FAQ 6–8.
  const faq = Array.isArray(fm.faq) ? fm.faq : [];
  if (faq.length < 6 || faq.length > 8) fail(slug, `faq has ${faq.length} items (6–8)`);
  for (const f of faq) {
    if (!String(f?.q ?? "").endsWith("?")) fail(slug, `faq question must end with "?": ${f?.q}`);
    if (words(f?.a) < 8) fail(slug, `faq answer too short: ${f?.q}`);
  }

  if (locale === "es") {
    for (const h of [...h2s, ...h3s, howto.question, ...steps.map((st) => st?.name), ...faq.map((f) => f?.q)]) {
      if (ENGLISH_IN_ES.test(String(h ?? ""))) fail(slug, `English left in a Spanish heading: "${h}"`);
    }
  }

  // 14. Related 3–4 real siblings.
  const related = Array.isArray(fm.related) ? fm.related : [];
  if (related.length < 3 || related.length > 4) fail(slug, `related has ${related.length} tools (3–4)`);
  for (const r of related) {
    if (!SLUGS.has(r)) fail(slug, `related tool "${r}" doesn't exist`);
    if (r === slug) fail(slug, "related lists itself");
  }

  // Length.
  const allText = [
    fm.lead, fm.answer,
    ...limits.flatMap((l) => [l?.label, l?.value]),
    howto.question, ...steps.flatMap((s) => [s?.name, s?.text]),
    body,
    ...faq.flatMap((f) => [f?.q, f?.a]),
  ].join(" ");
  const total = words(allText.replace(/[|#*`>-]{2,}/g, " "));
  const min = size === "main" ? 800 : 500;
  if (total < min) fail(slug, `${total} words (min ${min} for a ${size} tool)`);
  if (total > 1900) warn.push(`${slug}: ${total} words; playbook range tops out near 1,500`);

  // Writing rules.
  for (const re of BANNED) if (re.test(allText) || re.test(title) || re.test(desc)) fail(slug, `banned claim matches ${re}`);
  checkLinks(slug, allText, "content");

  // Dates.
  const updated = fm.updated instanceof Date ? fm.updated.toISOString().slice(0, 10) : String(fm.updated ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updated)) fail(slug, "updated must be YYYY-MM-DD");
  else if (updated > today) fail(slug, `updated ${updated} is in the future`);
}

for (const f of readdirSync(contentDir)) {
  if (f.endsWith(".md") && !SLUGS.has(f.replace(/\.md$/, ""))) errors.push(`${f}: content file with no registry entry`);
}
for (const f of readdirSync(join(root, "content", "es"))) {
  if (f.endsWith(".md") && !ES_SLUGS.has(f.replace(/\.md$/, ""))) errors.push(`es/${f}: Spanish content file with no registry entry`);
}

for (const w of warn) console.warn(`warn  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error ${e}`);
  console.error(`\nContent check failed: ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`Content check passed: ${pages.length} tool pages (${registry.length} English, ${pages.length - registry.length} Spanish).`);
