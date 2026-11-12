"use client";

import { useState } from "react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, Progress, ResultPanel, Segmented, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, pdfBlob } from "@/lib/download";
import { dataUriBytes, htmlToPdf, toEmbeddable, type LayoutOptions } from "@/lib/html-layout";
import { CheckOption, WarnNote } from "./convert-kit";

const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "u => u",
  "strike => s",
];

export default function WordToPdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageSize, setPageSize] = useState<LayoutOptions["pageSize"]>("a4");
  const [font, setFont] = useState<LayoutOptions["font"]>("sans");
  const [pageNumbers, setPageNumbers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; pages: number; warnings: string[] } | null>(null);

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
    if (name.endsWith(".doc") || name.endsWith(".rtf")) {
      setError(
        "Only .docx files are supported. Open this file in Word, Google Docs or LibreOffice and save it as .docx (Word Document), then try again."
      );
      return;
    }
    if (name.endsWith(".odt") || name.endsWith(".pages")) {
      setError("This format isn't supported. Export the document as .docx first, then try again.");
      return;
    }
    if (!name.endsWith(".docx") && !name.endsWith(".docm") && !name.endsWith(".dotx")) {
      setError("Choose a Word document (.docx).");
      return;
    }
    setFile(f);
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ value: 0.05, label: "Reading the document…" });
    try {
      const mammoth = await import("mammoth");
      let html: string;
      try {
        const out = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { styleMap: STYLE_MAP });
        html = out.value;
      } catch (e) {
        console.error(e);
        throw new Error(
          "Couldn't read this document. It may be damaged, password-protected, or not a real .docx file. Re-save it from Word and try again."
        );
      }
      const dom = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
      const body = dom.body;
      if (!body.textContent?.trim() && !body.querySelector("img")) {
        throw new Error("This document looks empty, so there's nothing to convert.");
      }
      const title = body.querySelector("h1")?.textContent?.trim() || baseName(file.name);
      setProgress({ value: 0.15, label: "Laying out pages…" });
      const out = await htmlToPdf([body], {
        pageSize,
        font,
        pageNumbers,
        title,
        loadImage: async (src) => {
          const d = dataUriBytes(src);
          return d ? toEmbeddable(d.bytes, d.mime) : null;
        },
        onProgress: (v) => setProgress({ value: 0.15 + v * 0.8, label: "Laying out pages…" }),
      });
      const warnings: string[] = [];
      if (out.skippedImages) {
        warnings.push(
          `${out.skippedImages} image${out.skippedImages === 1 ? " was" : "s were"} left out because ${out.skippedImages === 1 ? "it's" : "they're"} in a format browsers can't draw (often EMF or WMF clip art).`
        );
      }
      if (out.replaced) {
        warnings.push(
          `${out.replaced} character${out.replaced === 1 ? " was" : "s were"} replaced with “?” (${out.samples.join(" ")}). The built-in PDF fonts only cover Latin-script text.`
        );
      }
      setResult({ file: { blob: pdfBlob(out.bytes), name: `${baseName(file.name)}.pdf` }, pages: out.pages, warnings });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message ? e.message : "Couldn't convert this document.");
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
        <Dropzone
          accept=".docx,.docm,.dotx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onFiles={onFiles}
          label="Drop a Word document (.docx) here"
          hint="or tap to choose a file"
        />
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
              { value: "a4", label: "A4", hint: "Europe, most of the world" },
              { value: "letter", label: "US Letter", hint: "US, Canada" },
            ]}
          />
          <Segmented
            label="Font"
            value={font}
            onChange={touch(setFont)}
            options={[
              { value: "sans", label: "Sans serif", hint: "Helvetica, close to Calibri/Arial" },
              { value: "serif", label: "Serif", hint: "Times, close to Times New Roman" },
            ]}
          />
          <CheckOption checked={pageNumbers} onChange={touch(setPageNumbers)}>
            Add page numbers at the bottom
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
            note={`${result.pages} ${result.pages === 1 ? "page" : "pages"}. Open it and check the layout before you send it.`}
            onReset={reset}
            resetLabel="Convert another document"
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
