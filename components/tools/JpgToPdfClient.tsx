"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, Progress, ResultPanel, SecondaryButton, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, pdfBlob } from "@/lib/download";
import { nextId } from "@/lib/id";
import { isBrowserImage, isHeic } from "@/lib/image-utils";
import { defaultPdfPageOptions, imagesToPdf, type PdfPageOptions } from "@/lib/images-to-pdf";
import ImageOrderList, { type OrderItem } from "./ImageOrderList";
import ImagePdfOptions from "./ImagePdfOptions";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.heic,.heif";

export default function JpgToPdfClient() {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [opts, setOpts] = useState<PdfPageOptions>(defaultPdfPageOptions);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; pages: number; inputSize: number } | null>(null);
  const urls = useRef<Set<string>>(new Set());

  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const addFiles = useCallback((files: File[]) => {
    setError(null);
    setResult(null);
    const ok = files.filter((f) => isBrowserImage(f) || isHeic(f));
    const skipped = files.length - ok.length;
    if (skipped) setError(`${skipped} file${skipped > 1 ? "s" : ""} skipped: only JPG, PNG, WebP, GIF, BMP, AVIF and HEIC images can go in.`);
    const added = ok.map((file) => {
      const url = isHeic(file) ? null : URL.createObjectURL(file);
      if (url) urls.current.add(url);
      return { id: nextId("img"), file, url, rotation: 0 as const };
    });
    setItems((prev) => [...prev, ...added]);
  }, []);

  const remove = (id: string) => {
    setResult(null);
    setItems((prev) => {
      const it = prev.find((p) => p.id === id);
      if (it?.url) {
        URL.revokeObjectURL(it.url);
        urls.current.delete(it.url);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const reset = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
    setItems([]);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const convert = async () => {
    if (!items.length) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const { bytes, pageCount } = await imagesToPdf(
        items.map((it) => ({ file: it.file, rotation: it.rotation })),
        opts,
        (done, total) => setProgress(done / total)
      );
      const name = items.length === 1 ? `${baseName(items[0].file.name)}.pdf` : "images.pdf";
      setResult({
        file: { blob: pdfBlob(bytes), name },
        pages: pageCount,
        inputSize: items.reduce((n, it) => n + it.file.size, 0),
      });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Couldn't make the PDF. Try fewer or smaller images.");
    } finally {
      setBusy(false);
    }
  };

  const total = items.reduce((n, it) => n + it.file.size, 0);

  return (
    <div>
      {items.length === 0 ? (
        <Dropzone
          accept={ACCEPT}
          multiple
          onFiles={addFiles}
          label="Drop photos or images here"
          hint="JPG, PNG, WebP or HEIC · pick several at once"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm">
              <strong>{items.length}</strong> image{items.length > 1 ? "s" : ""} · {formatBytes(total)} · one page each
            </p>
            <div className="flex gap-2">
              <label className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-black/15 dark:border-white/20 px-4 text-sm font-medium hover:border-red-400 hover:text-red-600 cursor-pointer">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add more
                <input
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files) addFiles(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                />
              </label>
              <SecondaryButton onClick={reset}>Clear all</SecondaryButton>
            </div>
          </div>
          <ImageOrderList
            items={items}
            onChange={(next) => {
              setResult(null);
              setItems(next);
            }}
            onRemove={remove}
          />
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Drag to reorder, or use the arrows. The first image becomes page 1.
          </p>
          <div className="mt-5 rounded-xl border border-black/10 dark:border-white/10 p-4">
            <ImagePdfOptions
              value={opts}
              onChange={(v) => {
                setResult(null);
                setOpts(v);
              }}
            />
          </div>
          <div className="mt-5">
            <ActionButton onClick={convert} busy={busy} disabled={!items.length}>
              {busy ? "Making PDF…" : `Convert ${items.length} image${items.length > 1 ? "s" : ""} to PDF`}
            </ActionButton>
          </div>
          {busy && <Progress value={progress} label={`Adding image ${Math.min(items.length, Math.floor(progress * items.length) + 1)} of ${items.length}`} />}
        </>
      )}
      <ErrorNote>{error}</ErrorNote>
      {result && (
        <ResultPanel
          title={`PDF ready: ${result.pages} page${result.pages > 1 ? "s" : ""}`}
          files={[result.file]}
          originalSize={result.inputSize}
          note={
            opts.quality === "original"
              ? "Your photos are inside the PDF at full quality, so it is about as big as the images. Need it smaller? Choose Balanced or Smaller file and convert again."
              : "Photos were scaled and re-saved as JPEG to keep the PDF small."
          }
          onReset={reset}
          resetLabel="Start over"
        />
      )}
    </div>
  );
}
