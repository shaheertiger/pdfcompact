"use client";

import { useState } from "react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, Progress, ResultPanel, Segmented, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, pdfBlob } from "@/lib/download";
import { dataUriBytes, htmlToPdf, toEmbeddable, type LayoutOptions } from "@/lib/html-layout";
import { CheckOption, WarnNote } from "./convert-kit";

export default function EpubToPdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageSize, setPageSize] = useState<LayoutOptions["pageSize"]>("a4");
  const [font, setFont] = useState<LayoutOptions["font"]>("serif");
  const [textSize, setTextSize] = useState<"11" | "13">("11");
  const [pageNumbers, setPageNumbers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; pages: number; chapters: number; title: string; warnings: string[] } | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(null);
  };

  const onFiles = (files: File[]) => {
    const f = files[0];
    reset();
    const name = f.name.toLowerCase();
    if (/\.(mobi|azw3?|kfx|prc)$/.test(name)) {
      setError("Kindle files (.mobi, .azw, .azw3) aren't supported. Only EPUB files work, and only if they're DRM-free.");
      return;
    }
    if (!name.endsWith(".epub")) {
      setError("Choose an EPUB e-book (.epub).");
      return;
    }
    setFile(f);
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ value: 0.03, label: "Opening the e-book…" });
    try {
      const { readEpub, EpubError } = await import("@/lib/epub");
      let book;
      try {
        book = await readEpub(await file.arrayBuffer());
      } catch (e) {
        if (e instanceof EpubError) throw e;
        console.error(e);
        throw new Error("Couldn't read this e-book. It may be damaged or not a real EPUB file.");
      }
      setProgress({ value: 0.1, label: `Laying out ${book.chapters.length} chapters…` });
      const out = await htmlToPdf(book.chapters, {
        pageSize,
        font,
        baseSize: Number(textSize),
        pageNumbers,
        title: book.title || baseName(file.name),
        author: book.author,
        loadImage: async (src) => {
          const d = src.startsWith("data:") ? dataUriBytes(src) : await book.readImage(src);
          return d ? toEmbeddable(d.bytes, d.mime) : null;
        },
        onProgress: (v) => setProgress({ value: 0.1 + v * 0.85, label: `Laying out ${book.chapters.length} chapters…` }),
      });
      const warnings: string[] = [];
      if (out.replaced) {
        warnings.push(
          `${out.replaced} character${out.replaced === 1 ? " was" : "s were"} replaced with “?” (${out.samples.join(" ")}). The built-in PDF fonts only cover Latin-script text, so books in Greek, Cyrillic, Chinese, Arabic and similar scripts won't convert properly.`
        );
      }
      if (out.skippedImages) {
        warnings.push(`${out.skippedImages} image${out.skippedImages === 1 ? " couldn't" : "s couldn't"} be read and ${out.skippedImages === 1 ? "was" : "were"} left out.`);
      }
      setResult({
        file: { blob: pdfBlob(out.bytes), name: `${baseName(file.name)}.pdf` },
        pages: out.pages,
        chapters: book.chapters.length,
        title: book.title,
        warnings,
      });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message ? e.message : "Couldn't convert this e-book.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setResult(null);
  };

  if (!file) {
    return (
      <div>
        <Dropzone accept=".epub,application/epub+zip" onFiles={onFiles} label="Drop an EPUB e-book here" hint="or tap to choose a file" />
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  return (
    <div>
      <FileBar name={file.name} detail={formatBytes(file.size)} onReset={reset} />
      {!result && (
        <div className="grid gap-5">
          <Segmented
            label="Page size"
            value={pageSize}
            onChange={touch(setPageSize)}
            options={[
              { value: "a4", label: "A4", hint: "210 × 297 mm" },
              { value: "letter", label: "US Letter", hint: "8.5 × 11 in" },
            ]}
          />
          <Segmented
            label="Font"
            value={font}
            onChange={touch(setFont)}
            options={[
              { value: "serif", label: "Serif (Times)", hint: "Classic book look" },
              { value: "sans", label: "Sans serif (Helvetica)", hint: "Cleaner on screens" },
            ]}
          />
          <Segmented
            label="Text size"
            value={textSize}
            onChange={touch(setTextSize)}
            options={[
              { value: "11", label: "Normal", hint: "11 pt" },
              { value: "13", label: "Large", hint: "13 pt, fewer words per page" },
            ]}
          />
          <CheckOption checked={pageNumbers} onChange={touch(setPageNumbers)}>
            Add page numbers
          </CheckOption>
          <div>
            <ActionButton onClick={convert} busy={busy}>
              Convert to PDF
            </ActionButton>
          </div>
        </div>
      )}
      {progress && <Progress value={progress.value} label={progress.label} />}
      <ErrorNote>{error}</ErrorNote>
      {result && (
        <>
          <ResultPanel
            title="PDF ready"
            files={[result.file]}
            note={`${result.title ? `“${result.title}”: ` : ""}${result.chapters} ${result.chapters === 1 ? "chapter" : "chapters"}, ${result.pages} ${result.pages === 1 ? "page" : "pages"}. Each chapter starts on a new page.`}
            onReset={reset}
            resetLabel="Convert another e-book"
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
