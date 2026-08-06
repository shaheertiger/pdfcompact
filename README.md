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
- Edit PDF (`/tools/edit-pdf`)
- Sign PDF (`/tools/sign`)

All file processing happens client-side with [`pdf-lib`](https://github.com/Hopding/pdf-lib) and
[`pdfjs-dist`](https://github.com/mozilla/pdf.js) — files are never uploaded to a server.

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
