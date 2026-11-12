import type { Metadata } from "next";
import Link from "next/link";
import { Lock, WifiOff, BadgeCheck, Gauge } from "lucide-react";
import ToolIcon from "@/components/ToolIcon";
import JsonLd from "@/components/JsonLd";
import ToolFilter from "@/components/ToolFilter";
import { registry, groups } from "@/lib/registry";
import { siteUrl, siteName, organizationJsonLd, organizationId } from "@/lib/site";

const title = "Free PDF Tools — Compress, Merge, OCR, No Upload | PDFCompact";
const description = `${registry.length} free PDF tools that run in your browser: compress, merge, split, OCR, convert, sign and protect. No upload, no sign-up, no watermark.`;

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
};

const jobs: { job: string; slug: string }[] = [
  { job: "Make a PDF small enough to email or upload", slug: "compress-pdf" },
  { job: "Join several PDFs into one", slug: "merge-pdf" },
  { job: "Send only some pages of a PDF", slug: "extract-pdf-pages" },
  { job: "Make a scanned PDF searchable or copyable", slug: "ocr-pdf" },
  { job: "Scan paper documents with your phone", slug: "scan-to-pdf" },
  { job: "Edit the text of a PDF in Word", slug: "pdf-to-word" },
  { job: "Turn photos into one PDF", slug: "jpg-to-pdf" },
  { job: "Sign a contract or form", slug: "sign-pdf" },
  { job: "See what changed between two versions", slug: "compare-pdf" },
  { job: "Stop others opening a PDF", slug: "protect-pdf" },
  { job: "Fit a portal's 2 MB or 5 MB limit by splitting", slug: "split-pdf-by-size" },
  { job: "Fix pages that are sideways or upside down", slug: "rotate-pdf" },
];

