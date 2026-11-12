# PDFCompact

Free PDF and image tools that run entirely in the browser — nothing is uploaded, no account, no watermark.
A project of [PDF Canada](https://pdfcanada.ca/). Live at [pdfcompact.com](https://pdfcompact.com).

## How the site is put together

| Piece | Where | What it does |
| --- | --- | --- |
| Tool registry | `lib/registry.ts` | The one list of tools: slug, name, group, icon, size, legacy URLs, Spanish slug. |
| Tool clients | `components/tools/*Client.tsx` | The interactive tool, one file per tool, lazy-loaded via `components/tools/index.tsx`. |
| Page content | `content/tools/<slug>.md`, `content/es/<slug>.md` | Title, meta, H1, answer, limits, how-to, FAQ in frontmatter; the article in Markdown. |
| Template | `components/ToolPage.tsx` | Renders every tool page (English and Spanish) with one JSON-LD graph: WebApplication, HowTo, FAQPage, BreadcrumbList, Organization. |
| Routes | `app/(en)/[slug]`, `app/(es)/es/[slug]` | Flat URLs (`/compress-pdf`, `/es/comprimir-pdf`), statically generated, `dynamicParams = false`. |
| Linter | `scripts/check-content.mjs` | Runs before every build and fails it on a missing answer, short FAQ, title without a promise, banned claim or broken internal link. |
| Vendor assets | `scripts/copy-vendor-assets.mjs` → `public/vendor/` | Self-hosts the pdf.js worker, the Tesseract OCR worker/WASM and 6 OCR languages (no third-party CDN). |

Navigation, the homepage hub, the sitemap (with hreflang), `llms.txt` and the 308 redirects from old URLs are all
generated from the registry. See **[CONTENT.md](CONTENT.md)** for the page template and writing rules.

## Adding a tool

1. Check the gate: it works on 10 real files, it has search demand, and it's a different job from every existing page.
2. Add an entry to `lib/registry.ts`.
3. Build `components/tools/<Name>Client.tsx` and add it to `components/tools/index.tsx`.
4. Write `content/tools/<slug>.md` and run `npm run check:content`.

## Getting started

```bash
npm install
npm run dev
```

`npm install`, `dev` and `build` copy the worker/WASM/OCR files into `public/vendor/` automatically.
If you bump `pdfjs-dist`, `tesseract.js` or `tesseract.js-core`, update the versions in `lib/vendor.ts`
(the copy script fails loudly if they drift, because the versioned paths are served with an immutable cache header).

## Deploying to Vercel

1. Import the repo in Vercel (framework preset: Next.js, production branch `main`).
2. Domains: add `pdfcompact.com` and `www.pdfcompact.com`, and set the apex as primary so www redirects to it
   (next.config.ts also 308s `www` → apex). Every canonical tag uses the apex.
3. Environment: `NEXT_PUBLIC_SITE_URL=https://pdfcompact.com`. No secrets are needed; nothing runs server-side.
4. After the first production deploy: verify the site in Google Search Console and Bing Webmaster Tools and submit
   `/sitemap.xml`. Production builds ping IndexNow automatically (`scripts/indexnow.mjs`; key file in `public/`).
5. Turn on Vercel Web Analytics in the project dashboard (the `<Analytics />` component is already in the layouts).

## Ads

Off at launch, by design: ads above a tool slow it down and look untrustworthy. The playbook's rule is AdSense
*below the tool only*, and only after ~30K visits a month. When that happens, set `NEXT_PUBLIC_ADSENSE_CLIENT` and
`NEXT_PUBLIC_ADSENSE_SLOT_TOOL`, update `public/ads.txt` and the Privacy Policy; the CSP opens the AdSense hosts
automatically when the client ID is set.

## Security notes

- `pdfjs-dist` is pinned to `5.4.624`: versions `5.6.83`–`6.2.107` have a
  [high-severity advisory](https://github.com/advisories/GHSA-hq66-cqwq-w95j) (code execution from a malicious PDF),
  and 6.x needs JS features most browsers don't ship yet. Re-run `npm audit` and test thumbnail tools before bumping.
- A strict Content-Security-Policy (`next.config.ts`) blocks third-party scripts; workers and WASM load from the
  same origin only.
