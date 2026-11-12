"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, ScanText } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ErrorNote, FileBar, InfoNote, Progress, ResultPanel, SecondaryButton } from "@/components/ui/kit";
import { baseName, formatBytes, isPdf } from "@/lib/download";
import { openPdf } from "@/lib/pdfjs";
import { pageText } from "@/lib/pdf-text";
import { formatPages, tick } from "@/lib/page-tools";

/** A page with fewer visible characters than this is treated as having no text layer. */
const EMPTY_PAGE_CHARS = 15;

export default function PdfToTextClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [separators, setSeparators] = useState(true);
  const [copied, setCopied] = useState(false);
  const run = useRef(0);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const extract = async (f: File) => {
    const id = ++run.current;
    setFile(f);
    setPages([]);
    setTotal(0);
    setError(null);
    try {
      const pdf = await openPdf(await f.arrayBuffer());
      if (id !== run.current) return void pdf.destroy();
      setTotal(pdf.numPages);
      const out: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        out.push(await pageText(pdf, i));
        if (id !== run.current) return void pdf.destroy();
        // Update the preview every few pages so long files show progress without re-rendering on every page.
        if (i === pdf.numPages || i % 5 === 0) {
          setPages([...out]);
          await tick();
        }
      }
      void pdf.destroy();
    } catch (e) {
      if (id === run.current) setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => () => void run.current++, []);

  const reset = () => {
    run.current++;
    setFile(null);
    setPages([]);
    setTotal(0);
    setError(null);
  };

  const done = total > 0 && pages.length === total;
  const text = useMemo(
    () =>
      separators
        ? pages.map((p, i) => `--- Page ${i + 1} ---\n${p}`).join("\n\n")
        : pages.filter((p) => p.trim()).join("\n\n"),
    [pages, separators]
  );
  const blob = useMemo(() => new Blob([text], { type: "text/plain;charset=utf-8" }), [text]);
  const emptyPages = pages.map((p, i) => (p.replace(/\s/g, "").length < EMPTY_PAGE_CHARS ? i : -1)).filter((i) => i >= 0);
  const words = useMemo(() => (pages.join(" ").match(/\S+/g) ?? []).length, [pages]);
  const scanned = done && emptyPages.length === total;
  const partlyScanned = done && emptyPages.length > 0 && !scanned;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      textRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!file) {
    return (
      <div>
        <Dropzone
          onFiles={(files) => {
            if (!isPdf(files[0])) return setError("That isn't a PDF. Choose a .pdf file.");
            void extract(files[0]);
          }}
        />
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  return (
    <div>
      <FileBar
        name={file.name}
        detail={total ? `${total} ${total === 1 ? "page" : "pages"} · ${formatBytes(file.size)}` : formatBytes(file.size)}
        onReset={reset}
      />
      <ErrorNote>{error}</ErrorNote>

      {!error && !done && (
        <Progress value={total ? pages.length / total : 0} label={total ? `Reading page ${Math.min(pages.length + 1, total)} of ${total}` : "Opening the PDF…"} />
      )}

      {scanned && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-semibold flex items-center gap-2">
            <ScanText className="h-4 w-4" aria-hidden="true" /> This PDF looks scanned: there&apos;s no text to extract.
          </p>
          <p className="mt-1 text-zinc-700 dark:text-zinc-300">
            Its pages are pictures of text. Run it through{" "}
            <Link href="/ocr-pdf" className="font-medium text-red-600 underline">
              OCR PDF
            </Link>{" "}
            to recognize the words, then copy the text from there.
          </p>
        </div>
      )}
      {partlyScanned && (
        <InfoNote>
          {emptyPages.length === 1 ? "Page" : "Pages"} {formatPages(emptyPages)} {emptyPages.length === 1 ? "has" : "have"} no
          text layer (probably a scan or a picture). Use{" "}
          <Link href="/ocr-pdf" className="text-red-600 underline">
            OCR PDF
          </Link>{" "}
          to read {emptyPages.length === 1 ? "it" : "them"}.
        </InfoNote>
      )}

      {pages.length > 0 && !scanned && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-h-10 items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={separators}
                onChange={(e) => setSeparators(e.target.checked)}
                className="h-4 w-4 accent-red-600"
              />
              Add &ldquo;--- Page N ---&rdquo; between pages
            </label>
            <SecondaryButton onClick={copy} disabled={!done}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? "Copied" : "Copy text"}
            </SecondaryButton>
          </div>
          <label className="sr-only" htmlFor="pdf-text-preview">
            Extracted text
          </label>
          <textarea
            id="pdf-text-preview"
            ref={textRef}
            readOnly
            value={text}
            spellCheck={false}
            className="mt-2 w-full h-72 sm:h-96 rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50 p-3 text-[13px] leading-relaxed font-mono"
          />
          <InfoNote>
            {pages.length} {pages.length === 1 ? "page" : "pages"} · {words.toLocaleString("en-US")} words ·{" "}
            {text.length.toLocaleString("en-US")} characters
          </InfoNote>
        </>
      )}

      {done && !scanned && (
        <ResultPanel
          title="Text extracted"
          files={[{ blob, name: `${baseName(file.name)}.txt` }]}
          note="Plain UTF-8 text. Columns and tables come out as lines of text, not a layout."
          onReset={reset}
          resetLabel="Convert another PDF"
        />
      )}
    </div>
  );
}
