"use client";

import { useState } from "react";
import JSZip from "jszip";
import Dropzone from "@/components/Dropzone";
import { downloadBlob, baseName } from "@/lib/download";
import { loadPdfjs, renderPageToJpegBlob } from "@/lib/pdfjs";

export default function PdfToJpgClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onFiles = async (files: File[]) => {
    const f = files[0];
    setFile(f);
    setError(null);
    setDone(false);
    setIsConverting(true);
    try {
      const bytes = await f.arrayBuffer();
      const pdfjs = await loadPdfjs();
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;

      const images: { name: string; blob: Blob }[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const blob = await renderPageToJpegBlob(pdf, i);
        images.push({ name: `${baseName(f.name)}-page${i}.jpg`, blob });
      }

      if (images.length === 1) {
        downloadBlob(images[0].blob, images[0].name);
      } else {
        const zip = new JSZip();
        for (const img of images) zip.file(img.name, img.blob);
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `${baseName(f.name)}-jpg.zip`);
      }
      setDone(true);
    } catch (e) {
      console.error(e);
      setError("Couldn't convert this PDF. It may be corrupted or password protected.");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div>
      {!file && (
        <Dropzone onFiles={onFiles} label="Drop a PDF here" hint="or click to browse" />
      )}

      {isConverting && <p className="mt-4 text-sm text-zinc-500">Converting pages to JPG…</p>}

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {file && done && !isConverting && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10">
          <span className="text-sm">✅ Your JPG{`(s)`} downloaded</span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setDone(false);
            }}
            className="text-sm text-zinc-500 hover:text-red-600"
          >
            Convert another
          </button>
        </div>
      )}
    </div>
  );
}
