"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { ChevronLeft, ChevronRight, ScanSearch, RotateCcw } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import {
  ActionButton,
  ErrorNote,
  FileBar,
  InfoNote,
  Progress,
  ResultPanel,
  SecondaryButton,
  type ResultFile,
} from "@/components/ui/kit";
import { baseName, isPdf, pdfBlob } from "@/lib/download";
import { openPdf, renderPageToCanvas, type PdfDoc } from "@/lib/pdfjs";
import { PT_PER_IN, PT_PER_MM, pagesInScope, type Margins, type Scope } from "@/lib/crop";

type Loaded = { file: File; doc: PdfDoc; pages: number };
type Mode = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Unit = "mm" | "in";

const ZERO: Margins = { top: 0, right: 0, bottom: 0, left: 0 };
const MIN = 18; // points

const SCOPES: { value: Scope; label: string }[] = [
  { value: "all", label: "All pages" },
  { value: "current", label: "This page" },
  { value: "odd", label: "Odd pages" },
  { value: "even", label: "Even pages" },
];

export default function CropPdfClient() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 595, h: 842 });
  const [margins, setMargins] = useState<Margins>(ZERO);
  const [unit, setUnit] = useState<Unit>("mm");
  const [scope, setScope] = useState<Scope>("all");
  const [permanent, setPermanent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<{ files: ResultFile[]; summary: string } | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: Mode; x: number; y: number; start: Margins; k: number } | null>(null);

  const reset = () => {
    loaded?.doc.destroy();
    setLoaded(null);
    setResult(null);
    setError(null);
    setNote(null);
    setMargins(ZERO);
    setPage(1);
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
    setNote(null);
    try {
      const doc = await openPdf(await f.arrayBuffer());
      setMargins(ZERO);
      setPage(1);
      setLoaded({ file: f, doc, pages: doc.numPages });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this PDF.");
    }
  };

  // Render the current page.
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      try {
        const pg = await loaded.doc.getPage(page);
        const vp = pg.getViewport({ scale: 1 });
        if (cancelled) return;
        setSize({ w: vp.width, h: vp.height });
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const canvas = await renderPageToCanvas(loaded.doc, page, Math.min(3, (640 * dpr) / vp.width));
        if (cancelled || !holder.current) return;
        canvas.className = "block w-full h-auto select-none";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `Page ${page} preview`);
        holder.current.replaceChildren(canvas);
      } catch {
        // keep the previous preview
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, page]);

  const changed = () => {
    setResult(null);
    setNote(null);
  };

  const clampMargins = useCallback(
    (m: Margins): Margins => {
      const c = (v: number, max: number) => Math.max(0, Math.min(max, v));
      const top = c(m.top, size.h - MIN);
      const bottom = c(m.bottom, size.h - MIN - top);
      const left = c(m.left, size.w - MIN);
      const right = c(m.right, size.w - MIN - left);
      return { top, bottom, left, right };
    },
    [size],
  );

  const startDrag = (e: ReactPointerEvent<HTMLElement>) => {
    const mode = e.currentTarget.dataset.mode as Mode | undefined;
    if (!overlay.current || !mode) return;
    e.preventDefault();
    e.stopPropagation();
    overlay.current.setPointerCapture(e.pointerId);
    const k = size.w / overlay.current.getBoundingClientRect().width;
    drag.current = { mode, x: e.clientX, y: e.clientY, start: margins, k };
  };

  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) * d.k;
    const dy = (e.clientY - d.y) * d.k;
    const s = d.start;
    let m = { ...s };
    if (d.mode === "move") {
      const mx = Math.max(-s.left, Math.min(s.right, dx));
      const my = Math.max(-s.top, Math.min(s.bottom, dy));
      m = { left: s.left + mx, right: s.right - mx, top: s.top + my, bottom: s.bottom - my };
    } else {
      if (d.mode.includes("n")) m.top = Math.max(0, Math.min(size.h - s.bottom - MIN, s.top + dy));
      if (d.mode.includes("s")) m.bottom = Math.max(0, Math.min(size.h - s.top - MIN, s.bottom - dy));
      if (d.mode.includes("w")) m.left = Math.max(0, Math.min(size.w - s.right - MIN, s.left + dx));
      if (d.mode.includes("e")) m.right = Math.max(0, Math.min(size.w - s.left - MIN, s.right - dx));
    }
    setMargins(m);
    changed();
  };

  const endDrag = () => {
    drag.current = null;
  };

  const perUnit = unit === "mm" ? PT_PER_MM : PT_PER_IN;
  const show = (pt: number) => {
    const v = pt / perUnit;
    return unit === "mm" ? String(Math.round(v * 10) / 10) : String(Math.round(v * 100) / 100);
  };

  const setSide = (side: keyof Margins, raw: string) => {
    const v = parseFloat(raw.replace(",", "."));
    const pt = Number.isFinite(v) ? v * perUnit : 0;
    setMargins((old) => clampMargins({ ...old, [side]: pt }));
    changed();
  };

  const autoDetect = async () => {
    if (!loaded) return;
    setDetecting(true);
    setError(null);
    setNote(null);
    setProgress(0);
    try {
      const { detectMargins } = await import("@/lib/crop");
      const pages = pagesInScope(scope, page, loaded.pages).map((i) => i + 1);
      const m = await detectMargins(loaded.doc, pages, async (done, total) => {
        setProgress(done / total);
        await new Promise((r) => setTimeout(r));
      });
      if (!m) {
        setNote("These pages look blank, so there's nothing to fit the crop to.");
      } else {
        // Detected in points of each page; keep it inside the current page.
        setMargins(clampMargins(m));
        changed();
        setNote(
          pages.length > 1
            ? `Fitted to the content of ${Math.min(pages.length, 40)} page${pages.length === 1 ? "" : "s"} so nothing gets cut. Adjust the box if you want it tighter.`
            : "Fitted to the content of this page. Adjust the box if you want it tighter.",
        );
      }
    } catch {
      setError("Couldn't analyse the pages. Drag the box or type the margins instead.");
    } finally {
      setDetecting(false);
    }
  };

  const run = async () => {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { applyCrop } = await import("@/lib/crop");
      const pages = pagesInScope(scope, page, loaded.pages);
      if (!pages.length) throw new Error("none");
      const out = await applyCrop(await loaded.file.arrayBuffer(), margins, pages, permanent);
      const first = out.boxes[0];
      const w = first.width / perUnit;
      const h = first.height / perUnit;
      const fmt = (v: number) => (unit === "mm" ? Math.round(v) : Math.round(v * 100) / 100);
      setResult({
        files: [{ blob: pdfBlob(out.bytes), name: `${baseName(loaded.file.name)}-cropped.pdf` }],
        summary: `Cropped ${pages.length} page${pages.length === 1 ? "" : "s"}. Page ${pages[0] + 1} is now ${fmt(w)} × ${fmt(h)} ${unit}.`,
      });
    } catch (e) {
      setError(
        e instanceof Error && /encrypt/i.test(e.message)
          ? "This PDF has a password or edit restrictions, so it can't be cropped. Remove the protection first."
          : e instanceof Error && e.message === "none"
            ? "There are no pages in that selection (a one-page file has no even pages)."
            : "Couldn't crop this PDF. It may be damaged. Try re-saving it with Print to PDF first.",
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
      </div>
    );
  }

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const rect = {
    left: pct(margins.left, size.w),
    top: pct(margins.top, size.h),
    width: pct(size.w - margins.left - margins.right, size.w),
    height: pct(size.h - margins.top - margins.bottom, size.h),
  };
  const handles: { mode: Mode; style: CSSProperties; cursor: string }[] = [
    { mode: "nw", style: { left: 0, top: 0 }, cursor: "nwse-resize" },
    { mode: "ne", style: { left: "100%", top: 0 }, cursor: "nesw-resize" },
    { mode: "sw", style: { left: 0, top: "100%" }, cursor: "nesw-resize" },
    { mode: "se", style: { left: "100%", top: "100%" }, cursor: "nwse-resize" },
    { mode: "n", style: { left: "50%", top: 0 }, cursor: "ns-resize" },
    { mode: "s", style: { left: "50%", top: "100%" }, cursor: "ns-resize" },
    { mode: "w", style: { left: 0, top: "50%" }, cursor: "ew-resize" },
    { mode: "e", style: { left: "100%", top: "50%" }, cursor: "ew-resize" },
  ];
  const cropped = margins.top + margins.right + margins.bottom + margins.left > 0.5;

  return (
    <div>
      <FileBar
        name={loaded.file.name}
        detail={`${loaded.pages} page${loaded.pages === 1 ? "" : "s"}`}
        onReset={reset}
      />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem]">
        {/* Preview with crop box */}
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Page {page} of {loaded.pages}
            </span>
            <div className="flex gap-1">
              <IconButton label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <IconButton label="Next page" disabled={page >= loaded.pages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
          <div className="p-5 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <div
              className="relative mx-auto bg-white shadow"
              style={{ aspectRatio: `${size.w} / ${size.h}`, width: `min(100%, calc(70vh * ${size.w / size.h}))` }}
            >
              <div ref={holder} className="absolute inset-0" />
              <div
                ref={overlay}
                className="absolute inset-0 touch-none"
                onPointerMove={onMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                {/* Dimmed cut-away areas */}
                <div className="absolute bg-black/45 left-0 right-0 top-0" style={{ height: rect.top }} />
                <div
                  className="absolute bg-black/45 left-0 right-0 bottom-0"
                  style={{ height: pct(margins.bottom, size.h) }}
                />
                <div
                  className="absolute bg-black/45 left-0"
                  style={{ top: rect.top, height: rect.height, width: rect.left }}
                />
                <div
                  className="absolute bg-black/45 right-0"
                  style={{ top: rect.top, height: rect.height, width: pct(margins.right, size.w) }}
                />
                <div
                  className="absolute border-2 border-red-600 cursor-move"
                  style={rect}
                  data-mode="move"
                  onPointerDown={startDrag}
                  aria-label="Crop area. Drag to move; drag the handles to resize."
                  role="group"
                >
                  {handles.map((hd) => (
                    <span
                      key={hd.mode}
                      data-mode={hd.mode}
                      onPointerDown={startDrag}
                      className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                      style={{ ...hd.style, cursor: hd.cursor }}
                    >
                      <span className="h-4 w-4 rounded-sm bg-white border-2 border-red-600 shadow" />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Drag the red box or its handles. Everything in the dark area is hidden.
          </p>
        </div>

        {/* Controls */}
        <div className="grid gap-4 content-start">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Margins to remove</span>
              <div
                className="flex rounded-full border border-black/10 dark:border-white/15 p-0.5"
                role="group"
                aria-label="Units"
              >
                {(["mm", "in"] as Unit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={unit === u}
                    onClick={() => setUnit(u)}
                    className={`h-8 px-3 rounded-full text-xs font-medium ${unit === u ? "bg-red-600 text-white" : ""}`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["top", "bottom", "left", "right"] as (keyof Margins)[]).map((side) => (
                <label key={side} className="grid gap-1 text-xs min-w-0">
                  <span className="capitalize text-zinc-600 dark:text-zinc-400">{side}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={unit === "mm" ? 1 : 0.05}
                    value={show(margins[side])}
                    onChange={(e) => setSide(side, e.target.value)}
                    className="w-full min-w-0 rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-zinc-900 px-3 py-2 text-sm h-10"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SecondaryButton onClick={autoDetect} disabled={detecting}>
              <ScanSearch className="h-4 w-4" aria-hidden="true" />
              {detecting ? "Finding content…" : "Auto-detect margins"}
            </SecondaryButton>
            <SecondaryButton
              onClick={() => {
                setMargins(ZERO);
                changed();
              }}
              disabled={!cropped}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset
            </SecondaryButton>
          </div>
          {detecting && <Progress value={progress} label="Looking for the content edges…" />}
          {note && <p className="text-xs text-emerald-800 dark:text-emerald-300">{note}</p>}
          <fieldset>
            <legend className="text-sm font-medium mb-2">Apply to</legend>
            <div className="grid grid-cols-2 gap-2">
              {SCOPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={scope === s.value}
                  onClick={() => {
                    setScope(s.value);
                    changed();
                  }}
                  className={`min-h-10 rounded-lg border px-3 text-sm transition-colors ${
                    scope === s.value
                      ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 font-medium"
                      : "border-black/10 dark:border-white/10 hover:border-red-300"
                  }`}
                >
                  {s.label}
                  {s.value === "current" ? ` (${page})` : ""}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 mt-0.5 accent-red-600"
              checked={permanent}
              onChange={(e) => {
                setPermanent(e.target.checked);
                changed();
              }}
            />
            <span>
              Also shrink the page size (MediaBox)
              <span className="block text-xs text-zinc-500">
                Printers and editors then see the smaller page. The hidden content still stays in the file.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="mt-5">
        <ActionButton onClick={run} busy={busy} disabled={!cropped}>
          {busy ? "Cropping…" : cropped ? "Crop PDF" : "Drag the box or enter margins"}
        </ActionButton>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {result && (
        <ResultPanel
          files={result.files}
          note={
            <>
              {result.summary} Cropping hides the cut-off area; it isn&apos;t deleted, so text or images there can still
              be found by search tools or restored by editing the PDF.
            </>
          }
          onReset={reset}
          resetLabel="Crop another PDF"
        />
      )}
      {!result && (
        <InfoNote>
          Cropping sets the visible area of each page. Nothing is re-rendered, so text stays sharp and selectable.
        </InfoNote>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-black/10 dark:border-white/15 hover:border-red-400 hover:text-red-600 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
