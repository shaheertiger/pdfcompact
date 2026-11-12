"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
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
import { baseName, formatBytes, isPdf, parsePageList, zipFiles } from "@/lib/download";
import type { PdfDoc } from "@/lib/pdfjs";

/**
 * Shared engine for PDF to JPG and PDF to PNG: render pages with pdf.js and
 * encode them on a canvas. One page gives one image; several give a ZIP.
 */

type Format = "jpg" | "png";
type Loaded = { file: File; pdf: PdfDoc; sizes: { w: number; h: number }[] };

/** iOS Safari refuses canvases over 16,777,216 pixels; most browsers also cap a side. */
const MAX_PIXELS = 16_777_216;
const MAX_SIDE = 8192;
const DPIS = [72, 150, 300] as const;

function pixelsAt(size: { w: number; h: number }, dpi: number) {
  const s = dpi / 72;
  return { w: Math.ceil(size.w * s), h: Math.ceil(size.h * s) };
}

/** DPI actually used for a page, lowered if the canvas would be too big. */
function safeDpi(size: { w: number; h: number }, dpi: number): number {
  const { w, h } = pixelsAt(size, dpi);
  const f = Math.min(1, Math.sqrt(MAX_PIXELS / (w * h)), MAX_SIDE / Math.max(w, h));
  return f < 1 ? Math.floor(dpi * f * 0.98) : dpi;
}

