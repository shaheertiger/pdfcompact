"use client";

import { useState } from "react";
import Link from "next/link";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, Progress, ResultPanel, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, isPdf } from "@/lib/download";
import { loadPdfjs, openPdf } from "@/lib/pdfjs";
import { analysePage, writeDocx, type PageFlow } from "@/lib/pdf-docx";
import { CheckOption, WarnNote } from "./convert-kit";

export default function PdfToWordClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [includeImages, setIncludeImages] = useState(true);
  const [pageBreaks, setPageBreaks] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<{ file: ResultFile; summary: string; warnings: string[] } | null>(null);

  const reset = () => {
    setFile(null);
    setPageCount(0);
    setResult(null);
    setError(null);
    setScanned(false);
    setProgress(null);
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    reset();
    if (!isPdf(f)) {
      setError("That isn't a PDF. Choose a .pdf file.");
      return;
    }
    try {
      const pdf = await openPdf(await f.arrayBuffer());
      setPageCount(pdf.numPages);
      await pdf.destroy();
      setFile(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this PDF.");
    }
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setScanned(false);
    setResult(null);
    try {
      const pdfjs = await loadPdfjs();
      const pdf = await openPdf(await file.arrayBuffer());
      const pages: PageFlow[] = [];
      try {
        for (let i = 1; i <= pdf.numPages; i++) {
          setProgress({ value: ((i - 1) / pdf.numPages) * 0.9, label: `Reading page ${i} of ${pdf.numPages}…` });
          const page = await pdf.getPage(i);
          pages.push(await analysePage(page, pdfjs.OPS as unknown as Record<string, number>, includeImages));
          page.cleanup();
          await new Promise((r) => setTimeout(r));
        }
      } finally {
        await pdf.destroy();
      }
      const chars = pages.reduce((n, p) => n + p.chars, 0);
      if (chars < 10 * pages.length) {
        setScanned(true);
        return;
      }
      setProgress({ value: 0.93, label: "Writing the Word file…" });
      const blob = await writeDocx(pages, pageBreaks, () => import("docx"));
      const textless = pages.filter((p) => p.chars < 10 && p.pageImage).length;
      const paras = pages.reduce((n, p) => n + p.items.filter((it) => it.kind === "para").length, 0);
      const headings = pages.reduce((n, p) => n + p.items.filter((it) => it.kind === "para" && it.heading).length, 0);
      const tables = pages.reduce((n, p) => n + p.items.filter((it) => it.kind === "table").length, 0);
      const images = pages.reduce((n, p) => n + p.items.filter((it) => it.kind === "image").length, 0);
      const warnings: string[] = [];
      if (textless) {
        warnings.push(
          `${textless} ${textless === 1 ? "page has" : "pages have"} no selectable text (probably scanned), so ${textless === 1 ? "its" : "their"} words aren't in the Word file. Run the PDF through OCR PDF first to include them.`
        );
      }
      setResult({
        file: { blob, name: `${baseName(file.name)}.docx` },
        summary: `${pages.length} ${pages.length === 1 ? "page" : "pages"}: ${paras} paragraphs, ${headings} headings, ${tables} tables${includeImages ? `, ${images} images` : ""}.`,
        warnings,
      });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message ? e.message : "Couldn't convert this PDF.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const touch = (set: (v: boolean) => void) => (v: boolean) => {
    set(v);
    setResult(null);
  };

  if (!file) {
    return (
      <div>
        <Dropzone onFiles={onFiles} label="Drop a PDF here" />
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  return (
    <div>
      <FileBar
        name={file.name}
        detail={`${formatBytes(file.size)} · ${pageCount} ${pageCount === 1 ? "page" : "pages"}`}
        onReset={reset}
      />
      {!result && (
        <div className="grid gap-4">
          <div className="grid gap-0.5">
            <CheckOption checked={includeImages} onChange={touch(setIncludeImages)} hint="Photos and charts are copied in at their size on the page">
              Include images
            </CheckOption>
            <CheckOption checked={pageBreaks} onChange={touch(setPageBreaks)} hint="Turn off for one continuous document">
              Start each PDF page on a new Word page
            </CheckOption>
          </div>
          <div>
            <ActionButton onClick={convert} busy={busy}>
              Convert to Word
            </ActionButton>
          </div>
        </div>
      )}
      {progress && <Progress value={progress.value} label={progress.label} />}
      {scanned && (
        <ErrorNote>
          This PDF has no selectable text, so it&apos;s probably a scan or a photo. Run it through{" "}
          <Link href="/ocr-pdf" className="underline font-medium">
            OCR PDF
          </Link>{" "}
          first to add a text layer, then convert it here.
        </ErrorNote>
      )}
      <ErrorNote>{error}</ErrorNote>
      {result && (
        <>
          <ResultPanel
            title="Word file ready"
            files={[result.file]}
            note={result.summary}
            onReset={reset}
            resetLabel="Convert another PDF"
          />
          {result.warnings.map((w) => (
            <WarnNote key={w}>{w}</WarnNote>
          ))}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-sm text-zinc-500 hover:text-red-600 underline min-h-10"
            >
              Change options and convert again
            </button>
          </div>
        </>
      )}
    </div>
  );
}
