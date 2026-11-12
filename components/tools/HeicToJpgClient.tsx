"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, Progress, ResultPanel, type ResultFile } from "@/components/ui/kit";
import { baseName, downloadBlob, formatBytes, zipFiles } from "@/lib/download";
import { HEIC_ACCEPT, canvasBlob, isHeic, jpegSize, nativeHeicDecode, sourceToCanvas, yieldToUi } from "@/lib/image-utils";

type Converted = { name: string; blob: Blob; url: string; width: number; height: number; inSize: number };

/** HEIC → JPEG: Safari's own decoder when it has one, the bundled decoder otherwise. */
async function convertOne(file: File, quality: number): Promise<Blob> {
  const native = await nativeHeicDecode(file);
  if (native) {
    try {
      const canvas = sourceToCanvas(native);
      return await canvasBlob(canvas, "image/jpeg", quality);
    } finally {
      native.close();
    }
  }
  const { heicToJpegBlob } = await import("@/lib/heic");
  return heicToJpegBlob(file, quality);
}

export default function HeicToJpgClient() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(90);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Converted[]>([]);
  const [zip, setZip] = useState<ResultFile | null>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const clearResults = () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setResults([]);
    setZip(null);
  };

  const addFiles = useCallback((list: File[]) => {
    setError(null);
    const ok = list.filter(isHeic);
    const skipped = list.length - ok.length;
    if (skipped) setError(`${skipped} file${skipped > 1 ? "s were" : " was"} skipped: only .heic and .heif photos can be converted here.`);
    setFiles((prev) => [...prev, ...ok]);
  }, []);

  const reset = () => {
    clearResults();
    setFiles([]);
    setError(null);
    setProgress(0);
  };

  const convert = async () => {
    clearResults();
    setBusy(true);
    setError(null);
    setProgress(0);
    const out: Converted[] = [];
    const failed: string[] = [];
    const used = new Set<string>();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setStatus(i === 0 ? `Converting ${f.name} (the first photo also loads the decoder)…` : `Converting ${f.name}…`);
      setProgress(i / files.length);
      await yieldToUi();
      try {
        const blob = await convertOne(f, quality / 100);
        const size = jpegSize(new Uint8Array(await blob.slice(0, 65536).arrayBuffer())) ?? { width: 0, height: 0 };
        let name = `${baseName(f.name)}.jpg`;
        for (let n = 2; used.has(name.toLowerCase()); n++) name = `${baseName(f.name)}-${n}.jpg`;
        used.add(name.toLowerCase());
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        out.push({ name, blob, url, ...size, inSize: f.size });
        setResults([...out]);
      } catch (e) {
        console.error(e);
        failed.push(`${f.name}: ${e instanceof Error ? e.message : "couldn't be converted."}`);
      }
    }
    setProgress(1);
    if (out.length > 1) {
      setStatus("Building ZIP…");
      setZip({ name: "heic-to-jpg.zip", blob: await zipFiles(out.map((r) => ({ name: r.name, data: r.blob }))) });
    }
    if (failed.length) setError(failed.join(" "));
    setBusy(false);
    setStatus("");
  };

  const inTotal = results.reduce((n, r) => n + r.inSize, 0);

  return (
    <div>
      {files.length === 0 ? (
        <Dropzone
          accept={HEIC_ACCEPT}
          multiple
          onFiles={addFiles}
          label="Drop iPhone HEIC photos here"
          hint="Pick one or many .heic / .heif files"
        />
      ) : (
        <>
          <div className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 mb-4 flex items-center justify-between gap-3">
            <span className="text-sm">
              <strong>{files.length}</strong> HEIC photo{files.length > 1 ? "s" : ""} · {formatBytes(files.reduce((n, f) => n + f.size, 0))}
            </span>
            <button type="button" onClick={reset} className="min-h-10 text-sm text-zinc-500 hover:text-red-600">
              Change files
            </button>
          </div>
          <label className="grid gap-1 text-sm max-w-md">
            <span className="font-medium">
              JPG quality: {quality}%
            </span>
            <input
              type="range"
              min={50}
              max={100}
              step={1}
              value={quality}
              onChange={(e) => {
                setQuality(Number(e.target.value));
                clearResults();
              }}
              className="w-full accent-red-600 h-10"
            />
            <span className="text-xs text-zinc-500">90% looks identical to the original for almost every photo. Lower it to make files smaller.</span>
          </label>
          <div className="mt-5">
            <ActionButton onClick={convert} busy={busy} disabled={!files.length}>
              {busy ? "Converting…" : `Convert ${files.length} photo${files.length > 1 ? "s" : ""} to JPG`}
            </ActionButton>
          </div>
          {busy && <Progress value={progress} label={status} />}
        </>
      )}
      <ErrorNote>{error}</ErrorNote>
      {results.length > 0 && !busy && (
        <ResultPanel
          title={`${results.length} JPG${results.length > 1 ? "s" : ""} ready`}
          files={zip ? [zip] : [{ blob: results[0].blob, name: results[0].name }]}
          originalSize={inTotal}
          note="Location (GPS) and other camera metadata are not copied into the JPGs."
          onReset={reset}
          resetLabel="Convert more"
        />
      )}
      {results.length > 1 && !busy && (
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {results.map((r) => (
            <li key={r.name} className="rounded-lg border border-black/10 dark:border-white/10 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.url} alt={r.name} className="aspect-square w-full object-contain bg-zinc-100 dark:bg-zinc-900 rounded" />
              <p className="mt-1 text-xs truncate" title={r.name}>{r.name}</p>
              <p className="text-xs text-zinc-500">
                {r.width}×{r.height} · {formatBytes(r.blob.size)}
              </p>
              <button
                type="button"
                onClick={() => downloadBlob(r.blob, r.name)}
                className="mt-1 min-h-10 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-black/10 dark:border-white/15 text-sm hover:border-red-400 hover:text-red-600"
              >
                <Download className="h-4 w-4" aria-hidden="true" /> Download
              </button>
            </li>
          ))}
        </ul>
      )}
      {results.length === 1 && !busy && (
        <p className="mt-3 text-xs text-zinc-500">
          {results[0].width}×{results[0].height} pixels
        </p>
      )}
    </div>
  );
}
