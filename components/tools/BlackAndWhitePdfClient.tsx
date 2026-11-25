"use client";

import { useState } from "react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, Progress, ResultPanel, Segmented, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, isPdf, pdfBlob } from "@/lib/download";
import type { ColorMode, ColorStats } from "@/lib/grayscale";
import { WarnNote } from "./convert-kit";

const THRESHOLDS = [
  { value: "0.35", label: "Lighter", hint: "Only dark colours turn black. Pale fills and light text disappear." },
  { value: "0.5", label: "Balanced", hint: "Midpoint. Good for most documents." },
  { value: "0.7", label: "Darker", hint: "Most colours turn black. Keeps light-coloured text visible." },
] as const;
type Threshold = (typeof THRESHOLDS)[number]["value"];

function pageList(pages: number[]): string {
  if (pages.length <= 6) return pages.join(", ");
  return `${pages.slice(0, 6).join(", ")} and ${pages.length - 6} more`;
}

export default function BlackAndWhitePdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ColorMode>("gray");
  const [threshold, setThreshold] = useState<Threshold>("0.5");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; stats: ColorStats } | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const onFiles = (files: File[]) => {
    const f = files[0];
    setResult(null);
    setError(null);
    if (!f || !isPdf(f)) {
      setError("That isn't a PDF. Choose a .pdf file.");
      return;
    }
    setFile(f);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { convertColors } = await import("@/lib/grayscale");
      const out = await convertColors(new Uint8Array(await file.arrayBuffer()), { mode, threshold: Number(threshold) }, (label, value) =>
        setProgress({ label, value })
      );
      const suffix = mode === "gray" ? "grayscale" : "black-and-white";
      setResult({ file: { blob: pdfBlob(out.bytes), name: `${baseName(file.name)}-${suffix}.pdf` }, stats: out.stats });
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
      setError(
        code === "encrypted"
          ? "This PDF needs a password to open. Remove the password first, then try again."
          : "Couldn't read this PDF. It may be damaged or not a real PDF. Try re-saving it with Print to PDF."
      );
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <>
        <Dropzone onFiles={onFiles} />
        <ErrorNote>{error}</ErrorNote>
      </>
    );
  }

  const s = result?.stats;
  const note = s?.alreadyGray
    ? "This PDF has no visible colour, so it's already grayscale. You get the original file back unchanged."
    : s
    ? [
        `${s.pages} ${s.pages === 1 ? "page" : "pages"} converted`,
        s.images ? `${s.images} ${s.images === 1 ? "image" : "images"} re-encoded` : null,
        s.gradients ? `${s.gradients} ${s.gradients === 1 ? "gradient" : "gradients"}` : null,
      ]
        .filter(Boolean)
        .join(", ") + ". Text stays selectable and searchable, and vector drawings stay sharp."
    : "";

  return (
    <div>
      <FileBar name={file.name} detail={formatBytes(file.size)} onReset={reset} />
      <div className="grid gap-5">
        <Segmented<ColorMode>
          label="Convert to"
          value={mode}
          onChange={(v) => {
            setMode(v);
            setResult(null);
          }}
          options={[
            { value: "gray", label: "Grayscale", hint: "Shades of grey. Photos and charts stay readable." },
            { value: "bw", label: "Black and white", hint: "Only pure black and white. Smallest files, crisp prints." },
          ]}
        />
        {mode === "bw" && (
          <Segmented<Threshold>
            label="Threshold"
            value={threshold}
            onChange={(v) => {
              setThreshold(v);
              setResult(null);
            }}
            options={THRESHOLDS.map((t) => ({ value: t.value, label: t.label, hint: t.hint }))}
          />
        )}
        <div>
          <ActionButton onClick={run} busy={busy}>
            {mode === "gray" ? "Convert to grayscale" : "Convert to black and white"}
          </ActionButton>
        </div>
      </div>
      {progress && <Progress value={progress.value} label={progress.label} />}
      <ErrorNote>{error}</ErrorNote>
      {result && s && (
        <>
          <ResultPanel files={[result.file]} originalSize={file.size} note={note} onReset={reset} resetLabel="Convert another PDF" />
          {s.blendPages.length > 0 && (
            <WarnNote>
              {s.blendPages.length === 1 ? "Page" : "Pages"} {pageList(s.blendPages)} still had colour we couldn&apos;t convert directly (multi-ink colours,
              2-D gradients, inline or CMYK images), so {s.blendPages.length === 1 ? "it shows" : "they show"} in grayscale through a blend layer
              {mode === "bw" ? " rather than pure black and white" : ""}. Text stays selectable. The colour data is still inside the file.
            </WarnNote>
          )}
        </>
      )}
    </div>
  );
}
