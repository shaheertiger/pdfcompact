"use client";

import { useEffect, useMemo, useState } from "react";
import { PDFDocument, type PDFFont } from "pdf-lib";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, Field, FileBar, Progress, ResultPanel, Segmented, inputClass, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, isPdf, parsePageList, pdfBlob } from "@/lib/download";
import {
  applyPageNumbers,
  ascentOf,
  cssFontFor,
  labelFor,
  layoutLabel,
  numberFormats,
  standardFontFor,
  type NumberFont,
  type NumberFormat,
  type NumberPosition,
} from "@/lib/page-numbers";
import { loadEditable, tick } from "@/lib/pdf-stamp";
import ColorPicker from "./stamp/ColorPicker";
import PageStage, { PageNav } from "./stamp/PageStage";
import { usePageRender, usePageSizes, usePdfDoc } from "./stamp/usePdfPreview";

const positions: { value: NumberPosition; label: string }[] = [
  { value: "tl", label: "Top left" },
  { value: "tc", label: "Top center" },
  { value: "tr", label: "Top right" },
  { value: "bl", label: "Bottom left" },
  { value: "bc", label: "Bottom center" },
  { value: "br", label: "Bottom right" },
];

type Which = "all" | "skip-first" | "custom";

export default function AddPageNumbersClient() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [position, setPosition] = useState<NumberPosition>("bc");
  const [format, setFormat] = useState<NumberFormat>("n");
  const [start, setStart] = useState(1);
  const [which, setWhich] = useState<Which>("all");
  const [range, setRange] = useState("");
  const [fontSize, setFontSize] = useState(11);
  const [margin, setMargin] = useState(28);
  const [color, setColor] = useState("#000000");
  const [font, setFont] = useState<NumberFont>("helvetica");
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultFile | null>(null);
  const [metrics, setMetrics] = useState<Record<NumberFont, PDFFont> | null>(null);

  const { pdf, error: pdfError, loading } = usePdfDoc(bytes);
  const numPages = pdf?.numPages ?? 0;
  const sizes = usePageSizes(pdf);

  // Standard-font metrics for an exact preview (same widths the PDF will use).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await PDFDocument.create();
      const entries = await Promise.all(
        (Object.keys(standardFontFor) as NumberFont[]).map(async (k) => [k, await d.embedFont(standardFontFor[k])] as const)
      );
      if (!cancelled) setMetrics(Object.fromEntries(entries) as Record<NumberFont, PDFFont>);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pagesResult = useMemo((): { pages: number[]; error: string | null } => {
    if (!numPages) return { pages: [], error: null };
    const all = Array.from({ length: numPages }, (_, i) => i);
    if (which === "all") return { pages: all, error: null };
    if (which === "skip-first") return { pages: all.slice(1), error: numPages < 2 ? "This PDF has only one page." : null };
    if (!range.trim()) return { pages: [], error: "Type the pages to number, e.g. 3-12." };
    try {
      return { pages: parsePageList(range, numPages), error: null };
    } catch (e) {
      return { pages: [], error: e instanceof Error ? e.message : String(e) };
    }
  }, [numPages, which, range]);
  const pages = pagesResult.pages;

  const firstNumbered = pages.length ? pages[0] + 1 : 1;
  const shownPage = Math.min(Math.max(1, previewPage ?? firstNumbered), Math.max(1, numPages));
  const { render } = usePageRender(pdf, shownPage, 640);

  const reset = () => {
    setFile(null);
    setBytes(null);
    setResult(null);
    setError(null);
    setLoadError(null);
    setPreviewPage(null);
    setRange("");
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    reset();
    if (!isPdf(f)) {
      setLoadError("That isn't a PDF. Choose a .pdf file.");
      return;
    }
    try {
      const b = new Uint8Array(await f.arrayBuffer());
      await loadEditable(b);
      setFile(f);
      setBytes(b);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  const opts = { position, format, start, pages, fontSize, margin, color, font };

  const run = async () => {
    if (!bytes || !file || !pages.length) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const doc = await loadEditable(bytes);
      await applyPageNumbers(doc, opts, async (done, total) => {
        setProgress((done / total) * 0.9);
        await tick();
      });
      const out = await doc.save();
      setProgress(1);
      setResult({ blob: pdfBlob(out), name: `${baseName(file.name)}-numbered.pdf` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while numbering the pages.");
    } finally {
      setBusy(false);
    }
  };

  // Overlay for the preview: same layout maths as the PDF writer.
  const k = pages.indexOf(shownPage - 1);
  const overlay = (pxPerPt: number) => {
    if (!render || !metrics || k < 0) return null;
    const label = labelFor(opts, k);
    const f = metrics[font];
    const tw = f.widthOfTextAtSize(label, fontSize);
    const asc = ascentOf(f, fontSize);
    const { x, baseline } = layoutLabel(render.ptWidth, render.ptHeight, tw, asc, opts);
    return (
      <span
        className="absolute whitespace-nowrap pointer-events-none"
        style={{
          left: x * pxPerPt,
          top: (baseline - asc) * pxPerPt,
          fontSize: fontSize * pxPerPt,
          lineHeight: `${asc * pxPerPt}px`,
          fontFamily: cssFontFor[font],
          color,
        }}
      >
        {label}
      </span>
    );
  };

  if (!file) {
    return (
      <div>
        <Dropzone onFiles={onFiles} />
        <ErrorNote>{loadError}</ErrorNote>
      </div>
    );
  }

  const sample = numberFormats.map((f) => ({ value: f.value, label: f.label(1, Math.max(numPages, 1)) }));
  const lastNumber = start + pages.length - 1;

  return (
    <div>
      <FileBar name={file.name} detail={`${numPages || "…"} pages · ${formatBytes(file.size)}`} onReset={reset} />
      <ErrorNote>{pdfError}</ErrorNote>

      {result ? (
        <ResultPanel
          files={[result]}
          note={
            <>
              Numbered {pages.length} page{pages.length === 1 ? "" : "s"} ({start}–{lastNumber}). Open the file to check a few pages before you send it.
            </>
          }
          onReset={reset}
          resetLabel="Number another PDF"
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start">
          <div className="mx-auto w-full max-w-[17rem] sm:max-w-sm md:max-w-none md:sticky md:top-4">
            {render ? (
              <PageStage
                imageUrl={render.url}
                ptWidth={render.ptWidth}
                ptHeight={render.ptHeight}
                items={[]}
                selectedId={null}
                onSelect={() => {}}
                onChange={() => {}}
                renderItem={() => null}
                overlay={overlay}
                pageLabel={`Preview of page ${shownPage}`}
              />
            ) : (
              <div className="aspect-[3/4] rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" aria-label="Loading preview" />
            )}
            <PageNav
              page={shownPage}
              count={numPages}
              onChange={setPreviewPage}
              extra={k < 0 && numPages > 0 ? <span className="text-xs text-zinc-500">(not numbered)</span> : null}
            />
            {loading && <p className="text-xs text-zinc-500 text-center mt-2">Loading preview…</p>}
          </div>

          <div className="grid gap-5">
            <fieldset>
              <legend className="text-sm font-medium mb-2">Position</legend>
              <div className="grid grid-cols-3 gap-2" role="group">
                {positions.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    aria-pressed={position === p.value}
                    aria-label={p.label}
                    title={p.label}
                    onClick={() => setPosition(p.value)}
                    className={`h-11 rounded-lg border text-xs font-medium transition-colors flex ${
                      p.value[0] === "t" ? "items-start" : "items-end"
                    } ${p.value[1] === "l" ? "justify-start" : p.value[1] === "r" ? "justify-end" : "justify-center"} p-1.5 ${
                      position === p.value
                        ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300"
                        : "border-black/10 dark:border-white/15 hover:border-red-300"
                    }`}
                  >
                    <span className={`rounded px-1 ${position === p.value ? "bg-red-600 text-white" : "bg-zinc-200 dark:bg-zinc-700"}`}>1</span>
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{positions.find((p) => p.value === position)?.label}</p>
            </fieldset>

            <Field label="Format">
              <select value={format} onChange={(e) => setFormat(e.target.value as NumberFormat)} className={`${inputClass} h-11`}>
                {sample.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <Segmented<Which>
              label="Pages to number"
              value={which}
              onChange={(v) => {
                setWhich(v);
                setPreviewPage(null);
              }}
              options={[
                { value: "all", label: "All pages" },
                { value: "skip-first", label: "Skip first page", hint: "Cover gets no number" },
                { value: "custom", label: "Custom range" },
              ]}
            />
            {which === "custom" && (
              <Field label="Page range" hint={`For example 3-${Math.max(3, numPages)} or 2-5, 8. This PDF has ${numPages} pages.`}>
                <input
                  value={range}
                  onChange={(e) => {
                    setRange(e.target.value);
                    setPreviewPage(null);
                  }}
                  placeholder={`3-${Math.max(3, numPages)}`}
                  inputMode="text"
                  className={`${inputClass} h-11`}
                />
              </Field>
            )}

            <Field
              label="Start at"
              hint={`Page ${firstNumbered} will show ${start}.${which !== "all" && start === 1 && firstNumbered > 1 ? ` Set ${firstNumbered} to count the skipped pages.` : ""}`}
            >
              <input
                type="number"
                min={0}
                max={99999}
                value={start}
                onChange={(e) => setStart(Math.max(0, Math.min(99999, parseInt(e.target.value || "0", 10) || 0)))}
                className={`${inputClass} h-11`}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Size: ${fontSize} pt`}>
                <input type="range" min={6} max={28} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value, 10))} className="h-10 accent-red-600" />
              </Field>
              <Field label={`Margin: ${Math.round((margin / 72) * 25.4)} mm`}>
                <input type="range" min={10} max={72} value={margin} onChange={(e) => setMargin(parseInt(e.target.value, 10))} className="h-10 accent-red-600" />
              </Field>
            </div>

            <Field label="Font">
              <select value={font} onChange={(e) => setFont(e.target.value as NumberFont)} className={`${inputClass} h-11`}>
                <option value="helvetica">Helvetica (sans)</option>
                <option value="times">Times (serif)</option>
                <option value="courier">Courier (mono)</option>
              </select>
            </Field>
            <ColorPicker value={color} onChange={setColor} />

            <ErrorNote>{pagesResult.error || error}</ErrorNote>
            <ActionButton onClick={run} busy={busy} disabled={!pdf || !pages.length || Boolean(pagesResult.error)}>
              Add page numbers{pages.length ? ` to ${pages.length} page${pages.length === 1 ? "" : "s"}` : ""}
            </ActionButton>
            {busy && <Progress value={progress} label="Numbering pages…" />}
            {sizes && new Set(sizes.map((s) => `${Math.round(s.w)}x${Math.round(s.h)}`)).size > 1 && (
              <p className="text-xs text-zinc-500">
                This PDF mixes page sizes or orientations. Each number is placed relative to its own page, so it stays in the same corner.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
