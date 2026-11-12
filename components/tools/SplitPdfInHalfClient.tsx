"use client";

import { useEffect, useRef, useState } from "react";
import Dropzone from "@/components/Dropzone";
import {
  ActionButton,
  ErrorNote,
  FileBar,
  InfoNote,
  Progress,
  ResultPanel,
  Segmented,
  type ResultFile,
} from "@/components/ui/kit";
import { editErrorMessage } from "@/lib/pdf-edit";
import { baseName, isPdf, pdfBlob } from "@/lib/download";
import { openPdf, renderPageToCanvas, type PdfDoc } from "@/lib/pdfjs";
import type { Cut } from "@/lib/split-half";

type Loaded = { file: File; doc: PdfDoc; pages: number; landscape: boolean };

export default function SplitPdfInHalfClient() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [cut, setCut] = useState<Cut>("vertical");
  const [rtl, setRtl] = useState(false);
  const [keepFirst, setKeepFirst] = useState(false);
  const [keepLast, setKeepLast] = useState(false);
  const [overlap, setOverlap] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ files: ResultFile[]; pagesIn: number; pagesOut: number } | null>(null);

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
      const vp = (await doc.getPage(1)).getViewport({ scale: 1 });
      const landscape = vp.width >= vp.height;
      setCut(landscape ? "vertical" : "horizontal");
      setLoaded({ file: f, doc, pages: doc.numPages, landscape });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this PDF.");
    }
  };

  const changed = () => setResult(null);

  const run = async () => {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const { splitInHalf } = await import("@/lib/split-half");
      const res = await splitInHalf(
        await loaded.file.arrayBuffer(),
        { cut, rtl, keepFirst, keepLast, overlap: overlap / 100 },
        async (done, total) => {
          setProgress((done / total) * 0.9);
          await new Promise((r) => setTimeout(r));
        },
      );
      setProgress(1);
      setResult({
        files: [{ blob: pdfBlob(res.bytes), name: `${baseName(loaded.file.name)}-split-pages.pdf` }],
        pagesIn: res.pagesIn,
        pagesOut: res.pagesOut,
      });
    } catch (e) {
      setError(
        editErrorMessage(e, "Couldn't split this PDF. It may be damaged. Try re-saving it with Print to PDF first."),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div>
        <Dropzone onFiles={onFiles} hint="Scanned book spreads, two-up pages, A3 scans" />
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  const previewPage = keepFirst && loaded.pages > 1 ? 2 : 1;

  return (
    <div>
      <FileBar
        name={loaded.file.name}
        detail={`${loaded.pages} page${loaded.pages === 1 ? "" : "s"}`}
        onReset={reset}
      />
      <div className="grid gap-5 md:grid-cols-[1fr_16rem]">
        <div className="grid gap-4 content-start">
          <Segmented
            label="Where to cut"
            value={cut}
            onChange={(v) => {
              setCut(v);
              changed();
            }}
            options={[
              { value: "vertical", label: "Left | Right", hint: "Book spreads, two-up pages" },
              { value: "horizontal", label: "Top / Bottom", hint: "Two pages stacked on one sheet" },
            ]}
          />
          <div className="grid gap-1">
            <Check
              checked={rtl && cut === "vertical"}
              disabled={cut !== "vertical"}
              onChange={(v) => {
                setRtl(v);
                changed();
              }}
              label="Right-to-left order (manga, Arabic, Hebrew)"
            />
            <Check
              checked={keepFirst}
              onChange={(v) => {
                setKeepFirst(v);
                changed();
              }}
              label="Keep the first page whole (front cover)"
            />
            <Check
              checked={keepLast}
              onChange={(v) => {
                setKeepLast(v);
                changed();
              }}
              label="Keep the last page whole (back cover)"
            />
          </div>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">
              Overlap past the middle: <span className="tabular-nums">{overlap}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={overlap}
              onChange={(e) => {
                setOverlap(Number(e.target.value));
                changed();
              }}
              className="w-full accent-red-600 h-10"
            />
            <span className="text-xs text-zinc-500">
              Use 1–3% if words near the spine get clipped. Each half then repeats a thin strip of the other.
            </span>
          </label>
          {!loaded.landscape && cut === "vertical" && (
            <InfoNote>
              This page is portrait. Splitting it left | right gives very narrow pages; for two pages stacked on one
              sheet, choose Top / Bottom.
            </InfoNote>
          )}
        </div>
        <div className="order-first md:order-none w-full max-w-[16rem] mx-auto md:max-w-none">
          <Preview doc={loaded.doc} page={previewPage} cut={cut} rtl={rtl && cut === "vertical"} overlap={overlap} />
        </div>
      </div>

      <div className="mt-5">
        <ActionButton onClick={run} busy={busy}>
          {busy ? "Splitting…" : "Split pages in half"}
        </ActionButton>
      </div>
      {busy && <Progress value={progress} />}
      <ErrorNote>{error}</ErrorNote>
      {result && (
        <ResultPanel
          files={result.files}
          note={`${result.pagesIn} page${result.pagesIn === 1 ? "" : "s"} in → ${result.pagesOut} pages out. Nothing was re-compressed; each half keeps the original quality.`}
          onReset={reset}
          resetLabel="Split another PDF"
        />
      )}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm min-h-10 ${disabled ? "opacity-40" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        className="h-4 w-4 accent-red-600"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function Preview({
  doc,
  page,
  cut,
  rtl,
  overlap,
}: {
  doc: PdfDoc;
  page: number;
  cut: Cut;
  rtl: boolean;
  overlap: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(0.7);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pg = await doc.getPage(page);
        const vp = pg.getViewport({ scale: 1 });
        if (cancelled) return;
        setAspect(vp.width / vp.height);
        const canvas = await renderPageToCanvas(doc, page, Math.min(2, 520 / vp.width));
        if (cancelled || !holder.current) return;
        canvas.className = "block w-full h-auto";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `Preview of page ${page} with the cut line`);
        holder.current.replaceChildren(canvas);
      } catch {
        // Preview is optional; the split still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, page]);

  const v = cut === "vertical";
  const labels = rtl ? ["2", "1"] : ["1", "2"];
  const ov = overlap; // percent of the full page each side extends past the middle
  return (
    <figure className="m-0">
      <div
        className="relative rounded-md border border-black/10 dark:border-white/10 overflow-hidden bg-white"
        style={{ aspectRatio: aspect }}
      >
        <div ref={holder} className="absolute inset-0" />
        {ov > 0 && (
          <div
            className="absolute bg-red-500/15"
            style={
              v
                ? { left: `${50 - ov}%`, width: `${2 * ov}%`, top: 0, bottom: 0 }
                : { top: `${50 - ov}%`, height: `${2 * ov}%`, left: 0, right: 0 }
            }
          />
        )}
        <div
          className="absolute border-red-600 border-dashed"
          style={
            v
              ? { left: "50%", top: 0, bottom: 0, borderLeftWidth: 2 }
              : { top: "50%", left: 0, right: 0, borderTopWidth: 2 }
          }
        />
        {[0, 1].map((i) => (
          <span
            key={i}
            className="absolute flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white text-sm font-bold shadow"
            style={
              v
                ? { left: i === 0 ? "25%" : "75%", top: "8px", transform: "translateX(-50%)" }
                : { top: i === 0 ? "25%" : "75%", right: "8px", transform: "translateY(-50%)" }
            }
          >
            {labels[i]}
          </span>
        ))}
      </div>
      <figcaption className="mt-1 text-xs text-zinc-500">
        Page {page}: the numbers show the order of the new pages.
      </figcaption>
    </figure>
  );
}
