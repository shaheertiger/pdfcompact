# Writing a tool page

Every tool page is one Markdown file: `content/tools/<slug>.md` (Spanish: `content/es/<spanish-slug>.md`).
The template (`components/ToolPage.tsx`) renders it in this order, the tool always first:

| # | Block | Where it lives | Rule (enforced by `npm run check:content`) |
|---|---|---|---|
| 1 | Title | `title` | ≤ 62 chars, `Tool Free — measurable promise` (a number or "No Upload"/"No Sign-Up") |
| 2 | Meta description | `description` | 110–160 chars, a feature list, only what's true |
| 3 | H1 | `h1` | `Tool — job`, ≤ 70 chars |
| 4 | Lead | `lead` | one line, ≤ 120 chars: what to do |
| 5 | The tool | `components/tools/<Name>Client.tsx` | above the fold on mobile |
| 6 | Quick answer | `answer` | 40–70 words, the direct answer with numbers |
| 7 | Limits table | `limits` | 6–9 rows; must include **Price** and **Where it runs** |
| 8 | How-to | `howto.question` + `howto.steps` | H2 is a question; 3–7 named steps; name the step people get wrong |
| 9 | Searches | body `##` | 3+ H2s that are real long-tail queries |
| 10 | One table | body | levels, sizes or a comparison |
| 11 | Use cases | body `###` | 4+ (main) / 2+ (small) H3s, **named destinations** ("for Gmail's 25 MB limit"), not adjectives |
| 12 | Troubleshooting | body `## Troubleshooting` | table: Problem · Fix · Why |
| 13 | FAQ | `faq` | 6–8; answer in the first sentence |
| 14 | Related | `related` | 3–4 true siblings (registry slugs) |

Length: main tools 800–1,500 words (compress: 1,500–2,200); small tools 500–800.

## Writing rules

- Every number must be true for our code. Measure, then publish the measured range.
- Banned: "no file size limit", "unlimited", "military-grade", "bank-level", "AI-powered", "100% accurate", "#1".
- Say what the tool can't do (handwriting, encrypted files, complex layouts). The honest line is what AI answers quote.
- Change `updated` only when facts on the page change; it feeds the sitemap's lastmod.
- Link other tools with plain Markdown: `[Split PDF](/split-pdf)`. The first plain-text mention of any other
  tool's name is auto-linked too.
- Spanish pages are fully Spanish: headings, steps, FAQ and the tool's buttons. The linter rejects common
  English words in Spanish headings.

## Adding a tool

1. Add an entry to `lib/registry.ts` (it has to pass the gate: works on 10 real files, has search demand,
   is a different job from every existing page).
2. Build `components/tools/<Name>Client.tsx` and register it in `components/tools/index.tsx`.
3. Write `content/tools/<slug>.md`. Navigation, homepage hub, sitemap, llms.txt and redirects update themselves.
