"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, Progress, ResultPanel, SecondaryButton, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, pdfBlob } from "@/lib/download";
import { nextId } from "@/lib/id";
import { isBrowserImage, isHeic } from "@/lib/image-utils";
import { defaultPdfPageOptions, imagesToPdf, type PdfPageOptions } from "@/lib/images-to-pdf";
import ImageOrderList, { type OrderItem } from "./ImageOrderList";
import ImagePdfOptions from "./ImagePdfOptions";

const ACCEPT = "image/heic,image/heif,.heic,.heif,image/jpeg,image/png,.jpg,.jpeg,.png";

export default function HeicToPdfClient() {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [opts, setOpts] = useState<PdfPageOptions>(defaultPdfPageOptions);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; pages: number; inputSize: number } | null>(null);

  const addFiles = useCallback((files: File[]) => {
    setError(null);
    setResult(null);
    const ok = files.filter((f) => isHeic(f) || isBrowserImage(f));
    const skipped = files.length - ok.length;
    if (skipped) setError(`${skipped} file${skipped > 1 ? "s" : ""} skipped: add HEIC, JPG or PNG photos.`);
    setItems((prev) => [
      ...prev,
      ...ok.map((file) => ({ id: nextId("heic"), file, url: isHeic(file) ? null : URL.createObjectURL(file), rotation: 0 as const })),
    ]);
  }, []);

  const remove = (id: string) => {
    setResult(null);
    setItems((prev) => {
      const it = prev.find((p) => p.id === id);
      if (it?.url) URL.revokeObjectURL(it.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const reset = () => {
    items.forEach((it) => it.url && URL.revokeObjectURL(it.url));
    setItems([]);
    setResult(null);
    setError(null);
  };

  const convert = async () => {
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
      setResult({
        file: { blob: pdfBlob(bytes), name: items.length === 1 ? `${baseName(items[0].file.name)}.pdf` : "iphone-photos.pdf" },
        pages: pageCount,
        inputSize: items.reduce((n, it) => n + it.file.size, 0),
      });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Couldn't make the PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {items.length === 0 ? (
        <Dropzone accept={ACCEPT} multiple onFiles={addFiles} label="Drop iPhone HEIC photos here" hint="One or many .heic files (JPG and PNG work too)" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm">
              <strong>{items.length}</strong> photo{items.length > 1 ? "s" : ""} · {formatBytes(items.reduce((n, it) => n + it.file.size, 0))}
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
            HEIC previews can&apos;t be shown in most browsers; the file names keep the order clear. Each photo becomes one page.
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
              {busy ? "Making PDF…" : `Convert ${items.length} photo${items.length > 1 ? "s" : ""} to PDF`}
            </ActionButton>
          </div>
          {busy && (
            <Progress
              value={progress}
              label={`Photo ${Math.min(items.length, Math.floor(progress * items.length) + 1)} of ${items.length}${progress === 0 ? " (loading the HEIC decoder)" : ""}`}
            />
          )}
        </>
      )}
      <ErrorNote>{error}</ErrorNote>
      {result && (
        <ResultPanel
          title={`PDF ready: ${result.pages} page${result.pages > 1 ? "s" : ""}`}
          files={[result.file]}
          originalSize={result.inputSize}
          onReset={reset}
          resetLabel="Start over"
        />
      )}
    </div>
  );
}
