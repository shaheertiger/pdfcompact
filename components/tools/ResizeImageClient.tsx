"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Link2, Link2Off, Plus } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, Field, Progress, ResultPanel, Segmented, inputClass, type ResultFile } from "@/components/ui/kit";
import { downloadBlob, formatBytes, zipFiles } from "@/lib/download";
import { nextId } from "@/lib/id";
import { IMAGE_ACCEPT, decodeImage, isBrowserImage, isHeic, releaseSource, sourceSize, yieldToUi, type OutputType } from "@/lib/image-utils";
import { RESIZE_PRESETS, resizeImage, targetSize, type FitMode, type ResizeOptions, type ResizeResult, type ResizeSpec } from "@/lib/resize-image";

type Item = { id: string; file: File; w: number; h: number };
type Done = ResizeResult & { id: string; name: string; url: string; inSize: number };

const pill = (on: boolean) =>
  `min-h-10 rounded-full border px-4 text-sm transition-colors ${
    on
      ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 font-medium"
      : "border-black/15 dark:border-white/15 hover:border-red-300"
  }`;

const FIT_HINT: Record<FitMode, string> = {
  contain: "Whole image visible; empty space filled with the colour below.",
  cover: "Fills the frame; the edges that don't fit are cropped equally.",
  stretch: "Forced to the exact size; people and circles can look squashed.",
};

function ext(type: OutputType) {
  return type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
}

