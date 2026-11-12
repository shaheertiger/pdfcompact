"use client";

import { useRef, useState } from "react";
import Dropzone from "@/components/Dropzone";
import {
  ActionButton,
  ErrorNote,
  Field,
  FileBar,
  InfoNote,
  Progress,
  ResultPanel,
  Segmented,
  inputClass,
  type ResultFile,
} from "@/components/ui/kit";
import { baseName, formatBytes, isPdf, pdfBlob, zipFiles } from "@/lib/download";
import { PdfLoadError, formatPages, loadEditable, pagesToPdf, tick, useThumbSource, type ThumbSource } from "@/lib/page-tools";
import { PageGrid, QuickPick, StickyBar, usePageSelection } from "./PagePicker";

type Output = "single" | "separate";

export default function ExtractPagesClient() {
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
  const [output, setOutput] = useState<Output>("single");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; note: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const count = sel.selected.size;

  const handleExtract = async () => {
    if (count === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0.05);
    try {
      await tick();
      const doc = await loadEditable(await file.arrayBuffer());
      const pages = [...sel.selected].sort((a, b) => a - b);
      const base = baseName(file.name);
      const list = formatPages(pages);
      if (output === "single" || pages.length === 1) {
        const bytes = await pagesToPdf(doc, pages);
        const contiguous = pages[pages.length - 1] - pages[0] === pages.length - 1;
        const name =
          pages.length === 1
            ? `${base}-page-${pages[0] + 1}.pdf`
            : contiguous
              ? `${base}-pages-${pages[0] + 1}-${pages[pages.length - 1] + 1}.pdf`
              : `${base}-extract.pdf`;
        setResult({
          file: { blob: pdfBlob(bytes), name },
          note: `${pages.length} ${pages.length === 1 ? "page" : "pages"} (${list}) in one PDF.`,
        });
      } else {
        const files: { name: string; data: Uint8Array }[] = [];
        for (let k = 0; k < pages.length; k++) {
          files.push({ name: `${base}-page-${pages[k] + 1}.pdf`, data: await pagesToPdf(doc, [pages[k]]) });
          setProgress(0.1 + (0.8 * (k + 1)) / pages.length);
          await tick();
        }
        const zip = await zipFiles(files);
        setResult({
          file: { blob: zip, name: `${base}-pages.zip` },
          note: `${pages.length} separate PDFs (${list}) in one ZIP.`,
        });
      }
      setProgress(1);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } catch (e) {
      console.error(e);
      setError(e instanceof PdfLoadError ? e.message : "Couldn't save the pages. Try re-saving the PDF with Print to PDF first.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Field label="Pages to extract" hint="Tap pages below, or type numbers and ranges like 1-3, 8. Shift-click selects a run.">
        <input
          className={`${inputClass} text-base sm:text-sm`}
          value={sel.text}
          placeholder="e.g. 1-3, 8"
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
          includeAll
          onPick={(s) => {
            sel.apply(s);
            setResult(null);
          }}
        />
      </div>
      <div className="mt-4">
        <Segmented<Output>
          label="Save as"
          value={output}
          onChange={(v) => {
            setOutput(v);
            setResult(null);
          }}
          options={[
            { value: "single", label: "One PDF", hint: "All selected pages in one file" },
            { value: "separate", label: "Separate PDFs", hint: "One file per page, in a ZIP" },
          ]}
        />
      </div>

      <div ref={resultRef}>
        {result && (
          <ResultPanel
            title="Pages extracted"
            files={[result.file]}
            note={`${result.note} Your original file is unchanged.`}
            onReset={onReset}
            resetLabel="Extract from another PDF"
          />
        )}
      </div>
      <ErrorNote>{error}</ErrorNote>

      <PageGrid
        source={source}
        selected={sel.selected}
        variant="select"
        onToggle={(i, shift) => {
          sel.toggle(i, shift);
          setResult(null);
        }}
      />

      <StickyBar>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <ActionButton onClick={handleExtract} busy={busy} disabled={count === 0 || !!sel.textError}>
            {count === 0 ? "Extract pages" : `Extract ${count} ${count === 1 ? "page" : "pages"}`}
          </ActionButton>
          <span className="text-sm text-zinc-600 dark:text-zinc-400 text-center sm:text-left">
            {count === 0
              ? `Tap the pages you want to keep (${n} pages).`
              : output === "separate" && count > 1
                ? `${count} PDFs in a ZIP`
                : `One PDF with ${count} ${count === 1 ? "page" : "pages"}`}
          </span>
        </div>
        {busy && <Progress value={progress} label="Saving" />}
      </StickyBar>
    </div>
  );
}
