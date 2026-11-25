"use client";

import { useState } from "react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, Progress, ResultPanel, Segmented, SecondaryButton, inputClass, type ResultFile } from "@/components/ui/kit";
import { formatBytes, pdfBlob } from "@/lib/download";
import type { LayoutOptions } from "@/lib/html-layout";
import { CheckOption, WarnNote } from "./convert-kit";

type Source = { name: string; text: string; size: number; pasted: boolean };

const SAMPLE = `# Project notes

Paste **Markdown** here, or drop a \`.md\` file above.

| Task | Owner | Done |
| --- | --- | :---: |
| Draft | Sam | yes |
| Review | Ana | no |

- [x] Tables, task lists and ~~strikethrough~~
- [ ] Code blocks with colours

\`\`\`python
def greet(name):
    return f"Hello, {name}"
\`\`\`
`;

export default function MarkdownToPdfClient() {
  const [source, setSource] = useState<Source | null>(null);
  const [draft, setDraft] = useState("");
  const [pageSize, setPageSize] = useState<LayoutOptions["pageSize"]>("letter");
  const [textSize, setTextSize] = useState<"10.5" | "12">("10.5");
  const [pageNumbers, setPageNumbers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; summary: string; warnings: string[] } | null>(null);

  const reset = () => {
    setSource(null);
    setResult(null);
    setError(null);
    setProgress(null);
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    reset();
    if (!f) return;
    if (!/\.(md|markdown|mdown|mkd|txt|text)$/i.test(f.name)) {
      setError("Choose a Markdown file (.md, .markdown or .txt).");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError("This file is over 20 MB, which is far more text than a Markdown document usually holds.");
      return;
    }
    setSource({ name: f.name, text: await f.text(), size: f.size, pasted: false });
  };

  const usePasted = () => {
    if (!draft.trim()) {
      setError("Paste some Markdown first.");
      return;
    }
    setError(null);
    setSource({ name: "document.md", text: draft, size: new Blob([draft]).size, pasted: true });
  };

  const convert = async () => {
    if (!source) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ value: 0.05, label: "Reading the Markdown…" });
    try {
      const { markdownToHtml } = await import("@/lib/markdown-pdf");
      const { htmlStringToPdf } = await import("@/lib/doc-pdf");
      // YAML front matter isn't part of the document body.
      const text = source.text.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
      const html = markdownToHtml(text);
      const base = source.name.replace(/\.(md|markdown|mdown|mkd|txt|text)$/i, "");
      const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || base;
      const out = await htmlStringToPdf(html, {
        pageSize,
        pageNumbers,
        title,
        baseSize: Number(textSize),
        onProgress: (v) => setProgress({ value: 0.1 + v * 0.85, label: "Laying out pages…" }),
      });
      setResult({
        file: { blob: pdfBlob(out.bytes), name: `${base}.pdf` },
        summary: `${out.pages} ${out.pages === 1 ? "page" : "pages"}${out.images ? `, ${out.images} ${out.images === 1 ? "image" : "images"}` : ""}. Text in the PDF is selectable and links are clickable.`,
        warnings: out.warnings,
      });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message ? e.message : "Couldn't convert this Markdown.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setResult(null);
  };

  if (!source) {
    return (
      <div>
        <Dropzone accept=".md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain" onFiles={onFiles} label="Drop a Markdown file (.md) here" hint="or tap to choose a file" />
        <div className="mt-5 grid gap-2">
          <label htmlFor="md-paste" className="text-sm font-medium">
            Or paste Markdown
          </label>
          <textarea
            id="md-paste"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={SAMPLE}
            rows={8}
            spellCheck={false}
            className={`${inputClass} font-mono text-xs leading-relaxed w-full`}
          />
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={usePasted} disabled={!draft.trim()}>
              Use pasted text
            </SecondaryButton>
            {!draft && <SecondaryButton onClick={() => setDraft(SAMPLE)}>Try an example</SecondaryButton>}
          </div>
        </div>
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  return (
    <div>
      <FileBar name={source.pasted ? "Pasted Markdown" : source.name} detail={formatBytes(source.size)} onReset={reset} />
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
          <Segmented
            label="Text size"
            value={textSize}
            onChange={touch(setTextSize)}
            options={[
              { value: "10.5", label: "Normal", hint: "10.5 pt, like a GitHub README" },
              { value: "12", label: "Large", hint: "12 pt, easier to read on paper" },
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
          <ResultPanel title="PDF ready" files={[result.file]} note={result.summary} onReset={reset} resetLabel="Convert another file" />
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
