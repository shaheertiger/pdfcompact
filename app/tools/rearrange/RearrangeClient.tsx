"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import Dropzone from "@/components/Dropzone";
import { downloadBlob, bytesToBlob, baseName } from "@/lib/download";
import { loadPdfjs, renderPageThumbnail } from "@/lib/pdfjs";

type Page = {
  originalIndex: number;
  thumbnail: string;
};

export default function RearrangeClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const onFiles = async (files: File[]) => {
    const f = files[0];
    setError(null);
    setIsLoading(true);
    try {
      const bytes = await f.arrayBuffer();
      const pdfjs = await loadPdfjs();
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const loaded: Page[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        loaded.push({ originalIndex: i - 1, thumbnail: await renderPageThumbnail(pdf, i) });
      }
      setFile(f);
      setPages(loaded);
    } catch (e) {
      console.error(e);
      setError("Couldn't read this PDF. It may be corrupted or password protected.");
    } finally {
      setIsLoading(false);
    }
  };

  const move = (from: number, to: number) => {
    setPages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleSave = async () => {
    if (!file) return;
    setIsSaving(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pages.map((p) => p.originalIndex));
      copied.forEach((p) => out.addPage(p));
      const outBytes = await out.save();
      downloadBlob(bytesToBlob(outBytes, "application/pdf"), `${baseName(file.name)}-reordered.pdf`);
    } catch (e) {
      console.error(e);
      setError("Something went wrong while saving the reordered PDF.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {!file && (
        <Dropzone onFiles={onFiles} label="Drop a PDF here" hint="or click to browse" />
      )}

      {isLoading && <p className="mt-4 text-sm text-zinc-500">Loading pages…</p>}

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {file && pages.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-zinc-500">
              Drag thumbnails to reorder {pages.length} pages
            </span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPages([]);
              }}
              className="text-sm text-zinc-500 hover:text-red-600"
            >
              Change file
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {pages.map((page, i) => (
              <div
                key={page.originalIndex + "-" + i}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== i) move(dragIndex, i);
                  setDragIndex(null);
                }}
                className="relative rounded-lg border border-black/10 dark:border-white/10 overflow-hidden cursor-move bg-white dark:bg-zinc-800 shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.thumbnail} alt={`Page ${page.originalIndex + 1}`} className="w-full block" />
                <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs rounded px-1.5 py-0.5">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="mt-6 rounded-full bg-red-600 text-white px-6 py-2.5 font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {isSaving ? "Saving…" : "Save reordered PDF"}
          </button>
        </div>
      )}
    </div>
  );
}
