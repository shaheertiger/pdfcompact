# PDFCompact

Free, fast PDF tools that run entirely in the browser — no uploads, no accounts.
A project of [PDF Canada](https://pdfcanada.ca/).

## Tools

- Merge PDF (`/tools/merge-pdf`, legacy `/merge` redirects here)
- Split PDF (`/tools/split`)
- Rearrange Pages (`/tools/rearrange`)
- Remove Pages (`/tools/remove-pages`)
- Extract Pages (`/tools/extract`)
- PDF to Text (`/tools/pdf-to-text`)
- PDF to Word (`/tools/pdf-to-word`)
- Image to PDF (`/tools/image-to-pdf`)
- PDF to JPG (`/tools/pdf-to-jpg`)
- Edit PDF (`/tools/edit-pdf`)
- Sign PDF (`/tools/sign`)

All file processing happens client-side with [`pdf-lib`](https://github.com/Hopding/pdf-lib) and
[`pdfjs-dist`](https://github.com/mozilla/pdf.js) — files are never uploaded to a server.

## Adding a new tool (pSEO pattern)

Every tool's copy — name, one-line description, "about" paragraphs, how-to steps, and FAQ — lives
in one place: `lib/tools.ts`. `ToolPageShell` (`components/ToolPageShell.tsx`) reads that data and
renders the whole page: a compact, mobile-first-fold hero (icon + title + one-line description +
the tool itself, all visible without scrolling), body copy, trust badges, how-to steps, an FAQ
with `FAQPage` JSON-LD for rich results, and a `RelatedTools` grid that cross-links tools sharing a
`category` automatically. The homepage grid, header dropdown, footer links, and `sitemap.ts` all
render straight from the same `tools` array too.

That means adding a new tool page is just:

1. Add an entry to `tools` in `lib/tools.ts` (slug, name, description, icon, category, keywords,
   about, howTo, faq).
2. Build the tool's interactive `"use client"` component under `app/tools/<slug>/`.
3. Add a 12-line `page.tsx` that renders `<ToolPageShell tool={tool}><YourClient /></ToolPageShell>`.

No other file needs to change — navigation, sitemap, and cross-links all pick it up automatically.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm install` (via `postinstall`) and every `dev`/`build` run copy the pdf.js worker file into
`public/pdf.worker.min.mjs` automatically — no manual step needed.

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you have:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL, used in metadata, sitemap.xml, and robots.txt. |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | Your Google AdSense publisher ID (e.g. `ca-pub-1234567890123456`). Leave blank until approved — ads simply won't render. |
| `NEXT_PUBLIC_ADSENSE_SLOT_HOME` | Ad slot ID for the homepage placement. |
| `NEXT_PUBLIC_ADSENSE_SLOT_TOOL` | Ad slot ID for the placement shown under every tool. |

## Deploying to Vercel

1. Push this repository to GitHub (already done if you're reading this on the repo).
2. In [Vercel](https://vercel.com/new), import the `shaheertiger/pdfcompact` repository.
3. Framework preset: **Next.js** (auto-detected). No build command changes are needed —
   `npm run build` already runs the worker-copy step via `prebuild`.
4. Add the environment variables above in the Vercel project settings (Production and Preview).
5. Set your production domain (e.g. `pdfcompact.com`) under Project Settings → Domains, and set
   `NEXT_PUBLIC_SITE_URL` to match.
6. Deploy. Every push to the connected branch creates a preview deployment; merges to the
   production branch deploy to your live domain.

## Enabling Google AdSense

1. Apply for [Google AdSense](https://adsense.google.com/) with your live domain. Google reviews
   sites with real, working content and a Privacy Policy — both are already in place
   (`/privacy`, `/terms`, `/about`, `/contact`).
2. Once approved, set `NEXT_PUBLIC_ADSENSE_CLIENT` to your publisher ID and redeploy. The
   AdSense script (`components/AdSenseScript.tsx`) and ad units (`components/AdSlot.tsx`) are
   already wired up and will start rendering automatically — they render nothing while the env
   var is unset, so the site is ad-free (and safe to submit for review) until then.
3. Create ad units in AdSense and set `NEXT_PUBLIC_ADSENSE_SLOT_HOME` /
   `NEXT_PUBLIC_ADSENSE_SLOT_TOOL` to their slot IDs.
4. Update `public/ads.txt` with the line AdSense gives you
   (`google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`).

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [`pdf-lib`](https://github.com/Hopding/pdf-lib) for creating/editing PDFs
- [`pdfjs-dist`](https://github.com/mozilla/pdf.js) for rendering page thumbnails and extracting text
- [`docx`](https://github.com/dolanmiu/docx) for PDF → Word conversion
- [`jszip`](https://github.com/Stuk/jszip) for multi-file split downloads

### Why `pdfjs-dist` is pinned to an exact version

`pdfjs-dist` is pinned to an exact version (no `^`) rather than a range, for two reasons:

1. **Security**: versions `5.6.83`–`6.2.107` have a
   [known high-severity vulnerability](https://github.com/advisories/GHSA-hq66-cqwq-w95j)
   (arbitrary JS execution from a malicious PDF) — a real risk here since every tool renders
   user-uploaded PDFs. `npm audit` will flag this if the pin is loosened back to a caret range.
2. **Browser compatibility**: `6.x` versions use `Map.prototype.getOrInsertComputed`, a very
   recent JS feature not yet supported in most browsers, which silently breaks every
   thumbnail-based tool.

When bumping this dependency, pin to an exact version below `5.6.83`, or `6.2.108`+ once its
browser support has matured — and re-run `npm audit` plus a real browser test of the
thumbnail-based tools (Rearrange, Remove Pages, Extract, Edit PDF, Sign) before committing.
