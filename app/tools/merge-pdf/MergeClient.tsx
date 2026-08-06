"use client";

import { useCallback, useState } from "react";
import { PDFDocument } from "pdf-lib";
import Dropzone from "@/components/Dropzone";
import { downloadBlob, bytesToBlob } from "@/lib/download";
import { nextId } from "@/lib/id";

type PdfFile = {
  id: string;
  file: File;
};

export default function MergeClient() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    setError(null);
    const pdfOnly = newFiles.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    setFiles((prev) => [
      ...prev,
      ...pdfOnly.map((file) => ({ id: nextId("pdf"), file })),
    ]);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const move = (from: number, to: number) => {
    setFiles((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      setError("Add at least two PDF files to merge.");
      return;
    }
    setIsMerging(true);
    setError(null);
    try {
      const merged = await PDFDocument.create();
      for (const { file } of files) {
        const bytes = await file.arrayBuffer();
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      }
      const outBytes = await merged.save();
      downloadBlob(bytesToBlob(outBytes, "application/pdf"), "merged.pdf");
    } catch (e) {
      console.error(e);
      setError("Couldn't merge these files. Make sure they are valid, non-corrupted PDFs.");
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div>
      <Dropzone
        multiple
        onFiles={addFiles}
        label="Drop PDF files here"
        hint="or click to browse (choose 2 or more)"
      />

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {files.length > 0 && (
        <ul className="mt-6 grid gap-2">
          {files.map((f, i) => (
            <li
              key={f.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== i) move(dragIndex, i);
                setDragIndex(null);
              }}
              className="flex items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 cursor-move"
            >
              <span className="text-zinc-400 select-none">☰</span>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs font-semibold">
                {i + 1}
              </span>
              <span className="flex-1 truncate text-sm">{f.file.name}</span>
              <span className="text-xs text-zinc-500 shrink-0">
                {(f.file.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                className="text-zinc-500 hover:text-red-600 disabled:opacity-30 px-1"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === files.length - 1}
                className="text-zinc-500 hover:text-red-600 disabled:opacity-30 px-1"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeFile(f.id)}
                className="text-zinc-500 hover:text-red-600 px-1"
                aria-label="Remove"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleMerge}
          disabled={files.length < 2 || isMerging}
          className="rounded-full bg-red-600 text-white px-6 py-2.5 font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isMerging ? "Merging…" : `Merge ${files.length || ""} PDFs`}
        </button>
        {files.length > 0 && (
          <button
            type="button"
            onClick={() => setFiles([])}
            className="text-sm text-zinc-500 hover:text-red-600"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
