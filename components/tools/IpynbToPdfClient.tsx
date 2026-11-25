"use client";

import { useState } from "react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, Progress, ResultPanel, Segmented, type ResultFile } from "@/components/ui/kit";
import { formatBytes, pdfBlob } from "@/lib/download";
import type { LayoutOptions } from "@/lib/html-layout";
import { CheckOption, WarnNote } from "./convert-kit";

export default function IpynbToPdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageSize, setPageSize] = useState<LayoutOptions["pageSize"]>("letter");
  const [hideCode, setHideCode] = useState(false);
  const [prompts, setPrompts] = useState(true);
  const [pageNumbers, setPageNumbers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; summary: string; warnings: string[] } | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(null);
  };

  const onFiles = (files: File[]) => {
    const f = files[0];
    reset();
    if (!f) return;
    const name = f.name.toLowerCase();
    if (name.endsWith(".py")) {
      setError("That's a Python script, not a notebook. Choose the .ipynb file (in Jupyter: File > Download > .ipynb).");
      return;
    }
    if (!name.endsWith(".ipynb") && !name.endsWith(".json")) {
      setError("Choose a Jupyter notebook (.ipynb).");
      return;
    }
    setFile(f);
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ value: 0.05, label: "Reading the notebook…" });
    try {
      const { parseNotebook, notebookToHtml, notebookTitle, NotebookError } = await import("@/lib/notebook");
      let nb;
      try {
        nb = parseNotebook(await file.text());
      } catch (e) {
        if (e instanceof NotebookError) throw e;
        throw new Error("Couldn't read this notebook.");
      }
      const { html, stats } = notebookToHtml(nb, { hideCode, prompts });
      if (!html.trim()) throw new Error("This notebook has no cells to print.");
      const { htmlStringToPdf } = await import("@/lib/doc-pdf");
      const base = file.name.replace(/\.(ipynb|json)$/i, "");
      setProgress({ value: 0.15, label: "Laying out pages…" });
      const out = await htmlStringToPdf(html, {
        pageSize,
        pageNumbers,
        title: notebookTitle(nb) ?? base,
        onProgress: (v) => setProgress({ value: 0.15 + v * 0.8, label: "Laying out pages…" }),
      });
      const bits = [
        `${out.pages} ${out.pages === 1 ? "page" : "pages"}`,
        `${stats.code} code ${stats.code === 1 ? "cell" : "cells"}${hideCode ? " (code hidden, outputs kept)" : ""}`,
        `${stats.markdown} Markdown ${stats.markdown === 1 ? "cell" : "cells"}`,
        `${out.images} ${out.images === 1 ? "figure" : "figures"}`,
      ];
      if (stats.interactive) {
        out.warnings.push(
          `${stats.interactive} interactive ${stats.interactive === 1 ? "output (such as a Plotly chart or widget) needs" : "outputs (such as Plotly charts or widgets) need"} JavaScript to draw and ${stats.interactive === 1 ? "is" : "are"} marked with a note instead. Save charts as static images (for Plotly: fig.show("png")) and convert again.`
        );
      }
            if (stats.errors) bits.push(`${stats.errors} error ${stats.errors === 1 ? "traceback" : "tracebacks"}`);
      setResult({
        file: { blob: pdfBlob(out.bytes), name: `${base}.pdf` },
        summary: `${bits.join(", ")}. Text in the PDF is selectable and searchable.`,
        warnings: out.warnings,
      });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message ? e.message : "Couldn't convert this notebook.");
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
          accept=".ipynb,application/x-ipynb+json,application/json"
          onFiles={onFiles}
          label="Drop a Jupyter notebook (.ipynb) here"
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
              { value: "letter", label: "US Letter", hint: "US, Canada" },
              { value: "a4", label: "A4", hint: "Europe, most of the world" },
            ]}
          />
          <div className="grid gap-1">
            <CheckOption checked={hideCode} onChange={touch(setHideCode)} hint="Keeps Markdown, charts, tables and printed results. Good for reports.">
              Hide code (inputs)
            </CheckOption>
            <CheckOption checked={prompts} onChange={touch(setPrompts)} disabled={hideCode}>
              Show In [n] / Out [n] labels
            </CheckOption>
            <CheckOption checked={pageNumbers} onChange={touch(setPageNumbers)}>
              Add page numbers at the bottom
            </CheckOption>
          </div>
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
          <ResultPanel title="PDF ready" files={[result.file]} note={result.summary} onReset={reset} resetLabel="Convert another notebook" />
          {result.warnings.map((w) => (
            <WarnNote key={w}>{w}</WarnNote>
          ))}
          <div className="mt-3">
            <button type="button" onClick={() => setResult(null)} className="text-sm text-zinc-500 hover:text-red-600 underline min-h-10">
              Change options and convert again
            </button>
          </div>
        </>
      )}
    </div>
  );
}
