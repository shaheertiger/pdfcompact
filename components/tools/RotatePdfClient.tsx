"use client";

import { useRef, useState } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import {
  ActionButton,
  ErrorNote,
  FileBar,
  Progress,
  ResultPanel,
  SecondaryButton,
  inputClass,
  type ResultFile,
} from "@/components/ui/kit";
import { baseName, formatBytes, isPdf, parsePageList, pdfBlob } from "@/lib/download";

type Scope = "all" | "odd" | "even" | "custom";
type Loaded = { file: File; bytes: Uint8Array; count: number; existing: number[] };

/** Thumbnails beyond this many pages are not rendered, to keep phones responsive. */
const MAX_THUMBS = 150;

export default function RotatePdfClient() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [thumbs, setThumbs] = useState<(string | null)[]>([]);
  const [added, setAdded] = useState<number[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<ResultFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const loadToken = useRef(0);

  const reset = () => {
    loadToken.current++;
    setLoaded(null);
    setThumbs([]);
    setAdded([]);
    setResult(null);
    setError(null);
    setScopeError(null);
    setCustom("");
    setScope("all");
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    setError(null);
    if (!isPdf(f)) {
      setError("That isn't a PDF. Choose a .pdf file.");
      return;
    }
    setOpening(true);
    const token = ++loadToken.current;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const { openPdf, renderPageThumbnail } = await import("@/lib/pdfjs");
      const pdf = await openPdf(bytes);
      const existing: number[] = [];
      for (let i = 1; i <= pdf.numPages; i++) existing.push((await pdf.getPage(i)).rotate);
      setLoaded({ file: f, bytes, count: pdf.numPages, existing });
      setAdded(new Array(pdf.numPages).fill(0));
      setThumbs(new Array(pdf.numPages).fill(null));
      setOpening(false);
      const n = Math.min(pdf.numPages, MAX_THUMBS);
      for (let i = 1; i <= n; i++) {
        if (loadToken.current !== token) break;
        const url = await renderPageThumbnail(pdf, i, 180);
        setThumbs((prev) => {
          const next = [...prev];
          next[i - 1] = url;
          return next;
        });
        if (i % 4 === 0) await new Promise((r) => setTimeout(r));
      }
      await pdf.destroy();
    } catch (e) {
      setOpening(false);
      setError(e instanceof Error ? e.message : "Couldn't read this PDF.");
    }
  };

  const scopePages = (): number[] => {
    if (!loaded) return [];
    const all = Array.from({ length: loaded.count }, (_, i) => i);
    if (scope === "odd") return all.filter((i) => i % 2 === 0);
    if (scope === "even") return all.filter((i) => i % 2 === 1);
    if (scope === "custom") return parsePageList(custom, loaded.count);
    return all;
  };

  const rotateScope = (deg: number) => {
    let list: number[];
    try {
      list = scopePages();
    } catch (e) {
      setScopeError(e instanceof Error ? e.message : "Check the page list.");
      return;
    }
    if (list.length === 0) {
      setScopeError(scope === "custom" ? "Type the pages to rotate, like 1-3, 5." : "No pages match this choice.");
      return;
    }
    setScopeError(null);
    setResult(null);
    setAdded((prev) => prev.map((a, i) => (list.includes(i) ? (a + deg + 360) % 360 : a)));
  };

  const rotateOne = (i: number, deg: number) => {
    setResult(null);
    setAdded((prev) => prev.map((a, j) => (j === i ? (a + deg + 360) % 360 : a)));
  };

  const changed = added.filter((a) => a !== 0).length;

  const save = async () => {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const doc = await PDFDocument.load(loaded.bytes, { ignoreEncryption: true, updateMetadata: false });
      if (doc.isEncrypted) {
        throw new Error(
          "This PDF is encrypted (it has editing restrictions), so its pages can't be rotated safely here. Remove the restrictions first."
        );
      }
      doc.getPages().forEach((p, i) => {
        if (!added[i]) return;
        const cur = p.getRotation().angle;
        p.setRotation(degrees((((cur + added[i]) % 360) + 360) % 360));
      });
      const out = await doc.save();
      setResult([{ blob: pdfBlob(out), name: `${baseName(loaded.file.name)}-rotated.pdf` }]);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message.startsWith("This PDF") ? e.message : "Couldn't save the rotated PDF. The file may be damaged.");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div>
        <Dropzone onFiles={onFiles} label="Drop a PDF to rotate" hint="or tap to choose a file" />
        {opening && <Progress value={0.2} label="Opening PDF…" />}
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  const scopeLabel = scope === "all" ? "all" : scope === "odd" ? "odd" : scope === "even" ? "even" : "listed";

  return (
    <div>
      <FileBar
        name={loaded.file.name}
        detail={`${loaded.count} page${loaded.count === 1 ? "" : "s"} · ${formatBytes(loaded.file.size)}`}
        onReset={reset}
      />

      <div className="grid gap-3">
        <fieldset>
          <legend className="text-sm font-medium mb-2">Which pages</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                ["all", "All pages"],
                ["odd", "Odd (1, 3, 5…)"],
                ["even", "Even (2, 4, 6…)"],
                ["custom", "Page list"],
              ] as [Scope, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={scope === v}
                onClick={() => {
                  setScope(v);
                  setScopeError(null);
                }}
                className={`min-h-10 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  scope === v
                    ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 font-medium"
                    : "border-black/10 dark:border-white/10 hover:border-red-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        {scope === "custom" && (
          <input
            className={`${inputClass} min-h-10`}
            aria-label="Pages to rotate"
            placeholder={`e.g. 1-3, 7 (1–${loaded.count})`}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setScopeError(null);
            }}
          />
        )}
        {scopeError && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {scopeError}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <SecondaryButton onClick={() => rotateScope(-90)}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Left
          </SecondaryButton>
          <SecondaryButton onClick={() => rotateScope(90)}>
            <RotateCw className="h-4 w-4" aria-hidden="true" /> Right
          </SecondaryButton>
          <SecondaryButton onClick={() => rotateScope(180)}>180°</SecondaryButton>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          These buttons turn the {scopeLabel} pages. Use the buttons under a page to turn just that one.
        </p>
      </div>

      <ol className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3" aria-label="Pages">
        {Array.from({ length: loaded.count }, (_, i) => (
          <li
            key={i}
            className={`rounded-lg border p-2 flex flex-col gap-2 ${
              added[i] ? "border-red-400 bg-red-50/50 dark:bg-red-500/5" : "border-black/10 dark:border-white/10"
            }`}
          >
            <div className="aspect-square flex items-center justify-center overflow-hidden">
              {thumbs[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbs[i]!}
                  alt={`Page ${i + 1}${added[i] ? `, turned ${added[i]}°` : ""}`}
                  className="max-h-full max-w-full shadow-sm border border-black/10 transition-transform duration-200"
                  style={{ transform: `rotate(${added[i]}deg)`, maxHeight: added[i] % 180 ? "75%" : undefined }}
                />
              ) : (
                <span className="text-xs text-zinc-500">{i < MAX_THUMBS ? "…" : `Page ${i + 1}`}</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                aria-label={`Rotate page ${i + 1} left`}
                onClick={() => rotateOne(i, -90)}
                className="h-10 w-10 inline-flex items-center justify-center rounded-md border border-black/10 dark:border-white/15 hover:border-red-300"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-xs text-zinc-600 dark:text-zinc-400 text-center">
                {i + 1}
                {added[i] ? <span className="block text-red-600">+{added[i]}°</span> : null}
              </span>
              <button
                type="button"
                aria-label={`Rotate page ${i + 1} right`}
                onClick={() => rotateOne(i, 90)}
                className="h-10 w-10 inline-flex items-center justify-center rounded-md border border-black/10 dark:border-white/15 hover:border-red-300"
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {loaded.count > MAX_THUMBS && (
        <p className="mt-2 text-xs text-zinc-500">
          Previews are shown for the first {MAX_THUMBS} pages; the buttons still work for every page.
        </p>
      )}

      {!result && (
        <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:items-center">
          <ActionButton onClick={save} busy={busy} disabled={changed === 0}>
            {changed === 0 ? "Turn some pages first" : `Save PDF (${changed} page${changed === 1 ? "" : "s"} turned)`}
          </ActionButton>
          {changed > 0 && (
            <SecondaryButton onClick={() => setAdded(new Array(loaded.count).fill(0))}>Undo all turns</SecondaryButton>
          )}
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
      {result && (
        <ResultPanel
          title="Pages rotated"
          files={result}
          note={`${changed} page${changed === 1 ? "" : "s"} turned. Nothing was re-compressed, so text and images are exactly as before.`}
          onReset={reset}
          resetLabel="Rotate another PDF"
        />
      )}
    </div>
  );
}
