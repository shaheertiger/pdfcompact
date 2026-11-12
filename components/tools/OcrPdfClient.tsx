"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Copy, Check, FileText, X } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import {
  ActionButton,
  ErrorNote,
  Field,
  FileBar,
  InfoNote,
  Progress,
  ResultPanel,
  SecondaryButton,
  inputClass,
  type ResultFile,
} from "@/components/ui/kit";
import { baseName, bytesToBlob, formatBytes, isPdf, pdfBlob } from "@/lib/download";
import { ocrLanguages } from "@/lib/vendor";
import { ocrLangSizeMB, type OcrEngine, type OcrLang, type OcrPdfResult } from "@/lib/ocr";

type Loaded = { file: File; bytes: Uint8Array; pageCount: number; textPages: number[] };
type Prog = { page: number; total: number; stage: string; overall: number; done: number; todo: number };

export default function OcrPdfClient() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [lang1, setLang1] = useState<OcrLang>("eng");
  const [lang2, setLang2] = useState<OcrLang | "">("");
  const [skipText, setSkipText] = useState(true);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<Prog | null>(null);
  const [result, setResult] = useState<{ out: OcrPdfResult; files: ResultFile[]; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const engineRef = useRef<OcrEngine | null>(null);
  const cancelledRef = useRef(false);

  const reset = () => {
    engineRef.current?.cancel();
    setLoaded(null);
    setResult(null);
    setError(null);
    setProg(null);
    setBusy(false);
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    setError(null);
    setResult(null);
    if (!isPdf(f)) {
      setError("That isn't a PDF. To OCR a photo, turn it into a PDF with Scan to PDF or JPG to PDF first.");
      return;
    }
    setInspecting(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const { detectTextPages } = await import("@/lib/ocr");
      const info = await detectTextPages(bytes);
      setLoaded({ file: f, bytes, ...info });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this PDF.");
    } finally {
      setInspecting(false);
    }
  };

  const langs: OcrLang[] = lang2 && lang2 !== lang1 ? [lang1, lang2] : [lang1];
  const todoCount = loaded
    ? skipText
      ? loaded.pageCount - loaded.textPages.length
      : loaded.pageCount
    : 0;

  const run = async () => {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    setResult(null);
    cancelledRef.current = false;
    const started = now();
    const todo = todoCount;
    let done = 0;
    let lastPage = 0;
    setProg({ page: 0, total: loaded.pageCount, stage: "Starting the OCR engine", overall: 0, done: 0, todo });
    try {
      const { ocrPdf } = await import("@/lib/ocr");
      const out = await ocrPdf(loaded.bytes, {
        langs,
        skipTextPages: skipText,
        onEngine: (e) => {
          engineRef.current = e;
          if (cancelledRef.current) e.cancel();
        },
        onProgress: ({ page, total, stage, fraction }) => {
          if (stage === "Done" && page !== lastPage) {
            done += 1;
            lastPage = page;
          }
          const overall = todo > 0 ? Math.min(1, (done + (stage === "Done" ? 0 : fraction)) / todo) : 1;
          setProg({ page, total, stage, overall, done, todo });
        },
      });
      const seconds = (now() - started) / 1000;
      const name = baseName(loaded.file.name);
      const files: ResultFile[] = [
        { blob: pdfBlob(out.pdf), name: `${name}-searchable.pdf` },
        { blob: bytesToBlob(new TextEncoder().encode(out.text), "text/plain;charset=utf-8"), name: `${name}-text.txt` },
      ];
      setResult({ out, files, seconds });
    } catch (e) {
      if (e instanceof Error && e.name === "OcrCancelled") {
        setError(null);
      } else {
        console.error(e);
        setError(e instanceof Error ? e.message : "OCR failed on this file.");
      }
    } finally {
      engineRef.current = null;
      setBusy(false);
      setProg(null);
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    engineRef.current?.cancel();
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.out.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Your browser blocked copying. Select the text in the box and copy it by hand.");
    }
  };

  if (!loaded) {
    return (
      <div>
        <Dropzone onFiles={onFiles} label="Drop a scanned PDF here" hint="or tap to choose a file" />
        {inspecting && <Progress value={0.15} label="Checking which pages already have text…" />}
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  const ocrPages = result?.out.pages.filter((p) => p.status === "ocr") ?? [];
  const avgConf = ocrPages.length
    ? Math.round(ocrPages.reduce((n, p) => n + (p.confidence ?? 0), 0) / ocrPages.length)
    : null;
  const newDownloads = langs.map((l) => `${labelOf(l)} ${ocrLangSizeMB[l]} MB`);

  return (
    <div>
      <FileBar
        name={loaded.file.name}
        detail={`${loaded.pageCount} page${loaded.pageCount === 1 ? "" : "s"} · ${formatBytes(loaded.file.size)}`}
        onReset={reset}
      />

      {!result && (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Document language">
              <select
                className={`${inputClass} min-h-10`}
                value={lang1}
                disabled={busy}
                onChange={(e) => setLang1(e.target.value as OcrLang)}
              >
                {ocrLanguages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Second language (optional)" hint="For mixed pages, e.g. English + Hindi. Slower.">
              <select
                className={`${inputClass} min-h-10`}
                value={lang2}
                disabled={busy}
                onChange={(e) => setLang2(e.target.value as OcrLang | "")}
              >
                <option value="">None</option>
                {ocrLanguages
                  .filter((l) => l.code !== lang1)
                  .map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          <label className="flex items-start gap-3 text-sm min-h-10 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-red-600"
              checked={skipText}
              disabled={busy}
              onChange={(e) => setSkipText(e.target.checked)}
            />
            <span>
              <span className="font-medium">Skip pages that already have text</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                {loaded.textPages.length === 0
                  ? "No page in this file has a text layer yet, so every page will be read."
                  : `${loaded.textPages.length} of ${loaded.pageCount} pages already have text${
                      loaded.textPages.length <= 12 ? ` (page ${loaded.textPages.join(", ")})` : ""
                    }. Leave this on so their text isn't doubled.`}
              </span>
            </span>
          </label>

          {todoCount === 0 && (
            <p className="text-sm rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 px-4 py-3">
              Every page already has selectable text, so there&apos;s nothing to OCR. To get the text out, use{" "}
              <Link className="underline" href="/pdf-to-text">
                PDF to Text
              </Link>
              . To OCR anyway (for text inside pictures), untick the box above.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <ActionButton onClick={run} busy={busy} disabled={todoCount === 0}>
              {busy ? "Reading pages…" : `Make ${todoCount} page${todoCount === 1 ? "" : "s"} searchable`}
            </ActionButton>
            {busy && (
              <SecondaryButton onClick={cancel}>
                <X className="h-4 w-4" aria-hidden="true" /> Cancel
              </SecondaryButton>
            )}
          </div>
          {!busy && (
            <InfoNote>
              The first run of each language downloads its data file once ({newDownloads.join(", ")}), then it&apos;s
              cached in your browser. Pages are read on your device; expect several seconds per page.
            </InfoNote>
          )}
          {prog && (
            <Progress
              value={prog.overall}
              label={
                prog.page === 0
                  ? `${prog.stage}…`
                  : `Page ${prog.page} of ${prog.total} · ${prog.stage}${prog.todo > 1 ? ` (${prog.done}/${prog.todo} done)` : ""}`
              }
            />
          )}
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      {result && (
        <>
          <ResultPanel
            title="Your PDF is searchable"
            files={result.files}
            onReset={reset}
            resetLabel="OCR another PDF"
            note={
              <>
                Read {result.out.ocrCount} page{result.out.ocrCount === 1 ? "" : "s"}
                {result.out.skippedCount > 0 && `, skipped ${result.out.skippedCount} that already had text`}
                {result.out.pages.some((p) => p.status === "empty") &&
                  `, found no text on page ${result.out.pages
                    .filter((p) => p.status === "empty")
                    .map((p) => p.page)
                    .join(", ")}`}{" "}
                in {result.seconds.toFixed(1)} s
                {avgConf !== null && <> · average confidence {avgConf}%</>}. The text layer added{" "}
                {formatBytes(Math.max(0, result.files[0].blob.size - loaded.file.size))}; the pages look exactly as
                before.
                {avgConf !== null && avgConf < 70 && (
                  <span className="block mt-1 text-amber-700 dark:text-amber-300">
                    Low confidence: check the text. A sharper scan (300 DPI, flat page, good light) or the right
                    language gives better results.
                  </span>
                )}
              </>
            }
          />
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-medium inline-flex items-center gap-1.5">
                <FileText className="h-4 w-4" aria-hidden="true" /> Recognized text
              </span>
              <SecondaryButton onClick={copy}>
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? "Copied" : "Copy text"}
              </SecondaryButton>
            </div>
            <textarea
              readOnly
              aria-label="Recognized text"
              value={result.out.text}
              className={`${inputClass} w-full h-56 font-mono text-xs leading-relaxed`}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** Wall-clock helper, kept outside the component for the React purity lint. */
function now(): number {
  return performance.now();
}

function labelOf(code: OcrLang): string {
  return ocrLanguages.find((l) => l.code === code)?.label.replace(/\s*\(.*\)$/, "") ?? code;
}
