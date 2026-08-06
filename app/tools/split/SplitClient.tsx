"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import Dropzone from "@/components/Dropzone";
import { downloadBlob, bytesToBlob, baseName } from "@/lib/download";

type Mode = "every" | "ranges";

function parseRanges(input: string, pageCount: number): number[][] {
  const groups: number[][] = [];
  const parts = input.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const match = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new Error(`Invalid range: "${part}"`);
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    if (start < 1 || end > pageCount || start > end) {
      throw new Error(`Range "${part}" is out of bounds (1–${pageCount}).`);
    }
    const indices: number[] = [];
    for (let i = start; i <= end; i++) indices.push(i - 1);
    groups.push(indices);
  }
  if (groups.length === 0) throw new Error("Enter at least one page range.");
  return groups;
}

function everyN(pageCount: number, n: number): number[][] {
  const groups: number[][] = [];
  for (let i = 0; i < pageCount; i += n) {
    const indices: number[] = [];
    for (let j = i; j < Math.min(i + n, pageCount); j++) indices.push(j);
    groups.push(indices);
  }
  return groups;
}

export default function SplitClient() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("every");
  const [everyValue, setEveryValue] = useState(1);
  const [ranges, setRanges] = useState("");
  const [isSplitting, setIsSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFiles = async (files: File[]) => {
    const f = files[0];
    setFile(f);
    setError(null);
    try {
      const bytes = await f.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      setPageCount(doc.getPageCount());
    } catch {
      setError("Couldn't read this PDF. It may be corrupted or password protected.");
      setFile(null);
      setPageCount(null);
    }
  };

  const handleSplit = async () => {
    if (!file || !pageCount) return;
    setIsSplitting(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const groups =
        mode === "every" ? everyN(pageCount, Math.max(1, everyValue)) : parseRanges(ranges, pageCount);

      const outputs: { name: string; bytes: Uint8Array }[] = [];
      for (let i = 0; i < groups.length; i++) {
        const out = await PDFDocument.create();
        const pages = await out.copyPages(src, groups[i]);
        pages.forEach((p) => out.addPage(p));
        outputs.push({ name: `${baseName(file.name)}-part${i + 1}.pdf`, bytes: await out.save() });
      }

      if (outputs.length === 1) {
        downloadBlob(bytesToBlob(outputs[0].bytes, "application/pdf"), outputs[0].name);
      } else {
        const zip = new JSZip();
        outputs.forEach((o) => zip.file(o.name, o.bytes));
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `${baseName(file.name)}-split.zip`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while splitting.");
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div>
      {!file && (
        <Dropzone onFiles={onFiles} label="Drop a PDF here" hint="or click to browse" />
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {file && pageCount && (
        <div>
          <div className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 mb-6">
            <span className="text-sm truncate">
              {file.name} · {pageCount} page{pageCount > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPageCount(null);
              }}
              className="text-sm text-zinc-500 hover:text-red-600"
            >
              Change file
            </button>
          </div>

          <div className="grid gap-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("every")}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium ${
                  mode === "every"
                    ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
                Split every N pages
              </button>
              <button
                type="button"
                onClick={() => setMode("ranges")}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium ${
                  mode === "ranges"
                    ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
                Custom page ranges
              </button>
            </div>

            {mode === "every" ? (
              <label className="flex items-center gap-3 text-sm">
                Pages per file
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={everyValue}
                  onChange={(e) => setEveryValue(parseInt(e.target.value, 10) || 1)}
                  className="w-20 rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5"
                />
              </label>
            ) : (
              <label className="grid gap-1 text-sm">
                Page ranges (e.g. 1-3, 4, 6-8)
                <input
                  type="text"
                  value={ranges}
                  onChange={(e) => setRanges(e.target.value)}
                  placeholder={`1-${Math.min(3, pageCount)}, ${Math.min(4, pageCount)}-${pageCount}`}
                  className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                />
              </label>
            )}

            <button
              type="button"
              onClick={handleSplit}
              disabled={isSplitting}
              className="rounded-full bg-red-600 text-white px-6 py-2.5 font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors w-fit"
            >
              {isSplitting ? "Splitting…" : "Split PDF"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
