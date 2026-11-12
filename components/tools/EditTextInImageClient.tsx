"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, SquareDashed, Undo2 } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, Progress, ResultPanel, SecondaryButton, inputClass, type ResultFile } from "@/components/ui/kit";
import { formatBytes } from "@/lib/download";
import { IMAGE_ACCEPT, canvasBlob, ctx2d, decodeImage, isBrowserImage, isHeic, releaseSource, sourceToCanvas } from "@/lib/image-utils";
import { ocrLanguages } from "@/lib/vendor";
import {
  FONTS,
  applyEdit,
  autoSize,
  createOcrWorker,
  editBounds,
  findText,
  sampleColors,
  widthRatio,
  type Box,
  type FillMode,
  type TextBox,
  type TextEdit,
} from "@/lib/text-in-image";

type Worker = Awaited<ReturnType<typeof createOcrWorker>>;
type UndoStep = { x: number; y: number; data: ImageData; boxId: string | null };

const toggleCls = (on: boolean) =>
  `h-10 min-w-10 px-2 inline-flex items-center justify-center rounded-md border text-sm ${
    on ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300" : "border-black/15 dark:border-white/15"
  }`;

export default function EditTextInImageClient() {
  const [file, setFile] = useState<File | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [lang, setLang] = useState("eng");
  const [ocrState, setOcrState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  const [boxes, setBoxes] = useState<TextBox[]>([]);
  const [level, setLevel] = useState<"word" | "line">("word");
  const [edit, setEdit] = useState<(TextEdit & { boxId: string | null; sizeAuto: boolean; ratio: number }) | null>(null);
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [undoCount, setUndoCount] = useState(0);
  const [drawMode, setDrawMode] = useState(false);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultFile | null>(null);
  const [version, setVersion] = useState(0);

  const committed = useRef<HTMLCanvasElement | null>(null);
  const display = useRef<HTMLCanvasElement | null>(null);
  const overlay = useRef<HTMLDivElement | null>(null);
  const worker = useRef<{ lang: string; w: Worker } | null>(null);
  const undo = useRef<UndoStep[]>([]);
  const runId = useRef(0);

  useEffect(
    () => () => {
      worker.current?.w.terminate();
    },
    []
  );

  // Redraw: committed image + the edit being previewed.
  useEffect(() => {
    const src = committed.current;
    const dst = display.current;
    if (!src || !dst) return;
    if (dst.width !== src.width || dst.height !== src.height) {
      dst.width = src.width;
      dst.height = src.height;
    }
    const ctx = ctx2d(dst, true);
    ctx.drawImage(src, 0, 0);
    if (edit) applyEdit(ctx, edit);
  }, [edit, version, dims]);

  const runOcr = useCallback(async (language: string) => {
    const canvas = committed.current;
    if (!canvas) return;
    const id = ++runId.current;
    setOcrState("running");
    setOcrProgress(0);
    setOcrStatus("Loading the text reader…");
    setBoxes([]);
    try {
      if (!worker.current || worker.current.lang !== language) {
        await worker.current?.w.terminate();
        worker.current = null;
        const w = await createOcrWorker(language, (p, status) => {
          if (id !== runId.current) return;
          setOcrProgress(status === "recognizing text" ? 0.3 + p * 0.7 : p * 0.3);
          setOcrStatus(status === "recognizing text" ? "Finding text…" : "Loading the text reader (first time only)…");
        });
        worker.current = { lang: language, w };
      }
      const found = await findText(worker.current.w, canvas);
      if (id !== runId.current) return;
      setBoxes(found);
      setOcrState("done");
    } catch (e) {
      console.error(e);
      if (id !== runId.current) return;
      setOcrState("error");
      setError("The text reader couldn't start. Reload the page and try again, or draw a box around the text yourself.");
    }
  }, []);

  const onFiles = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      setError(null);
      if (!isBrowserImage(f)) {
        setError(isHeic(f) ? "Convert HEIC photos with HEIC to JPG first, then edit the JPG here." : "Choose a JPG, PNG or WebP image.");
        return;
      }
      try {
        const src = await decodeImage(f);
        const canvas = sourceToCanvas(src);
        releaseSource(src);
        committed.current = canvas;
        undo.current = [];
        setUndoCount(0);
        setEdited(new Set());
        setEdit(null);
        setResult(null);
        setFile(f);
        setDims({ w: canvas.width, h: canvas.height });
        runOcr(lang);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't open that image.");
      }
    },
    [lang, runOcr]
  );

  const reset = () => {
    runId.current++;
    committed.current = null;
    undo.current = [];
    setUndoCount(0);
    setFile(null);
    setDims(null);
    setBoxes([]);
    setEdit(null);
    setEdited(new Set());
    setResult(null);
    setOcrState("idle");
    setError(null);
    setDrawMode(false);
  };

  const startEdit = (box: Box, original: string, boxId: string | null) => {
    const canvas = committed.current;
    if (!canvas) return;
    const { bg, fg, bold } = sampleColors(canvas, box);
    const base = { font: FONTS[0].css, bold, italic: false, original, text: original };
    const size = autoSize(ctx2d(canvas), base, box.h);
    setResult(null);
    setDrawMode(false);
    setEdit({
      ...base,
      box,
      size,
      sizeAuto: true,
      color: fg,
      fill: "auto",
      fillColor: bg,
      align: "left",
      fitWidth: false,
      boxId,
      ratio: 1,
    });
  };

  const update = (patch: Partial<TextEdit & { sizeAuto: boolean }>) => {
    setEdit((e) => {
      if (!e) return e;
      const next = { ...e, ...patch };
      if (next.sizeAuto && ("font" in patch || "bold" in patch || "italic" in patch) && committed.current) {
        next.size = autoSize(ctx2d(committed.current), next, next.box.h);
      }
      if (committed.current) next.ratio = widthRatio(ctx2d(committed.current), next);
      return next;
    });
  };

  const commit = () => {
    const canvas = committed.current;
    if (!canvas || !edit) return;
    const ctx = ctx2d(canvas, true);
    const b = editBounds(ctx, edit);
    undo.current.push({ x: b.x, y: b.y, data: ctx.getImageData(b.x, b.y, b.w, b.h), boxId: edit.boxId });
    if (undo.current.length > 30) undo.current.shift();
    applyEdit(ctx, edit);
    setUndoCount(undo.current.length);
    if (edit.boxId) setEdited((s) => new Set(s).add(edit.boxId!));
    setEdit(null);
    setVersion((v) => v + 1);
  };

  const doUndo = () => {
    const canvas = committed.current;
    const step = undo.current.pop();
    if (!canvas || !step) return;
    ctx2d(canvas, true).putImageData(step.data, step.x, step.y);
    if (step.boxId) {
      setEdited((s) => {
        const n = new Set(s);
        n.delete(step.boxId!);
        return n;
      });
    }
    setUndoCount(undo.current.length);
    setEdit(null);
    setResult(null);
    setVersion((v) => v + 1);
  };

  const exportAs = async (type: "image/png" | "image/jpeg") => {
    const canvas = committed.current;
    if (!canvas || !file) return;
    const blob = await canvasBlob(canvas, type, type === "image/jpeg" ? 0.92 : undefined);
    const base = file.name.replace(/\.[^.]+$/, "");
    setResult({ blob, name: `${base}-edited.${type === "image/png" ? "png" : "jpg"}` });
  };

  // Manual box drawing (pointer events work for mouse, pen and touch).
  const toImage = (e: ReactPointerEvent) => {
    const r = overlay.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * (dims?.w ?? 1), y: ((e.clientY - r.top) / r.height) * (dims?.h ?? 1) };
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toImage(e);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawMode || !drag) return;
    const p = toImage(e);
    setDrag({ ...drag, x1: p.x, y1: p.y });
  };
  const onUp = () => {
    if (!drawMode || !drag) return;
    const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
    setDrag(null);
    if (w >= 6 && h >= 6) startEdit({ x, y, w, h }, "", null);
  };

  const shown = boxes.filter((b) => b.level === level);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  return (
    <div>
      {!file || !dims ? (
        <>
          <Dropzone accept={IMAGE_ACCEPT} onFiles={onFiles} label="Drop an image with text to fix" hint="Banner, screenshot, slide or poster · JPG, PNG or WebP" />
          <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span>Text language</span>
            <select value={lang} onChange={(e) => setLang(e.target.value)} className={`${inputClass} min-h-10`}>
              {ocrLanguages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <FileBar name={file.name} detail={`${dims.w}×${dims.h} · ${formatBytes(file.size)}`} onReset={reset} />

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-black/15 dark:border-white/15 overflow-hidden" role="group" aria-label="Select by">
              {(["word", "line"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={level === l}
                  onClick={() => setLevel(l)}
                  className={`h-10 px-3 text-sm ${level === l ? "bg-red-600 text-white" : ""}`}
                >
                  {l === "word" ? "Words" : "Lines"}
                </button>
              ))}
            </div>
            <button type="button" aria-pressed={drawMode} onClick={() => { setDrawMode(!drawMode); setEdit(null); }} className={toggleCls(drawMode)}>
              <SquareDashed className="h-4 w-4 mr-1.5" aria-hidden="true" /> Draw a box
            </button>
            <button type="button" onClick={doUndo} disabled={!undoCount} className={`${toggleCls(false)} disabled:opacity-40`}>
              <Undo2 className="h-4 w-4 mr-1.5" aria-hidden="true" /> Undo
            </button>
            <select
              aria-label="Text language"
              value={lang}
              onChange={(e) => {
                setLang(e.target.value);
                runOcr(e.target.value);
              }}
              className={`${inputClass} min-h-10`}
            >
              {ocrLanguages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {ocrState === "running" && <Progress value={ocrProgress} label={ocrStatus} />}
          <p className="mt-2 mb-2 text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
            {drawMode
              ? "Drag across the text you want to replace."
              : ocrState === "done"
                ? shown.length
                  ? `Tap the ${level} you want to change (${shown.length} found). Missing one? Use Draw a box.`
                  : "No text found. Use Draw a box to mark the text yourself."
                : ocrState === "running"
                  ? "Reading the text in your image…"
                  : ""}
          </p>

          <div className="relative w-full select-none" style={{ aspectRatio: `${dims.w} / ${dims.h}` }}>
            <canvas ref={display} className="absolute inset-0 h-full w-full rounded border border-black/10 dark:border-white/10" aria-label="Your image" />
            <div
              ref={overlay}
              className={`absolute inset-0 ${drawMode ? "cursor-crosshair touch-none" : ""}`}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => setDrag(null)}
            >
              {!drawMode &&
                !edit &&
                shown.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    title={b.text}
                    aria-label={`Edit "${b.text}"`}
                    onClick={() => startEdit(b, b.text, b.id)}
                    className={`absolute rounded-sm border-2 ${
                      edited.has(b.id) ? "border-emerald-500/80 bg-emerald-400/10" : "border-red-500/80 bg-red-500/10 hover:bg-red-500/25"
                    }`}
                    style={{ left: pct(b.x, dims.w), top: pct(b.y, dims.h), width: pct(b.w, dims.w), height: pct(b.h, dims.h) }}
                  />
                ))}
              {edit && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-sky-500"
                  style={{ left: pct(edit.box.x, dims.w), top: pct(edit.box.y, dims.h), width: pct(edit.box.w, dims.w), height: pct(edit.box.h, dims.h) }}
                />
              )}
              {drag && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-sky-500 bg-sky-400/10"
                  style={{
                    left: pct(Math.min(drag.x0, drag.x1), dims.w),
                    top: pct(Math.min(drag.y0, drag.y1), dims.h),
                    width: pct(Math.abs(drag.x1 - drag.x0), dims.w),
                    height: pct(Math.abs(drag.y1 - drag.y0), dims.h),
                  }}
                />
              )}
            </div>
          </div>

          {edit && (
            <div className="mt-4 rounded-xl border border-sky-300 dark:border-sky-500/40 p-4 grid gap-4">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">{edit.original ? <>Replace “{edit.original}” with</> : "New text"}</span>
                <input
                  type="text"
                  value={edit.text}
                  autoFocus
                  onChange={(e) => update({ text: e.target.value })}
                  className={`${inputClass} min-h-10 text-base`}
                  placeholder="Leave empty to just erase"
                />
              </label>
              {edit.ratio > 1.08 && (
                <p className="-mt-2 text-xs text-amber-700 dark:text-amber-300">
                  The new text is wider than the old one, so it may run into the next word. Switch to Lines to rewrite the whole line, tick Fit to box width, or lower the size.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Font (closest match)</span>
                  <select value={edit.font} onChange={(e) => update({ font: e.target.value })} className={`${inputClass} min-h-10`}>
                    {FONTS.map((f) => (
                      <option key={f.label} value={f.css}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-1 text-sm">
                  <span className="font-medium">
                    Size: {edit.size}px {edit.sizeAuto && <span className="font-normal text-zinc-500">(matched to the box)</span>}
                  </span>
                  <input
                    type="range"
                    aria-label="Font size"
                    min={4}
                    max={Math.max(40, Math.round(edit.box.h * 3))}
                    value={edit.size}
                    onChange={(e) => update({ size: Number(e.target.value), sizeAuto: false })}
                    className="w-full accent-red-600 h-10"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-pressed={edit.bold} aria-label="Bold" onClick={() => update({ bold: !edit.bold })} className={toggleCls(edit.bold)}>
                  <Bold className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" aria-pressed={edit.italic} aria-label="Italic" onClick={() => update({ italic: !edit.italic })} className={toggleCls(edit.italic)}>
                  <Italic className="h-4 w-4" aria-hidden="true" />
                </button>
                {(
                  [
                    ["left", AlignLeft],
                    ["center", AlignCenter],
                    ["right", AlignRight],
                  ] as const
                ).map(([a, Icon]) => (
                  <button key={a} type="button" aria-pressed={edit.align === a} aria-label={`Align ${a}`} onClick={() => update({ align: a })} className={toggleCls(edit.align === a)}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </button>
                ))}
                <label className="inline-flex min-h-10 items-center gap-2 text-sm px-1">
                  <input type="checkbox" checked={edit.fitWidth} onChange={(e) => update({ fitWidth: e.target.checked })} className="h-4 w-4 accent-red-600" />
                  Fit to box width
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  Text colour
                  <input type="color" value={edit.color} onChange={(e) => update({ color: e.target.value })} className="h-10 w-12 rounded border border-black/15 dark:border-white/15 bg-transparent" />
                </label>
              </div>
              <fieldset>
                <legend className="text-sm font-medium mb-1.5">Cover the old text with</legend>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ["auto", "Background colour"],
                      ["smart", "Smart fill (gradients)"],
                    ] as [FillMode, string][]
                  ).map(([v, l]) => (
                    <button key={v} type="button" aria-pressed={edit.fill === v} onClick={() => update({ fill: v })} className={toggleCls(edit.fill === v)}>
                      {l}
                    </button>
                  ))}
                  {edit.fill !== "smart" && (
                    <label className="inline-flex items-center gap-2 text-sm">
                      <span className="sr-only">Fill colour</span>
                      <input
                        type="color"
                        value={edit.fillColor}
                        onChange={(e) => update({ fillColor: e.target.value, fill: "color" })}
                        className="h-10 w-12 rounded border border-black/15 dark:border-white/15 bg-transparent"
                      />
                    </label>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  The colour is picked from just outside the box. Smart fill blends the edges instead, for shaded or gradient backgrounds.
                </p>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <ActionButton onClick={commit}>Apply</ActionButton>
                <SecondaryButton onClick={() => setEdit(null)}>Cancel</SecondaryButton>
              </div>
            </div>
          )}

          {ocrState === "done" && shown.length > 0 && !edit && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer min-h-10 flex items-center text-zinc-600 dark:text-zinc-400">All text found ({shown.length})</summary>
              <ul className="mt-2 flex flex-wrap gap-2">
                {shown.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => startEdit(b, b.text, b.id)} className="min-h-10 rounded-full border border-black/15 dark:border-white/15 px-3 hover:border-red-400">
                      {b.text}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {!edit && (
            <div className="mt-5 flex flex-wrap gap-2">
              <ActionButton onClick={() => exportAs("image/png")} disabled={!undoCount}>
                Save as PNG
              </ActionButton>
              <SecondaryButton onClick={() => exportAs("image/jpeg")} disabled={!undoCount}>
                Save as JPG
              </SecondaryButton>
            </div>
          )}
        </>
      )}
      <ErrorNote>{error}</ErrorNote>
      {result && !edit && (
        <ResultPanel
          title="Edited image ready"
          files={[result]}
          note={`${dims?.w}×${dims?.h} pixels, the same size as your original.`}
          onReset={reset}
          resetLabel="Edit another image"
        />
      )}
    </div>
  );
}
