"use client";

import { useState } from "react";
import { Document, Packer, Paragraph, PageBreak } from "docx";
import { CheckCircle2 } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { downloadBlob, baseName } from "@/lib/download";
import { loadPdfjs, extractPageText } from "@/lib/pdfjs";

export default function PdfToWordClient() {
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

      const paragraphs: Paragraph[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const pageText = await extractPageText(pdf, i);
        const lines = pageText.split("\n");
        lines.forEach((line) => paragraphs.push(new Paragraph(line)));
        if (i < pdf.numPages) {
          paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
        }
      }

      const doc = new Document({
        sections: [{ children: paragraphs.length > 0 ? paragraphs : [new Paragraph("")] }],
      });
      const blob = await Packer.toBlob(doc);
      downloadBlob(blob, `${baseName(f.name)}.docx`);
      setDone(true);
    } catch (e) {
      console.error(e);
      setError("Couldn't convert this PDF. It may be scanned images without text, or password protected.");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div>
      {!file && (
        <Dropzone onFiles={onFiles} label="Drop a PDF here" hint="or click to browse" />
      )}

      {isConverting && <p className="mt-4 text-sm text-zinc-500">Converting to Word…</p>}

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {file && done && !isConverting && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10">
          <span className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {baseName(file.name)}.docx downloaded
          </span>
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