export default function ResizeImageClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<"pixels" | "percent" | "preset">("pixels");
  const [w, setW] = useState(1080);
  const [h, setH] = useState(1080);
  const [lock, setLock] = useState(true);
  const [lockBy, setLockBy] = useState<"width" | "height">("width");
  const [pct, setPct] = useState(50);
  const [presetId, setPresetId] = useState(RESIZE_PRESETS[0].id);
  const [fit, setFit] = useState<FitMode>("cover");
  const [format, setFormat] = useState<"keep" | OutputType>("keep");
  const [quality, setQuality] = useState(90);
  const [background, setBackground] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done[]>([]);
  const [zip, setZip] = useState<ResultFile | null>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const clearResults = useCallback(() => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setDone([]);
    setZip(null);
  }, []);

  const isEmpty = items.length === 0;
  const addFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      const ok = files.filter(isBrowserImage);
      if (ok.length < files.length) {
        setError(
          files.some(isHeic)
            ? "HEIC photos need converting first: use HEIC to JPG, then resize the JPGs."
            : "Some files were skipped: only JPG, PNG and WebP images can be resized."
        );
      }
      const added: Item[] = [];
      for (const file of ok) {
        try {
          const src = await decodeImage(file);
          const s = sourceSize(src);
          releaseSource(src);
          added.push({ id: nextId("rs"), file, w: s.width, h: s.height });
        } catch {
          setError(`Couldn't read ${file.name}. It may be damaged.`);
        }
      }
      if (isEmpty && added[0]) {
        // Start the pixel fields from the first image's real size.
        setW(added[0].w);
        setH(added[0].h);
      }
      setItems((prev) => [...prev, ...added]);
      clearResults();
    },
    [clearResults, isEmpty]
  );

  const first = items[0];
  const preset = RESIZE_PRESETS.find((p) => p.id === presetId)!;
  const spec: ResizeSpec =
    mode === "percent"
      ? { kind: "percent", pct }
      : mode === "preset"
        ? { kind: "preset", w: preset.w, h: preset.h, fit }
        : { kind: "pixels", w, h, lock, lockBy, fit };
  const preview = first ? targetSize(spec, first.w, first.h) : null;
  const hasAlphaFormat = format === "image/png" || format === "image/webp" || (format === "keep" && items.some((i) => !/jpe?g$/i.test(i.file.type)));
  const showFit = mode === "preset" || (mode === "pixels" && !lock);

  const changeW = (v: number) => {
    setW(v);
    setLockBy("width");
    if (lock && first && v > 0) setH(Math.round((v * first.h) / first.w));
    clearResults();
  };
  const changeH = (v: number) => {
    setH(v);
    setLockBy("height");
    if (lock && first && v > 0) setW(Math.round((v * first.w) / first.h));
    clearResults();
  };

  const reset = () => {
    clearResults();
    setItems([]);
    setError(null);
  };

  const run = async () => {
    if (mode === "pixels" && (!(w >= 1) || !(h >= 1))) return setError("Enter a width and height of at least 1 pixel.");
    if (mode === "percent" && !(pct > 0)) return setError("Enter a percentage above 0.");
    clearResults();
    setBusy(true);
    setError(null);
    const opts: ResizeOptions = { spec, format, quality: quality / 100, background };
    const out: Done[] = [];
    const failed: string[] = [];
    const used = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      setProgress(i / items.length);
      await yieldToUi();
      const it = items[i];
      try {
        const r = await resizeImage(it.file, opts);
        const base = it.file.name.replace(/\.[^.]+$/, "");
        let name = `${base}-${r.width}x${r.height}.${ext(r.type)}`;
        for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}-${r.width}x${r.height}-${n}.${ext(r.type)}`;
        used.add(name.toLowerCase());
        const url = URL.createObjectURL(r.blob);
        urls.current.push(url);
        out.push({ ...r, id: it.id, name, url, inSize: it.file.size });
      } catch (e) {
        console.error(e);
        failed.push(`${it.file.name}: ${e instanceof Error ? e.message : "couldn't be resized."}`);
      }
    }
    setDone(out);
    if (out.length > 1) setZip({ name: "resized-images.zip", blob: await zipFiles(out.map((d) => ({ name: d.name, data: d.blob }))) });
    if (failed.length) setError(failed.join(" "));
    setProgress(1);
    setBusy(false);
  };

  return (
    <div>
      {items.length === 0 ? (
        <Dropzone accept={IMAGE_ACCEPT} multiple onFiles={addFiles} label="Drop JPG, PNG or WebP images here" hint="One photo or a batch: each gets the same treatment" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <p className="text-sm">
              <strong>{items.length}</strong> image{items.length > 1 ? "s" : ""}
              {first && (
                <span className="text-zinc-500">
                  {" "}
                  · first is {first.w}×{first.h}
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <label className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-black/15 dark:border-white/20 px-4 text-sm font-medium hover:border-red-400 hover:text-red-600 cursor-pointer">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add more
                <input
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files) addFiles(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                />
              </label>
              <button type="button" onClick={reset} className="min-h-10 px-3 text-sm text-zinc-500 hover:text-red-600">
                Clear all
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 grid gap-5">
            <Segmented
              label="Resize by"
              value={mode}
              onChange={(v) => {
                setMode(v);
                clearResults();
              }}
              options={[
                { value: "pixels", label: "Pixels", hint: "Exact width and height" },
                { value: "percent", label: "Percent", hint: "e.g. 50% of the original" },
                { value: "preset", label: "Preset", hint: "Instagram, YouTube, passport…" },
              ]}
            />

            {mode === "pixels" && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-32">
                  <Field label="Width (px)">
                    <input type="number" inputMode="numeric" min={1} value={w || ""} onChange={(e) => changeW(Number(e.target.value))} className={inputClass} />
                  </Field>
                </div>
                <button
                  type="button"
                  aria-pressed={lock}
                  aria-label={lock ? "Aspect ratio locked" : "Aspect ratio unlocked"}
                  title="Keep the shape (aspect ratio)"
                  onClick={() => {
                    setLock(!lock);
                    clearResults();
                  }}
                  className={`h-10 w-10 inline-flex items-center justify-center rounded-md border ${lock ? "border-red-500 text-red-600" : "border-black/15 dark:border-white/15 text-zinc-500"}`}
                >
                  {lock ? <Link2 className="h-4 w-4" aria-hidden="true" /> : <Link2Off className="h-4 w-4" aria-hidden="true" />}
                </button>
                <div className="w-32">
                  <Field label="Height (px)">
                    <input type="number" inputMode="numeric" min={1} value={h || ""} onChange={(e) => changeH(Number(e.target.value))} className={inputClass} />
                  </Field>
                </div>
                <p className="basis-full text-xs text-zinc-500 dark:text-zinc-400">
                  {lock
                    ? items.length > 1
                      ? `Shape kept: every image gets this ${lockBy}, the other side follows its own proportions.`
                      : "Shape kept: change one side and the other follows."
                    : "Unlocked: every image comes out exactly this size. Choose how it fits below."}
                </p>
              </div>
            )}

            {mode === "percent" && (
              <div className="grid gap-2">
                <div className="flex flex-wrap gap-2">
                  {[25, 50, 75, 150, 200].map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={pct === p}
                      onClick={() => {
                        setPct(p);
                        clearResults();
                      }}
                      className={pill(pct === p)}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
                <div className="w-32">
                  <Field label="Percent">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={1}
                      max={400}
                      value={pct || ""}
                      onChange={(e) => {
                        setPct(Number(e.target.value));
                        clearResults();
                      }}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            )}

            {mode === "preset" && (
              <Field label="Preset">
                <select
                  value={presetId}
                  onChange={(e) => {
                    setPresetId(e.target.value);
                    clearResults();
                  }}
                  className={`${inputClass} min-h-10`}
                >
                  {RESIZE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}: {p.w}×{p.h}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {showFit && (
              <div>
                <Segmented
                  label="Fit"
                  value={fit}
                  onChange={(v) => {
                    setFit(v);
                    clearResults();
                  }}
                  options={[
                    { value: "cover", label: "Crop to fill" },
                    { value: "contain", label: "Fit inside (pad)" },
                    { value: "stretch", label: "Stretch" },
                  ]}
                />
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{FIT_HINT[fit]}</p>
                {fit === "contain" && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <span>Padding colour</span>
                      <input
                        type="color"
                        value={background === "transparent" ? "#ffffff" : background}
                        onChange={(e) => {
                          setBackground(e.target.value);
                          clearResults();
                        }}
                        className="h-10 w-12 rounded border border-black/15 dark:border-white/15 bg-transparent"
                      />
                    </label>
                    {hasAlphaFormat && (
                      <label className="inline-flex min-h-10 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={background === "transparent"}
                          onChange={(e) => {
                            setBackground(e.target.checked ? "transparent" : "#ffffff");
                            clearResults();
                          }}
                          className="h-4 w-4 accent-red-600"
                        />
                        Transparent (PNG/WebP)
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="text-sm font-medium mb-1.5">Save as</legend>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["keep", "Same format"],
                      ["image/jpeg", "JPG"],
                      ["image/png", "PNG"],
                      ["image/webp", "WebP"],
                    ] as ["keep" | OutputType, string][]
                  ).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={format === v}
                      onClick={() => {
                        setFormat(v);
                        clearResults();
                      }}
                      className={pill(format === v)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </fieldset>
              {format !== "image/png" && (
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">JPG/WebP quality: {quality}%</span>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    value={quality}
                    onChange={(e) => {
                      setQuality(Number(e.target.value));
                      clearResults();
                    }}
                    className="w-full accent-red-600 h-10"
                  />
                </label>
              )}
            </div>
          </div>

          {preview && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {first.file.name}: {first.w}×{first.h} → <strong>{preview.w}×{preview.h}</strong>
              {(preview.w > first.w || preview.h > first.h) && mode !== "preset" && (
                <span className="text-amber-700 dark:text-amber-300"> (enlarging can&apos;t add detail; expect some softness)</span>
              )}
            </p>
          )}

          <div className="mt-5">
            <ActionButton onClick={run} busy={busy} disabled={!items.length}>
              {busy ? "Resizing…" : `Resize ${items.length} image${items.length > 1 ? "s" : ""}`}
            </ActionButton>
          </div>
          {busy && <Progress value={progress} label={`Resizing ${Math.min(items.length, Math.floor(progress * items.length) + 1)} of ${items.length}`} />}
        </>
      )}
      <ErrorNote>{error}</ErrorNote>
      {done.length > 0 && !busy && (
        <>
          <ResultPanel
            title={done.length > 1 ? `${done.length} images resized` : `Resized to ${done[0].width}×${done[0].height}`}
            files={zip ? [zip] : [{ blob: done[0].blob, name: done[0].name }]}
            originalSize={done.reduce((n, d) => n + d.inSize, 0)}
            note={done.some((d) => d.upscaled) ? "Some images were enlarged; they may look softer than the original." : undefined}
            onReset={reset}
            resetLabel="Start over"
          />
          <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {done.map((d) => (
              <li key={d.id} className="rounded-lg border border-black/10 dark:border-white/10 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.url}
                  alt={`Resized ${d.name}`}
                  className="aspect-square w-full object-contain rounded bg-[repeating-conic-gradient(#e4e4e7_0%_25%,#fff_0%_50%)] dark:bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] [background-size:12px_12px]"
                />
                <p className="mt-1 text-xs truncate" title={d.name}>{d.name}</p>
                <p className="text-xs text-zinc-500">
                  {d.inWidth}×{d.inHeight} → {d.width}×{d.height} · {formatBytes(d.blob.size)}
                </p>
                {done.length > 1 && (
                  <button
                    type="button"
                    onClick={() => downloadBlob(d.blob, d.name)}
                    className="mt-1 min-h-10 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-black/10 dark:border-white/15 text-sm hover:border-red-400 hover:text-red-600"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" /> Download
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
