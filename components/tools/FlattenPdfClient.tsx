"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, InfoNote, Progress, ResultPanel, Segmented, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, isPdf, pdfBlob } from "@/lib/download";
import type { FlattenInfo } from "@/lib/flatten";

type Mode = "forms" | "everything";
type Quality = "small" | "standard" | "high";

const QUALITY: Record<Quality, { dpi: number; quality: number; label: string; hint: string }> = {
  small: { dpi: 100, quality: 0.75, label: "Smaller file", hint: "100 DPI. Fine on screen, small print gets soft." },
  standard: { dpi: 150, quality: 0.82, label: "Standard", hint: "150 DPI. Sharp on screen, OK to print." },
  high: { dpi: 220, quality: 0.88, label: "High", hint: "220 DPI. Crisp printing, bigger file." },
};

export default function FlattenPdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<FlattenInfo | null>(null);
  const [mode, setMode] = useState<Mode>("forms");
  const [comments, setComments] = useState(true);
  const [quality, setQuality] = useState<Quality>("standard");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; note: string } | null>(null);

  const friendly = (e: unknown) => {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "encrypted" || (e instanceof Error && /password/i.test(e.message)))
      return "This PDF needs a password to open. Remove the password first, then try again.";
    return "Couldn't read this PDF. It may be damaged or not a real PDF. Try re-saving it with Print to PDF.";
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    setResult(null);
    setError(null);
    setInfo(null);
    if (!f || !isPdf(f)) {
      setError("That isn't a PDF. Choose a .pdf file.");
      return;
    }
    setFile(f);
    try {
      const { loadForFlatten, inspect } = await import("@/lib/flatten");
      const doc = await loadForFlatten(new Uint8Array(await f.arrayBuffer()));
      setInfo(inspect(doc));
    } catch (e) {
      setError(friendly(e));
    }
  };

  const reset = () => {
    setFile(null);
    setInfo(null);
    setResult(null);
    setError(null);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let out: Uint8Array;
      let note: string;
      if (mode === "forms") {
        setProgress({ value: 0.3, label: "Flattening fields" });
        const { loadForFlatten, flattenAnnotations } = await import("@/lib/flatten");
        const doc = await loadForFlatten(bytes);
        const r = flattenAnnotations(doc, comments);
        setProgress({ value: 0.8, label: "Saving" });
        out = await doc.save({ useObjectStreams: true });
        const parts = [`${r.widgets} form field ${r.widgets === 1 ? "widget" : "widgets"}`];
        if (comments) parts.push(`${r.comments} ${r.comments === 1 ? "comment or markup" : "comments and markups"}`);
        note =
          r.widgets + r.comments === 0
            ? "There was nothing to flatten in this mode: no form fields" +
              (comments ? " or comments" : "") +
              " with a visible appearance. The file is re-saved without its (empty) form."
            : `Flattened ${parts.join(" and ")}. The values are now part of the page and can't be edited. The rest of the text is still selectable.`;
      } else {
        const { rasterizePdf } = await import("@/lib/compress");
        const q = QUALITY[quality];
        // Draw fields and comments into the page first, so checkboxes render from their
        // real value, then render. Encrypted files skip this step and render as they are.
        let source: Uint8Array = bytes;
        try {
          const { loadForFlatten, flattenAnnotations } = await import("@/lib/flatten");
          const doc = await loadForFlatten(bytes);
          flattenAnnotations(doc, true);
          source = await doc.save();
        } catch {
          source = bytes;
        }
        out = await rasterizePdf(source,{ dpi: q.dpi, quality: q.quality, grayscale: false }, (_s, cur, total) =>
          setProgress({ value: cur / total, label: `Rendering page ${cur} of ${total}` })
        );
        note = `Every page is now a single ${q.dpi} DPI image. Fields, comments and layers are gone, and text can no longer be selected or searched.`;
      }
      setResult({ file: { blob: pdfBlob(out), name: `${baseName(file.name)}-flattened.pdf` }, note });
    } catch (e) {
      setError(friendly(e));
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <>
        <Dropzone onFiles={onFiles} />
        <ErrorNote>{error}</ErrorNote>
      </>
    );
  }

  const found = info
    ? `Found ${info.fields} form ${info.fields === 1 ? "field" : "fields"} and ${info.comments} ${info.comments === 1 ? "comment" : "comments"}.`
    : null;

  return (
    <div>
      <FileBar name={file.name} detail={formatBytes(file.size)} onReset={reset} />
      {found && <p className="-mt-3 mb-4 text-sm text-zinc-600 dark:text-zinc-400">{found}</p>}
      <div className="grid gap-5">
        <Segmented<Mode>
          label="What to flatten"
          value={mode}
          onChange={setMode}
          options={[
            { value: "forms", label: "Flatten form fields", hint: "Locks filled-in values into the page. Text stays selectable." },
            { value: "everything", label: "Flatten everything", hint: "Turns each page into an image. Nothing stays editable." },
          ]}
        />
        {mode === "forms" ? (
          <>
            <label className="flex items-start gap-3 text-sm cursor-pointer min-h-10">
              <input
                type="checkbox"
                checked={comments}
                onChange={(e) => setComments(e.target.checked)}
                className="mt-0.5 h-5 w-5 accent-red-600 shrink-0"
              />
              <span>
                <span className="font-medium block">Also flatten comments, highlights and stamps</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  They become part of the page and can no longer be edited or deleted. Links keep working.
                </span>
              </span>
            </label>
            {info && info.fields === 0 && info.widgets === 0 && (
              <InfoNote>
                This PDF has no fillable form fields
                {info.comments ? "" : " or comments"}. If something still looks editable, use Flatten everything.
              </InfoNote>
            )}
          </>
        ) : (
          <>
            <Segmented<Quality>
              label="Image quality"
              value={quality}
              onChange={setQuality}
              options={(Object.keys(QUALITY) as Quality[]).map((k) => ({
                value: k,
                label: QUALITY[k].label,
                hint: QUALITY[k].hint,
              }))}
            />
            <p className="flex gap-2 rounded-lg border border-amber-300/70 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Every page becomes a picture. Text can no longer be selected, searched or copied, links stop working, and
                the file is often bigger. Use it when the result must look identical everywhere and never change.
              </span>
            </p>
          </>
        )}
        <div>
          <ActionButton onClick={run} busy={busy}>
            Flatten PDF
          </ActionButton>
        </div>
      </div>
      {progress && <Progress value={progress.value} label={progress.label} />}
      <ErrorNote>{error}</ErrorNote>
      {result && (
        <ResultPanel files={[result.file]} originalSize={file.size} note={result.note} onReset={reset} resetLabel="Flatten another PDF" />
      )}
    </div>
  );
}
