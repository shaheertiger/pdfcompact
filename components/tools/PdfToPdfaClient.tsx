"use client";

import { useState } from "react";
import Link from "next/link";
import Dropzone from "@/components/Dropzone";
import {
  ActionButton,
  ErrorNote,
  Field,
  FileBar,
  InfoNote,
  Progress,
  ResultPanel,
  Segmented,
  inputClass,
  type ResultFile,
} from "@/components/ui/kit";
import { baseName, isPdf, pdfBlob } from "@/lib/download";
import { openPdf, type PdfDoc } from "@/lib/pdfjs";

type Loaded = { file: File; doc: PdfDoc; pages: number };
type Dpi = "150" | "200" | "300";

export default function PdfToPdfaClient() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [dpi, setDpi] = useState<Dpi>("200");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ files: ResultFile[]; reduced: number[] } | null>(null);

  const reset = () => {
    loaded?.doc.destroy();
    setLoaded(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (!isPdf(f)) {
      setError(`"${f.name}" isn't a PDF. Choose a .pdf file.`);
      return;
    }
    setError(null);
    setResult(null);
    try {
      const doc = await openPdf(await f.arrayBuffer());
      let t = "";
      try {
        const meta = await doc.getMetadata();
        const info = meta.info as { Title?: unknown };
        if (typeof info?.Title === "string") t = info.Title.trim();
      } catch {
        // no metadata
      }
      setTitle(t || baseName(f.name));
      setLoaded({ file: f, doc, pages: doc.numPages });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this PDF.");
    }
  };

  const run = async () => {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const { convertToPdfa } = await import("@/lib/pdfa");
      const d = Number(dpi);
      const res = await convertToPdfa(
        loaded.doc,
        { dpi: d, quality: d >= 300 ? 0.82 : 0.85, title },
        async (done, total) => {
          setProgress((done / total) * 0.95);
          await new Promise((r) => setTimeout(r));
        },
      );
      setProgress(1);
      setResult({
        files: [{ blob: pdfBlob(res.bytes), name: `${baseName(loaded.file.name)}-pdfa.pdf` }],
        reduced: res.reducedPages,
      });
    } catch (e) {
      setError(
        e instanceof Error && /canvas/i.test(e.message)
          ? e.message
          : "Couldn't convert this PDF. Your device may have run out of memory: try 150 DPI, or split the file first.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div>
        <Dropzone onFiles={onFiles} />
        <ErrorNote>{error}</ErrorNote>
        <InfoNote>
          Makes an image-based PDF/A-2b copy: each page becomes a picture, so text in the copy can&apos;t be selected or
          searched.
        </InfoNote>
      </div>
    );
  }

  return (
    <div>
      <FileBar
        name={loaded.file.name}
        detail={`${loaded.pages} page${loaded.pages === 1 ? "" : "s"}`}
        onReset={reset}
      />
      <div className="grid gap-4">
        <Segmented
          label="Page image resolution"
          value={dpi}
          onChange={(v) => {
            setDpi(v);
            setResult(null);
          }}
          options={[
            { value: "150", label: "150 DPI", hint: "Smallest file, fine on screen" },
            { value: "200", label: "200 DPI", hint: "Recommended for filing" },
            { value: "300", label: "300 DPI", hint: "Small print, scans, maps" },
          ]}
        />
        <Field label="Document title (saved in the file's metadata)">
          <input
            className={inputClass}
            value={title}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              setResult(null);
            }}
          />
        </Field>
      </div>
      <div className="mt-5">
        <ActionButton onClick={run} busy={busy}>
          {busy ? "Converting…" : "Convert to PDF/A-2b"}
        </ActionButton>
      </div>
      {busy && <Progress value={progress} label="Rendering pages…" />}
      <ErrorNote>{error}</ErrorNote>
      {result ? (
        <ResultPanel
          title="PDF/A-2b copy ready"
          files={result.files}
          originalSize={loaded.file.size}
          note={
            <>
              Each page is now one image, with an sRGB colour profile and PDF/A-2b metadata. Text can&apos;t be selected
              or searched in this copy, so keep your original too. If your court or archive requires PDF/A, run the file
              through their checker before filing.
              {result.reduced.length > 0 &&
                ` Page${result.reduced.length === 1 ? "" : "s"} ${result.reduced.join(", ")} ${
                  result.reduced.length === 1 ? "is" : "are"
                } very large, so ${result.reduced.length === 1 ? "it was" : "they were"} rendered at a lower resolution to fit in browser memory.`}
            </>
          }
          onReset={reset}
          resetLabel="Convert another PDF"
        />
      ) : (
        <InfoNote>
          The copy keeps how every page looks, but links, form fields, bookmarks and selectable text are not kept. Need
          a smaller file instead? Use{" "}
          <Link href="/compress-pdf" className="underline">
            Compress PDF
          </Link>
          .
        </InfoNote>
      )}
    </div>
  );
}
