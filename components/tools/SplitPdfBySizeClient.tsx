"use client";

import { useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import {
  ActionButton,
  ErrorNote,
  Field,
  FileBar,
  InfoNote,
  Progress,
  ResultPanel,
  inputClass,
} from "@/components/ui/kit";
import { baseName, downloadBlob, isPdf, pdfBlob, zipFiles } from "@/lib/download";
import { PDFDocument } from "pdf-lib";
import { MB, formatMB, splitBySize, type SizePart } from "@/lib/split-size";

const PRESETS = [2, 5, 10, 20, 25];

type Loaded = { file: File; pages: number };

export default function SplitPdfBySizeClient() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [preset, setPreset] = useState<number | "custom">(10);
  const [custom, setCustom] = useState("8");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [parts, setParts] = useState<SizePart[] | null>(null);
  const [zip, setZip] = useState<Blob | null>(null);
  const [removedLinks, setRemovedLinks] = useState(0);
  const [usedLimit, setUsedLimit] = useState(0);

  const limitMB = preset === "custom" ? parseFloat(custom.replace(",", ".")) : preset;
  const validLimit = Number.isFinite(limitMB) && limitMB >= 0.1 && limitMB <= 2000;

  const reset = () => {
    setLoaded(null);
    setParts(null);
    setZip(null);
    setError(null);
    setProgress(0);
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (!isPdf(f)) {
      setError(`"${f.name}" isn't a PDF. Choose a .pdf file.`);
      return;
    }
    setError(null);
    setParts(null);
    setZip(null);
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer());
      setLoaded({ file: f, pages: doc.getPageCount() });
    } catch (e) {
      setLoaded(null);
      setError(
        e instanceof Error && /encrypt/i.test(e.message)
          ? "This PDF is password-protected. Remove the password first, then try again."
          : "Couldn't read this PDF. It may be damaged or not a real PDF.",
      );
    }
  };

  const run = async () => {
    if (!loaded || !validLimit) return;
    setBusy(true);
    setError(null);
    setParts(null);
    setZip(null);
    setProgress(0);
    try {
      const src = await PDFDocument.load(await loaded.file.arrayBuffer());
      const limit = Math.floor(limitMB * MB);
      const res = await splitBySize(src, limit, async (done, total, label) => {
        setProgress((done / total) * 0.95);
        setProgressLabel(label);
        await new Promise((r) => setTimeout(r));
      });
      const name = baseName(loaded.file.name);
      const width = String(res.parts.length).length;
      const zipped = await zipFiles(
        res.parts.map((p, i) => ({ name: `${name}-part${String(i + 1).padStart(width, "0")}.pdf`, data: p.bytes })),
      );
      setParts(res.parts);
      setZip(zipped);
      setRemovedLinks(res.removedLinks);
      setUsedLimit(limit);
      setProgress(1);
    } catch {
      setError("Couldn't split this PDF. It may be damaged. Try re-saving it with Print to PDF, then split again.");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div>
        <Dropzone onFiles={onFiles} />
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  const name = baseName(loaded.file.name);
  const width = parts ? String(parts.length).length : 1;
  const oversize = parts?.filter((p) => p.oversize) ?? [];
  const alreadySmall = loaded.file.size <= (validLimit ? limitMB * MB : 0);

  return (
    <div>
      <FileBar
        name={loaded.file.name}
        detail={`${loaded.pages} page${loaded.pages === 1 ? "" : "s"} · ${formatMB(loaded.file.size)}`}
        onReset={reset}
      />

      <fieldset>
        <legend className="text-sm font-medium mb-2">Maximum size of each part</legend>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[...PRESETS, "custom" as const].map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={preset === p}
              onClick={() => {
                setPreset(p);
                setParts(null);
                setZip(null);
              }}
              className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors ${
                preset === p
                  ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300"
                  : "border-black/10 dark:border-white/10 hover:border-red-300"
              }`}
            >
              {p === "custom" ? "Custom" : `${p} MB`}
            </button>
          ))}
        </div>
      </fieldset>
      {preset === "custom" && (
        <div className="mt-3 max-w-xs">
          <Field label="Custom limit (MB)" hint="Between 0.1 and 2000. 1 MB = 1,000,000 bytes.">
            <input
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              className={inputClass}
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setParts(null);
                setZip(null);
              }}
            />
          </Field>
        </div>
      )}
      <InfoNote>
        Email limits count the encoded message, about a third bigger than the file: for Gmail&apos;s 25 MB pick 18 MB or
        less, for Outlook&apos;s 20 MB pick 14 MB.
        {validLimit && !alreadySmall && (
          <> This file should make about {Math.ceil(loaded.file.size / (limitMB * MB * 0.9))} parts.</>
        )}
      </InfoNote>
      {validLimit && alreadySmall && (
        <p className="mt-3 text-sm text-emerald-800 dark:text-emerald-300">
          This file is already under {limitMB} MB, so it would stay in one part. Pick a smaller limit to split it.
        </p>
      )}

      <div className="mt-5">
        <ActionButton onClick={run} busy={busy} disabled={!validLimit}>
          {busy ? "Splitting…" : validLimit ? `Split into parts under ${limitMB} MB` : "Enter a size limit"}
        </ActionButton>
      </div>
      {busy && <Progress value={progress} label={progressLabel} />}
      <ErrorNote>{error}</ErrorNote>

      {parts && zip && (
        <>
          <ResultPanel
            title={`${parts.length} part${parts.length === 1 ? "" : "s"} ready`}
            files={[{ blob: zip, name: `${name}-split-${limitMB}MB.zip` }]}
            note={
              <>
                Every part is a normal PDF with its pages unchanged.
                {removedLinks > 0 &&
                  ` ${removedLinks} internal link${removedLinks === 1 ? "" : "s"} (like table-of-contents jumps) pointed to other pages and were removed.`}
              </>
            }
            onReset={reset}
            resetLabel="Split another PDF"
          />
          {oversize.length > 0 && (
            <ErrorNote>
              {oversize.length === 1 ? "Page " : "Pages "}
              {oversize.map((p) => p.pages[0] + 1).join(", ")} {oversize.length === 1 ? "is" : "are each"} bigger than{" "}
              {formatMB(usedLimit)} on {oversize.length === 1 ? "its" : "their"} own, so{" "}
              {oversize.length === 1 ? "it was" : "they were"} put in a separate part that is still over the limit.
              Shrink {oversize.length === 1 ? "that part" : "those parts"} with{" "}
              <Link href="/compress-pdf" className="underline">
                Compress PDF
              </Link>
              .
            </ErrorNote>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-black/10 dark:border-white/10">
                  <th className="py-2 pr-2 font-medium">Part</th>
                  <th className="py-2 pr-2 font-medium">Pages</th>
                  <th className="py-2 pr-2 font-medium">Size</th>
                  <th className="py-2 font-medium sr-only">Download</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p, i) => {
                  const fname = `${name}-part${String(i + 1).padStart(width, "0")}.pdf`;
                  const a = p.pages[0] + 1;
                  const b = p.pages[p.pages.length - 1] + 1;
                  return (
                    <tr key={i} className="border-b border-black/5 dark:border-white/5">
                      <td className="py-1.5 pr-2 font-medium">{i + 1}</td>
                      <td className="py-1.5 pr-2 tabular-nums">
                        {a === b ? a : `${a}–${b}`}
                        <span className="text-zinc-500"> ({p.pages.length})</span>
                      </td>
                      <td className={`py-1.5 pr-2 tabular-nums ${p.oversize ? "text-red-600 font-semibold" : ""}`}>
                        {formatMB(p.bytes.length)}
                        {p.oversize && " (over)"}
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => downloadBlob(pdfBlob(p.bytes), fname)}
                          className="inline-flex items-center gap-1 min-h-10 px-3 rounded-full text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                          aria-label={`Download part ${i + 1}`}
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          <span className="hidden sm:inline">PDF</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
