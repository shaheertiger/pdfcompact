"use client";

import { useRef, useState } from "react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, Field, FileBar, InfoNote, Progress, ResultPanel, inputClass, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, isPdf, pdfBlob } from "@/lib/download";
import { PdfLoadError, formatPages, loadEditable, pagesToPdf, tick, useThumbSource, type ThumbSource } from "@/lib/page-tools";
import { PageGrid, QuickPick, StickyBar, usePageSelection } from "./PagePicker";

export default function DeletePagesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { source, error: openError } = useThumbSource(file);

  if (!file) {
    return (
      <div>
        <Dropzone
          onFiles={(files) => {
            setError(null);
            if (!isPdf(files[0])) return setError("That isn't a PDF. Choose a .pdf file.");
            setFile(files[0]);
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
        detail={source ? `${source.pageCount} pages · ${formatBytes(file.size)}` : formatBytes(file.size)}
        onReset={() => setFile(null)}
      />
      {openError && <ErrorNote>{openError}</ErrorNote>}
      {!source && !openError && <InfoNote>Reading the PDF…</InfoNote>}
      {source && <Editor key={source.pageCount + file.name} file={file} source={source} onReset={() => setFile(null)} />}
    </div>
  );
}

function Editor({ file, source, onReset }: { file: File; source: ThumbSource; onReset: () => void }) {
  const n = source.pageCount;
  const sel = usePageSelection(n);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; removed: string; removedCount: number; left: number } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const count = sel.selected.size;
  const all = count === n;

  const handleDelete = async () => {
    if (count === 0 || all) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0.1);
    try {
      await tick();
      const doc = await loadEditable(await file.arrayBuffer());
      setProgress(0.5);
      await tick();
      const keep = Array.from({ length: n }, (_, i) => i).filter((i) => !sel.selected.has(i));
      const bytes = await pagesToPdf(doc, keep);
      setProgress(1);
      setResult({
        file: { blob: pdfBlob(bytes), name: `${baseName(file.name)}-trimmed.pdf` },
        removed: formatPages(sel.selected),
        removedCount: sel.selected.size,
        left: keep.length,
      });
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } catch (e) {
      console.error(e);
      setError(e instanceof PdfLoadError ? e.message : "Couldn't save the PDF. Try re-saving it with Print to PDF first.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Field label="Pages to delete" hint="Tap pages below, or type numbers and ranges like 2, 5-7. Shift-click selects a run.">
        <input
          className={`${inputClass} text-base sm:text-sm`}
          value={sel.text}
          placeholder="e.g. 2, 5-7"
          autoComplete="off"
          onChange={(e) => {
            sel.onText(e.target.value);
            setResult(null);
          }}
        />
      </Field>
      {sel.textError && <ErrorNote>{sel.textError}</ErrorNote>}
      <div className="mt-3">
        <QuickPick
          pageCount={n}
          onPick={(s) => {
            sel.apply(s);
            setResult(null);
          }}
        />
      </div>

      <div ref={resultRef}>
        {result && (
          <ResultPanel
            title="Pages deleted"
            files={[result.file]}
            originalSize={file.size}
            note={`Removed ${result.removedCount === 1 ? "page" : "pages"} ${result.removed}. ${result.left} ${result.left === 1 ? "page" : "pages"} left.`}
            onReset={onReset}
            resetLabel="Edit another PDF"
          />
        )}
      </div>
      <ErrorNote>{error}</ErrorNote>

      <PageGrid
        source={source}
        selected={sel.selected}
        variant="delete"
        onToggle={(i, shift) => {
          sel.toggle(i, shift);
          setResult(null);
        }}
      />

      <StickyBar>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <ActionButton onClick={handleDelete} busy={busy} disabled={count === 0 || all || !!sel.textError}>
            {count === 0 ? "Delete pages" : `Delete ${count} ${count === 1 ? "page" : "pages"}`}
          </ActionButton>
          <span className="text-sm text-zinc-600 dark:text-zinc-400 text-center sm:text-left">
            {all
              ? "You can't delete every page. Leave at least one."
              : count === 0
                ? `Tap the pages you want to remove (${n} pages).`
                : `${n - count} of ${n} pages will be kept.`}
          </span>
        </div>
        {busy && <Progress value={progress} label="Saving" />}
      </StickyBar>
    </div>
  );
}
