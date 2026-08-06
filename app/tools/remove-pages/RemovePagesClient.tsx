"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import Dropzone from "@/components/Dropzone";
import { downloadBlob, bytesToBlob, baseName } from "@/lib/download";
import { loadPdfjs, renderPageThumbnail } from "@/lib/pdfjs";

type Page = {
  index: number;
  thumbnail: string;
};

export default function RemovePagesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [toRemove, setToRemove] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        loaded.push({ index: i - 1, thumbnail: await renderPageThumbnail(pdf, i) });
      }
      setFile(f);
      setPages(loaded);
      setToRemove(new Set());
    } catch (e) {
      console.error(e);
      setError("Couldn't read this PDF. It may be corrupted or password protected.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggle = (index: number) => {
    setToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleSave = async () => {
    if (!file) return;
    if (toRemove.size === pages.length) {
      setError("You can't remove every page — at least one must remain.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const keepIndices = pages.map((p) => p.index).filter((i) => !toRemove.has(i));
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, keepIndices);
      copied.forEach((p) => out.addPage(p));
      const outBytes = await out.save();
      downloadBlob(bytesToBlob(outBytes, "application/pdf"), `${baseName(file.name)}-edited.pdf`);
    } catch (e) {
      console.error(e);
      setError("Something went wrong while saving the PDF.");
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
              Click pages to mark them for removal · {toRemove.size} selected
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
            {pages.map((page) => {
              const marked = toRemove.has(page.index);
              return (
                <button
                  type="button"
                  key={page.index}
                  onClick={() => toggle(page.index)}
                  className={`relative rounded-lg border-2 overflow-hidden text-left transition-all ${
                    marked
                      ? "border-red-500 opacity-40"
                      : "border-black/10 dark:border-white/10 hover:border-red-400"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={page.thumbnail} alt={`Page ${page.index + 1}`} className="w-full block" />
                  <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs rounded px-1.5 py-0.5">
                    {page.index + 1}
                  </span>
                  {marked && (
                    <span className="absolute inset-0 flex items-center justify-center text-3xl text-red-600">
                      🗑️
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || toRemove.size === 0}
            className="mt-6 rounded-full bg-red-600 text-white px-6 py-2.5 font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {isSaving ? "Saving…" : `Remove ${toRemove.size || ""} page${toRemove.size === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}
