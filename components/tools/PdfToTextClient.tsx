"use client";

import { useState } from "react";
import Dropzone from "@/components/Dropzone";
import { downloadBlob, baseName } from "@/lib/download";
import { loadPdfjs, extractPageText } from "@/lib/pdfjs";

export default function PdfToTextClient() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFiles = async (files: File[]) => {
    const f = files[0];
    setFile(f);
    setError(null);
    setIsLoading(true);
    setText("");
    try {
      const bytes = await f.arrayBuffer();
      const pdfjs = await loadPdfjs();
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const parts: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        parts.push(await extractPageText(pdf, i));
      }
      setText(parts.join("\n\n"));
    } catch (e) {
      console.error(e);
      setError("Couldn't extract text from this PDF. It may be scanned images without text, or password protected.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!file) return;
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${baseName(file.name)}.txt`);
  };

  return (
    <div>
      {!file && (
        <Dropzone onFiles={onFiles} label="Drop a PDF here" hint="or click to browse" />
      )}

      {isLoading && <p className="mt-4 text-sm text-zinc-500">Extracting text…</p>}

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {file && !isLoading && text && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-zinc-500 truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setText("");
              }}
              className="text-sm text-zinc-500 hover:text-red-600"
            >
              Change file
            </button>
          </div>
          <textarea
            readOnly
            value={text}
            className="w-full h-80 rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50 p-4 text-sm font-mono"
          />
          <button
            type="button"
            onClick={handleDownload}
            className="mt-4 rounded-full bg-red-600 text-white px-6 py-2.5 font-semibold hover:bg-red-700 transition-colors"
          >
            Download .txt
          </button>
        </div>
      )}
    </div>
  );
}
