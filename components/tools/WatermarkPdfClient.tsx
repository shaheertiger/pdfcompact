"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PDFDocument, type PDFFont } from "pdf-lib";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, Field, FileBar, Progress, ResultPanel, Segmented, inputClass, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, isPdf, parsePageList, pdfBlob } from "@/lib/download";
import { fontCanDraw, loadEditable, loadImageFile, textToPng, tick, type LoadedImage } from "@/lib/pdf-stamp";
import {
  applyWatermark,
  layoutWatermark,
  textMetrics,
  watermarkFonts,
  type MarkMetrics,
  type WatermarkFont,
  type WatermarkLayout,
} from "@/lib/watermark";
import ColorPicker from "./stamp/ColorPicker";
import PageStage, { PageNav } from "./stamp/PageStage";
import { usePageRender, usePdfDoc } from "./stamp/usePdfPreview";

const presets = ["CONFIDENTIAL", "DRAFT", "COPY", "SAMPLE", "DO NOT COPY"];
const angles = [
  { value: 45, label: "Diagonal ↗" },
  { value: 0, label: "Flat" },
  { value: -45, label: "Diagonal ↘" },
];

export default function WatermarkPdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kind, setKind] = useState<"text" | "image">("text");
  const [text, setText] = useState("CONFIDENTIAL");
  const [font, setFont] = useState<WatermarkFont>("helvetica-bold");
  const [sizePct, setSizePct] = useState(85);
  const [opacity, setOpacity] = useState(0.2);
  const [angle, setAngle] = useState(45);
  const [color, setColor] = useState("#dc2626");
  const [layout, setLayout] = useState<WatermarkLayout>("center");
  const [layer, setLayer] = useState<"over" | "under">("over");
  const [which, setWhich] = useState<"all" | "custom">("all");
  const [range, setRange] = useState("");
  const [logo, setLogo] = useState<LoadedImage | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultFile | null>(null);
  const [fonts, setFonts] = useState<Record<WatermarkFont, PDFFont> | null>(null);

  const { pdf, error: pdfError } = usePdfDoc(bytes);
  const numPages = pdf?.numPages ?? 0;
  const shownPage = Math.min(Math.max(1, previewPage), Math.max(1, numPages));
  const { render } = usePageRender(pdf, shownPage, 640);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await PDFDocument.create();
      const keys = Object.keys(watermarkFonts) as WatermarkFont[];
      const list = await Promise.all(keys.map((k) => d.embedFont(watermarkFonts[k].std)));
      if (!cancelled) setFonts(Object.fromEntries(keys.map((k, i) => [k, list[i]])) as Record<WatermarkFont, PDFFont>);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pagesResult = useMemo((): { pages: number[]; error: string | null } => {
    if (!numPages) return { pages: [], error: null };
    if (which === "all") return { pages: Array.from({ length: numPages }, (_, i) => i), error: null };
    if (!range.trim()) return { pages: [], error: "Type the pages to watermark, e.g. 1-3." };
    try {
      return { pages: parsePageList(range, numPages), error: null };
    } catch (e) {
      return { pages: [], error: e instanceof Error ? e.message : String(e) };
    }
  }, [numPages, which, range]);

  const cleanText = text.replace(/\s+/g, " ").trim();
  const standardOk = fonts ? fontCanDraw(fonts[font], cleanText) : true;

  const metrics: MarkMetrics | null = useMemo(() => {
    if (kind === "image") return logo ? { w1: logo.width / logo.height, h1: 1 } : null;
    if (!fonts || !cleanText) return null;
    if (standardOk) return textMetrics(fonts[font], cleanText);
    // Approximate with the browser's own font for scripts we rasterise.
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return null;
    ctx.font = `${watermarkFonts[font].weight} 100px ${watermarkFonts[font].css}`;
    return { w1: ctx.measureText(cleanText).width / 100, h1: 1.2 };
  }, [kind, logo, fonts, font, cleanText, standardOk]);

  const reset = () => {
    setFile(null);
    setBytes(null);
    setResult(null);
    setError(null);
    setLoadError(null);
    setPreviewPage(1);
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

  const onLogo = async (files: File[]) => {
    setLogoError(null);
    try {
      const img = await loadImageFile(files[0]);
      if (logo) URL.revokeObjectURL(logo.url);
      setLogo(img);
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : String(e));
    }
  };

  const setLayoutAndSize = (l: WatermarkLayout) => {
    setLayout(l);
    setSizePct(l === "tile" ? (kind === "image" ? 20 : 30) : kind === "image" ? 50 : 85);
  };

  const run = async () => {
    if (!bytes || !file) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      let image: { bytes: Uint8Array; kind: "png" | "jpg"; width: number; height: number } | undefined;
      if (kind === "image") {
        if (!logo) throw new Error("Add an image first.");
        image = logo;
      } else if (!standardOk) {
        // Scripts the built-in PDF fonts can't encode (Hindi, Chinese, emoji…) go in as a sharp image.
        const r = await textToPng(cleanText, watermarkFonts[font].css, 120, color, 2, watermarkFonts[font].weight);
        image = { bytes: r.bytes, kind: "png", width: r.width, height: r.height };
      }
      const doc = await loadEditable(bytes);
      await applyWatermark(
        doc,
        { kind, text: cleanText, font, sizePct, color, opacity, angle, layout, pages: pagesResult.pages, layer, image },
        async (done, total) => {
          setProgress((done / total) * 0.9);
          await tick();
        }
      );
      const out = await doc.save();
      setProgress(1);
      setResult({ blob: pdfBlob(out), name: `${baseName(file.name)}-watermarked.pdf` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while adding the watermark.");
    } finally {
      setBusy(false);
    }
  };

  const onPage = pagesResult.pages.includes(shownPage - 1);
  const overlay = () => {
    if (!render || !metrics || !onPage) return null;
    const lay = layoutWatermark(render.ptWidth, render.ptHeight, metrics, { sizePct, angle, layout });
    return (
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        viewBox={`0 0 ${render.ptWidth} ${render.ptHeight}`}
        aria-hidden="true"
        style={{ opacity }}
      >
        {lay.items.map((it, i) => (
          <g key={i} transform={`translate(${it.cx} ${it.cy}) rotate(${-angle})`}>
            {kind === "image" && logo ? (
              <image href={logo.url} x={-lay.w / 2} y={-lay.h / 2} width={lay.w} height={lay.h} preserveAspectRatio="none" />
            ) : (
              <text
                x={-lay.w / 2}
                y={lay.h / 2}
                fontSize={lay.size}
                fontFamily={watermarkFonts[font].css}
                fontWeight={watermarkFonts[font].weight}
                fill={color}
                textLength={standardOk ? lay.w : undefined}
                lengthAdjust="spacingAndGlyphs"
              >
                {cleanText}
              </text>
            )}
          </g>
        ))}
      </svg>
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

  const ready = Boolean(pdf) && pagesResult.pages.length > 0 && !pagesResult.error && (kind === "text" ? Boolean(cleanText) : Boolean(logo));

  return (
    <div>
      <FileBar name={file.name} detail={`${numPages || "…"} pages · ${formatBytes(file.size)}`} onReset={reset} />
      <ErrorNote>{pdfError}</ErrorNote>

      {result ? (
        <ResultPanel
          files={[result]}
          originalSize={file.size}
          note={
            <>
              Watermarked {pagesResult.pages.length} page{pagesResult.pages.length === 1 ? "" : "s"}. Anyone with a PDF editor can still
              remove a watermark; to make that much harder, run the file through <Link className="underline" href="/flatten-pdf">Flatten PDF</Link>{" "}
              and choose Flatten everything, which turns each page into an image.
            </>
          }
          onReset={() => setResult(null)}
          resetLabel="Change the watermark"
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
              extra={!onPage && numPages > 0 ? <span className="text-xs text-zinc-500">(no watermark)</span> : null}
            />
            {layer === "under" && (
              <p className="mt-2 text-xs text-zinc-500 text-center">
                The preview always draws on top. Behind-content marks are hidden wherever the page has a photo or a white background box.
              </p>
            )}
          </div>

          <div className="grid gap-5">
            <Segmented
              value={kind}
              onChange={(v) => {
                setKind(v);
                setSizePct(layout === "tile" ? (v === "image" ? 20 : 30) : v === "image" ? 50 : 85);
                if (v === "image") setAngle(0);
                else setAngle(45);
              }}
              options={[
                { value: "text", label: "Text" },
                { value: "image", label: "Image or logo" },
              ]}
            />

            {kind === "text" ? (
              <>
                <div>
                  <div className="flex flex-wrap gap-2 mb-2" role="group" aria-label="Presets">
                    {presets.map((p) => (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={cleanText === p}
                        onClick={() => setText(p)}
                        className={`h-10 rounded-full border px-3 text-xs font-semibold tracking-wide ${
                          cleanText === p
                            ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300"
                            : "border-black/10 dark:border-white/15 hover:border-red-300"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <Field label="Watermark text">
                    <input value={text} maxLength={80} onChange={(e) => setText(e.target.value)} className={`${inputClass} h-11`} />
                  </Field>
                  {!standardOk && cleanText && (
                    <p className="mt-1 text-xs text-zinc-500">
                      These characters aren&apos;t in the built-in PDF fonts, so the text goes in as a high-resolution image.
                    </p>
                  )}
                </div>
                <Field label="Font">
                  <select value={font} onChange={(e) => setFont(e.target.value as WatermarkFont)} className={`${inputClass} h-11`}>
                    {(Object.keys(watermarkFonts) as WatermarkFont[]).map((k) => (
                      <option key={k} value={k}>
                        {watermarkFonts[k].label}
                      </option>
                    ))}
                  </select>
                </Field>
                <ColorPicker
                  value={color}
                  onChange={setColor}
                  swatches={[
                    { value: "#dc2626", label: "Red" },
                    { value: "#6b7280", label: "Gray" },
                    { value: "#000000", label: "Black" },
                    { value: "#1d4ed8", label: "Blue" },
                  ]}
                />
              </>
            ) : (
              <div>
                {logo ? (
                  <div className="flex items-center gap-3 rounded-lg border border-black/10 dark:border-white/15 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo.url} alt="Watermark image" className="h-12 w-12 object-contain bg-[repeating-conic-gradient(#e4e4e7_0_25%,transparent_0_50%)] bg-[length:12px_12px] rounded" />
                    <span className="text-sm truncate flex-1">{logo.name}</span>
                    <button type="button" onClick={() => setLogo(null)} className="h-10 px-3 text-sm text-zinc-500 hover:text-red-600">
                      Change
                    </button>
                  </div>
                ) : (
                  <Dropzone onFiles={onLogo} accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" label="Add a PNG or JPG logo" hint="A PNG with a transparent background looks best" />
                )}
                <ErrorNote>{logoError}</ErrorNote>
              </div>
            )}

            <Segmented
              label="Layout"
              value={layout}
              onChange={setLayoutAndSize}
              options={[
                { value: "center", label: "One in the middle" },
                { value: "tile", label: "Tiled", hint: "Repeated across the page" },
              ]}
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Size: ${sizePct}%`}>
                <input type="range" min={5} max={100} value={sizePct} onChange={(e) => setSizePct(parseInt(e.target.value, 10))} className="h-10 accent-red-600" />
              </Field>
              <Field label={`Opacity: ${Math.round(opacity * 100)}%`}>
                <input type="range" min={5} max={100} step={5} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(parseInt(e.target.value, 10) / 100)} className="h-10 accent-red-600" />
              </Field>
            </div>

            <fieldset>
              <legend className="text-sm font-medium mb-2">Angle: {angle}°</legend>
              <div className="flex flex-wrap gap-2">
                {angles.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    aria-pressed={angle === a.value}
                    onClick={() => setAngle(a.value)}
                    className={`h-10 rounded-full border px-3 text-sm ${
                      angle === a.value ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300" : "border-black/10 dark:border-white/15 hover:border-red-300"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={-90}
                max={90}
                value={angle}
                aria-label="Angle in degrees"
                onChange={(e) => setAngle(parseInt(e.target.value, 10))}
                className="mt-2 h-10 w-full accent-red-600"
              />
            </fieldset>

            <Segmented
              label="Layer"
              value={layer}
              onChange={setLayer}
              options={[
                { value: "over", label: "On top", hint: "Always visible" },
                { value: "under", label: "Behind content", hint: "Text stays crisp" },
              ]}
            />

            <Segmented
              label="Pages"
              value={which}
              onChange={setWhich}
              options={[
                { value: "all", label: "All pages" },
                { value: "custom", label: "Some pages" },
              ]}
            />
            {which === "custom" && (
              <Field label="Page range" hint={`For example 1-3, 7. This PDF has ${numPages} pages.`}>
                <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="1-3" className={`${inputClass} h-11`} />
              </Field>
            )}

            <ErrorNote>{pagesResult.error || error}</ErrorNote>
            <ActionButton onClick={run} busy={busy} disabled={!ready}>
              Add watermark
            </ActionButton>
            {busy && <Progress value={progress} label="Adding the watermark…" />}
          </div>
        </div>
      )}
    </div>
  );
}
