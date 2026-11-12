"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, Progress, ResultPanel, type ResultFile } from "@/components/ui/kit";
import { baseName, downloadBlob, formatBytes, isPdf, zipFiles } from "@/lib/download";
import type { ExtractedImage, ExtractSummary } from "@/lib/extract-images";

type Shown = ExtractedImage & { url: string };

const MIN_SIZES = [
  { v: 0, label: "Keep everything" },
  { v: 50, label: "Skip under 50×50 px" },
  { v: 150, label: "Skip under 150×150 px" },
  { v: 400, label: "Skip under 400×400 px" },
];

export default function ExtractImagesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [minSize, setMinSize] = useState(50);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Omit<ExtractSummary, "images"> | null>(null);
  const [images, setImages] = useState<Shown[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [zip, setZip] = useState<ResultFile | null>(null);
  const [zipping, setZipping] = useState(false);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const clear = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setImages([]);
    setSummary(null);
    setSelected(new Set());
    setZip(null);
  };

  const onFiles = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (!isPdf(f)) {
      setError("That isn't a PDF. Choose a .pdf file.");
      return;
    }
    setError(null);
    setFile(f);
  }, []);

  const reset = () => {
    clear();
    setFile(null);
    setError(null);
  };

  const run = async () => {
    if (!file) return;
    clear();
    setBusy(true);
    setError(null);
    setProgress(0);
    setStatus("Opening the PDF…");
    try {
      const { extractImages } = await import("@/lib/extract-images");
      const res = await extractImages(new Uint8Array(await file.arrayBuffer()), minSize, (f, label) => {
        setProgress(f);
        setStatus(label);
      });
      const shown = res.images.map((im) => {
        const url = URL.createObjectURL(im.blob);
        urls.current.push(url);
        return { ...im, url };
      });
      setImages(shown);
      setSelected(new Set(shown.map((s) => s.id)));
      setSummary({ skippedSmall: res.skippedSmall, failed: res.failed, pageCount: res.pageCount });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Couldn't read the images in this PDF.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    setZip(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const makeZip = async () => {
    setZipping(true);
    const chosen = images.filter((i) => selected.has(i.id));
    const blob = await zipFiles(chosen.map((i) => ({ name: i.name, data: i.blob })));
    setZip({ name: `${baseName(file?.name ?? "pdf")}-images.zip`, blob });
    setZipping(false);
  };

  const chosen = images.filter((i) => selected.has(i.id));
  const originals = images.filter((i) => i.method === "original").length;

  return (
    <div>
      {!file ? (
        <Dropzone onFiles={onFiles} label="Drop a PDF here" hint="We'll find every photo and picture inside it" />
      ) : (
        <>
          <FileBar name={file.name} detail={formatBytes(file.size)} onReset={reset} />
          {images.length === 0 && !summary && (
            <>
              <label className="grid gap-1 text-sm max-w-xs">
                <span className="font-medium">Small images (icons, bullets, logos)</span>
                <select value={minSize} onChange={(e) => setMinSize(Number(e.target.value))} className="min-h-10 rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-zinc-900 px-3 text-sm">
                  {MIN_SIZES.map((m) => (
                    <option key={m.v} value={m.v}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-5">
                <ActionButton onClick={run} busy={busy}>
                  {busy ? "Finding images…" : "Extract images"}
                </ActionButton>
              </div>
            </>
          )}
          {busy && <Progress value={progress} label={status} />}
        </>
      )}
      <ErrorNote>{error}</ErrorNote>

      {summary && !busy && (
        <div className="mt-2">
          {images.length === 0 ? (
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-4 text-sm">
              <p className="font-medium">No images found{summary.skippedSmall ? " above the size filter" : ""}.</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                {summary.skippedSmall
                  ? `${summary.skippedSmall} small image${summary.skippedSmall > 1 ? "s were" : " was"} skipped. Set the filter to "Keep everything" and try again.`
                  : "The pictures may be drawn as vector graphics, or the page is one scanned image saved as text. Try PDF to JPG to save whole pages as images."}
              </p>
              <button type="button" onClick={clear} className="mt-3 min-h-10 text-sm text-red-600 hover:underline">
                Change the filter
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm">
                <strong>{images.length}</strong> distinct image{images.length > 1 ? "s" : ""} from {summary.pageCount} page{summary.pageCount > 1 ? "s" : ""}
                {originals > 0 && <> · {originals} saved as the original JPEG, untouched</>}
                {summary.skippedSmall > 0 && <span className="text-zinc-500"> · {summary.skippedSmall} small skipped</span>}
                {summary.failed > 0 && <span className="text-amber-700 dark:text-amber-300"> · {summary.failed} couldn&apos;t be decoded</span>}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setZip(null);
                    setSelected(selected.size === images.length ? new Set() : new Set(images.map((i) => i.id)));
                  }}
                  className="min-h-10 rounded-full border border-black/15 dark:border-white/15 px-4 text-sm hover:border-red-400"
                >
                  {selected.size === images.length ? "Select none" : "Select all"}
                </button>
                <ActionButton onClick={makeZip} busy={zipping} disabled={!chosen.length}>
                  {`Save ${chosen.length} selected as ZIP`}
                </ActionButton>
              </div>
              {zip && (
                <ResultPanel
                  title="ZIP ready"
                  files={[zip]}
                  note={`${chosen.length} image${chosen.length > 1 ? "s" : ""}, ${formatBytes(chosen.reduce((n, i) => n + i.blob.size, 0))} before zipping.`}
                  onReset={reset}
                  resetLabel="Another PDF"
                />
              )}
              <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((im) => {
                  const on = selected.has(im.id);
                  return (
                    <li key={im.id} className={`rounded-lg border p-2 ${on ? "border-red-500" : "border-black/10 dark:border-white/10"}`}>
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={`${on ? "Deselect" : "Select"} ${im.name}`}
                        onClick={() => toggle(im.id)}
                        className="relative block w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={im.url}
                          alt={`${im.name}, ${im.width}×${im.height}`}
                          className="aspect-square w-full object-contain rounded bg-[repeating-conic-gradient(#e4e4e7_0%_25%,#fff_0%_50%)] dark:bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] [background-size:12px_12px]"
                        />
                        <span
                          className={`absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center border ${
                            on ? "bg-red-600 border-red-600 text-white" : "bg-white/90 border-zinc-300"
                          }`}
                        >
                          {on && <Check className="h-4 w-4" aria-hidden="true" />}
                        </span>
                      </button>
                      <p className="mt-1 text-xs truncate" title={im.name}>{im.name}</p>
                      <p className="text-xs text-zinc-500">
                        {im.width}×{im.height} · {im.ext.toUpperCase()} · {formatBytes(im.blob.size)}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {im.pages.length > 1 ? `Pages ${im.pages.slice(0, 6).join(", ")}${im.pages.length > 6 ? "…" : ""}` : `Page ${im.pages[0]}`}
                        {im.droppedMask && " · transparency not kept"}
                      </p>
                      <button
                        type="button"
                        onClick={() => downloadBlob(im.blob, im.name)}
                        className="mt-1 min-h-10 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-black/10 dark:border-white/15 text-sm hover:border-red-400 hover:text-red-600"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" /> Save
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button type="button" onClick={reset} className="mt-4 min-h-10 text-sm text-zinc-500 hover:text-red-600">
                Start over with another PDF
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
