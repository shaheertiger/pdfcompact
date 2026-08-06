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

export default function ExtractClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
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
      setSelected(new Set());
    } catch (e) {
      console.error(e);
      setError("Couldn't read this PDF. It may be corrupted or password protected.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggle = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleExtract = async () => {
    if (!file || selected.size === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const orderedIndices = pages.map((p) => p.index).filter((i) => selected.has(i));
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, orderedIndices);
      copied.forEach((p) => out.addPage(p));
      const outBytes = await out.save();
      downloadBlob(bytesToBlob(outBytes, "application/pdf"), `${baseName(file.name)}-extracted.pdf`);
    } catch (e) {
      console.error(e);
      setError("Something went wrong while extracting pages.");
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
              Click pages to select them · {selected.size} selected
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
              const isSelected = selected.has(page.index);
              return (
                <button
                  type="button"
                  key={page.index}
                  onClick={() => toggle(page.index)}
                  className={`relative rounded-lg border-2 overflow-hidden text-left transition-all ${
                    isSelected
                      ? "border-red-500 ring-2 ring-red-200 dark:ring-red-500/30"
                      : "border-black/10 dark:border-white/10 hover:border-red-400"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={page.thumbnail} alt={`Page ${page.index + 1}`} className="w-full block" />
                  <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs rounded px-1.5 py-0.5">
                    {page.index + 1}
                  </span>
                  {isSelected && (
                    <span className="absolute top-1 left-1 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleExtract}
            disabled={isSaving || selected.size === 0}
            className="mt-6 rounded-full bg-red-600 text-white px-6 py-2.5 font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {isSaving ? "Extracting…" : `Extract ${selected.size || ""} page${selected.size === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}