const faq = [
  {
    q: "Are these PDF tools really free?",
    a: "Yes. Every tool is free to use with no account, no watermark and no daily limit. There is no paid version hiding features.",
  },
  {
    q: "Are my files uploaded to a server?",
    a: "No. Every tool runs in your web browser with JavaScript and WebAssembly. Your files are read and written on your own device and are never sent to us or anyone else.",
  },
  {
    q: "Is there a file size limit?",
    a: "There's no limit set by us, but your device's memory is the real limit. Files of a few hundred megabytes work on most laptops; phones handle less. Each tool's page lists its practical limits.",
  },
  {
    q: "Do the tools work offline?",
    a: "Yes, once a tool's page has loaded. Because processing happens on your device, you can switch off Wi-Fi and the tool keeps working. OCR downloads its language file the first time you use that language.",
  },
  {
    q: "Do they work on iPhone and Android?",
    a: "Yes. Every tool works in Safari and Chrome on phones. Scan to PDF uses the phone camera directly. Very large files are better handled on a laptop.",
  },
  {
    q: "Which browsers are supported?",
    a: "Current versions of Chrome, Edge, Firefox and Safari on Windows, macOS, Linux, Android and iOS.",
  },
  {
    q: "Can PDFCompact see my documents?",
    a: "No. We never receive your files, so we can't see, store or share them. We use privacy-friendly page-view analytics without cookies; it records which pages are visited, not what's in your files.",
  },
];

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd,
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: siteName,
        url: siteUrl,
        description,
        publisher: { "@id": organizationId },
        inLanguage: "en",
      },
      {
        "@type": "ItemList",
        name: "PDF tools",
        numberOfItems: registry.length,
        itemListElement: registry.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.name,
          description: t.short,
          url: `${siteUrl}/${t.slug}`,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="flex flex-1 flex-col">
      <JsonLd data={jsonLd} />

      <section className="bg-gradient-to-b from-red-50 to-white dark:from-red-950/20 dark:to-zinc-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-10 pb-8 sm:pt-16 sm:pb-12 text-center">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-balance">
            Free PDF Tools — Compress, Merge, Convert and OCR in Your Browser
          </h1>
          <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            {registry.length} tools for every PDF job. Nothing is uploaded: your files are processed on
            your own device. No sign-up, no watermark.
          </p>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <li className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-red-600" aria-hidden="true" /> Nothing uploaded</li>
            <li className="flex items-center gap-1.5"><WifiOff className="h-4 w-4 text-red-600" aria-hidden="true" /> Works offline</li>
            <li className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-red-600" aria-hidden="true" /> No watermark</li>
            <li className="flex items-center gap-1.5"><Gauge className="h-4 w-4 text-red-600" aria-hidden="true" /> No queue, no waiting</li>
          </ul>
        </div>
      </section>

      <section id="tools" aria-label="All PDF tools" className="mx-auto max-w-6xl px-4 sm:px-6 pb-6 w-full scroll-mt-20">
        <ToolFilter />
        <div className="grid gap-10 mt-6">
          {groups.map((g) => (
            <div key={g.id} id={g.id} className="scroll-mt-20" data-group>
              <h2 className="text-xl sm:text-2xl font-bold">{g.name}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 mb-4">{g.blurb}</p>
              <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {registry
                  .filter((t) => t.group === g.id)
                  .map((t) => (
                    <li key={t.slug} data-tool={`${t.name} ${t.short}`.toLowerCase()}>
                      <Link
                        href={`/${t.slug}`}
                        className="group flex gap-3 h-full rounded-xl border border-black/10 dark:border-white/10 p-4 hover:border-red-400 hover:shadow-md transition-all bg-white dark:bg-zinc-900"
                      >
                        <ToolIcon name={t.icon} className="h-6 w-6 shrink-0 text-red-600 mt-0.5" />
                        <span>
                          <span className="block font-semibold group-hover:text-red-600">{t.name}</span>
                          <span className="block text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">{t.short}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 w-full article">
        <h2 id="which-tool">Which PDF tool do I need?</h2>
        <p>Find your job in the left column. Each tool is a separate page built for that one task.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>I want to…</th><th>Use</th></tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const t = registry.find((x) => x.slug === j.slug)!;
                return (
                  <tr key={j.slug}>
                    <td>{j.job}</td>
                    <td><Link href={`/${t.slug}`}>{t.name}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h2 id="why-no-upload">Why nothing is uploaded</h2>
        <p>
          Most online PDF sites send your file to their server, process it there and send it back.
          PDFCompact doesn&apos;t. When you open a tool, your browser downloads the program itself
          (a few hundred kilobytes of JavaScript, plus a WebAssembly engine for OCR) and runs it on
          your device. Your PDF is read from your disk into the page&apos;s memory, changed there, and
          saved straight back to your downloads.
        </p>
        <p>
          That matters when the file is a CV, a passport scan, a payslip, a medical letter or a
          contract. There&apos;s no copy on someone else&apos;s server to leak, no retention policy to
          trust, and no upload time on a slow connection. You can check it yourself: load a tool,
          turn off Wi-Fi, and it still works. <Link href="/how-it-works">Read how it works</Link>.
        </p>

        <h2 id="most-used">The most-used tools</h2>
        <h3>Compress PDF</h3>
        <p>
          Shrinks PDFs by re-compressing the photos and scans inside them. Pick one of three levels and
          see the new size before you download. Best for email attachments and upload portals with a
          size limit. <Link href="/compress-pdf">Compress a PDF</Link>.
        </p>
        <h3>Merge PDF</h3>
        <p>
          Joins two or more PDFs into one file in the order you choose, without touching the quality of
          any page. <Link href="/merge-pdf">Merge PDFs</Link>.
        </p>
        <h3>OCR PDF</h3>
        <p>
          Recognises the text in scanned pages and adds an invisible text layer, so you can search,
          select and copy it. Supports English, Hindi, Spanish, French, German and Portuguese.{" "}
          <Link href="/ocr-pdf">Make a PDF searchable</Link>.
        </p>
        <h3>Split PDF</h3>
        <p>
          Cuts a PDF into parts by page range or every few pages. To split by file size instead, use{" "}
          <Link href="/split-pdf-by-size">Split PDF by Size</Link>. <Link href="/split-pdf">Split a PDF</Link>.
        </p>
        <h3>Compare PDF</h3>
        <p>
          Puts two versions side by side and highlights every changed word, with changed numbers and
          dates flagged so you don&apos;t miss an edited price or deadline.{" "}
          <Link href="/compare-pdf">Compare two PDFs</Link>.
        </p>
        <h3>Scan to PDF</h3>
        <p>
          Uses your phone&apos;s camera to capture paper pages, cleans them up for contrast and saves one
          PDF. No app to install. <Link href="/scan-to-pdf">Scan a document</Link>.
        </p>

        <h2 id="faq">Frequently asked questions</h2>
        {faq.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