export default function PdfToImageTool({ format }: { format: Format }) {
  const ext = format;
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [opening, setOpening] = useState(false);
  const [dpi, setDpi] = useState<number>(150);
  const [pagesMode, setPagesMode] = useState<"all" | "some">("all");
  const [pageList, setPageList] = useState("");
  const [quality, setQuality] = useState(85);
  const [transparent, setTransparent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<{ value: number; label: string } | null>(null);
  const [result, setResult] = useState<{ files: ResultFile[]; count: number; total: number; first: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const reset = () => {
    cancelRef.current = true;
    void loaded?.pdf.destroy();
    setLoaded(null);
    setResult(null);
    setError(null);
    setPageList("");
    setPagesMode("all");
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    setError(null);
    if (!isPdf(f)) {
      setError("That isn't a PDF. Choose a .pdf file.");
      return;
    }
    setOpening(true);
    try {
      const { openPdf } = await import("@/lib/pdfjs");
      const pdf = await openPdf(await f.arrayBuffer());
      const sizes: { w: number; h: number }[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const vp = (await pdf.getPage(i)).getViewport({ scale: 1 });
        sizes.push({ w: vp.width, h: vp.height });
      }
      setLoaded({ file: f, pdf, sizes });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this PDF.");
    } finally {
      setOpening(false);
    }
  };

  let selected: number[] = [];
  let listError: string | null = null;
  if (loaded) {
    if (pagesMode === "all" || !pageList.trim()) {
      selected = loaded.sizes.map((_, i) => i);
    } else {
      try {
        selected = parsePageList(pageList, loaded.sizes.length);
      } catch (e) {
        listError = e instanceof Error ? e.message : "Check the page list.";
      }
    }
  }
  const reduced = loaded ? selected.filter((i) => safeDpi(loaded.sizes[i], dpi) < dpi) : [];
  const first = loaded && selected.length ? pixelsAt(loaded.sizes[selected[0]], safeDpi(loaded.sizes[selected[0]], dpi)) : null;

  const run = async () => {
    if (!loaded || listError || selected.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    cancelRef.current = false;
    try {
      const { renderPageToCanvas, canvasToBlob } = await import("@/lib/pdfjs");
      const name = baseName(loaded.file.name);
      const pad = String(loaded.sizes.length).length;
      const out: { name: string; data: Blob }[] = [];
      let firstDims = "";
      for (let k = 0; k < selected.length; k++) {
        if (cancelRef.current) return;
        const i = selected[k];
        setProg({ value: k / selected.length, label: `Page ${i + 1} (${k + 1} of ${selected.length})` });
        await new Promise((r) => setTimeout(r));
        const d = safeDpi(loaded.sizes[i], dpi);
        const bg = format === "png" && transparent ? null : "#ffffff";
        const canvas = await renderPageToCanvas(loaded.pdf, i + 1, d / 72, bg);
        if (!firstDims) firstDims = `${canvas.width} × ${canvas.height} px`;
        const blob = await canvasToBlob(canvas, mime, format === "jpg" ? quality / 100 : undefined);
        canvas.width = canvas.height = 0;
        out.push({ name: `${name}-page-${String(i + 1).padStart(pad, "0")}.${ext}`, data: blob });
      }
      const total = out.reduce((n, f) => n + f.data.size, 0);
      let files: ResultFile[];
      if (out.length === 1) {
        files = [{ blob: out[0].data, name: out[0].name }];
      } else {
        setProg({ value: 1, label: "Packing ZIP…" });
        const zip = await zipFiles(out);
        files = [{ blob: zip, name: `${name}-${ext}.zip` }];
      }
      setResult({ files, count: out.length, total, first: firstDims });
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error && /canvas|memory|encode/i.test(e.message)
          ? "Your browser ran out of memory. Pick a lower resolution or fewer pages and try again."
          : "Couldn't convert this PDF. It may be damaged."
      );
    } finally {
      setBusy(false);
      setProg(null);
    }
  };

  if (!loaded) {
    return (
      <div>
        <Dropzone onFiles={onFiles} label="Drop a PDF here" hint="or tap to choose a file" />
        {opening && <Progress value={0.2} label="Opening PDF…" />}
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  const count = loaded.sizes.length;

  return (
    <div>
      <FileBar
        name={loaded.file.name}
        detail={`${count} page${count === 1 ? "" : "s"} · ${formatBytes(loaded.file.size)}`}
        onReset={reset}
      />

      {!result && (
        <div className="grid gap-4">
          <fieldset>
            <legend className="text-sm font-medium mb-2">Resolution</legend>
            <div className="grid grid-cols-3 gap-2">
              {DPIS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={dpi === d}
                  disabled={busy}
                  onClick={() => setDpi(d)}
                  className={`min-h-10 rounded-lg border px-2 py-2 text-sm text-center transition-colors ${
                    dpi === d
                      ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300"
                      : "border-black/10 dark:border-white/10 hover:border-red-300"
                  }`}
                >
                  <span className="font-medium block">{d} DPI</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {d === 72 ? "Screen, small" : d === 150 ? "Sharp, sharing" : "Print, zoom"}
                  </span>
                </button>
              ))}
            </div>
            {first && (
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                Page {selected[0] + 1} will be {first.w} × {first.h} px.
              </p>
            )}
          </fieldset>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Pages</span>
            <div className="grid grid-cols-2 gap-2">
              {(["all", "some"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={pagesMode === m}
                  disabled={busy}
                  onClick={() => setPagesMode(m)}
                  className={`min-h-10 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    pagesMode === m
                      ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 font-medium"
                      : "border-black/10 dark:border-white/10 hover:border-red-300"
                  }`}
                >
                  {m === "all" ? `All ${count} pages` : "Choose pages"}
                </button>
              ))}
            </div>
            {pagesMode === "some" && (
              <input
                className={`${inputClass} min-h-10`}
                aria-label="Pages to convert"
                placeholder={`e.g. 1-3, 5 (1–${count})`}
                value={pageList}
                disabled={busy}
                onChange={(e) => setPageList(e.target.value)}
              />
            )}
            {listError && <p className="text-sm text-red-700 dark:text-red-300">{listError}</p>}
          </div>

          {format === "jpg" ? (
            <Field label={`JPG quality: ${quality}`} hint="85 looks the same as 100 for most pages at about half the size.">
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={quality}
                disabled={busy}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="accent-red-600 h-10"
              />
            </Field>
          ) : (
            <label className="flex items-start gap-3 text-sm min-h-10 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 accent-red-600"
                checked={transparent}
                disabled={busy}
                onChange={(e) => setTransparent(e.target.checked)}
              />
              <span>
                <span className="font-medium">Transparent background</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                  Areas the PDF doesn&apos;t paint become see-through. Scans and pages with a filled background stay
                  opaque.
                </span>
              </span>
            </label>
          )}

          {reduced.length > 0 && (
            <p className="text-sm rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 px-4 py-3">
              {reduced.length === 1 ? `Page ${reduced[0] + 1} is` : `${reduced.length} pages are`} too big to draw at {dpi}{" "}
              DPI in a browser (over 16.7 million pixels), so {reduced.length === 1 ? "it" : "they"} will be saved at the highest resolution that fits
              (about {safeDpi(loaded.sizes[reduced[0]], dpi)} DPI).
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <ActionButton onClick={run} busy={busy} disabled={!!listError || selected.length === 0}>
              {busy
                ? "Converting…"
                : `Convert ${selected.length} page${selected.length === 1 ? "" : "s"} to ${format.toUpperCase()}`}
            </ActionButton>
            {busy && (
              <SecondaryButton
                onClick={() => {
                  cancelRef.current = true;
                }}
              >
                <X className="h-4 w-4" aria-hidden="true" /> Cancel
              </SecondaryButton>
            )}
          </div>
          {!busy && selected.length > 1 && (
            <InfoNote>{selected.length} images will be packed into one ZIP file.</InfoNote>
          )}
          {prog && <Progress value={prog.value} label={prog.label} />}
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      {result && (
        <ResultPanel
          title={`${result.count} ${format.toUpperCase()} image${result.count === 1 ? "" : "s"} ready`}
          files={result.files}
          note={
            <>
              {result.count} image{result.count === 1 ? "" : "s"}, {formatBytes(result.total)} in total
              {result.count > 1 ? " (in one ZIP)" : ""}. First image: {result.first}.
            </>
          }
          onReset={reset}
          resetLabel="Convert another PDF"
        />
      )}
      {result && (
        <div className="mt-3">
          <SecondaryButton onClick={() => setResult(null)}>Change settings and convert again</SecondaryButton>
        </div>
      )}
    </div>
  );
}
