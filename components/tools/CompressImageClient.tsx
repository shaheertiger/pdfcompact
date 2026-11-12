"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Plus, X } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, Field, Progress, ResultPanel, Segmented, inputClass, type ResultFile } from "@/components/ui/kit";
import { downloadBlob, formatBytes, zipFiles } from "@/lib/download";
import { nextId } from "@/lib/id";
import { IMAGE_ACCEPT, isBrowserImage, isHeic, yieldToUi } from "@/lib/image-utils";
import { compressImage, outputName, type CompressResult, type CompressSettings, type FormatChoice, type PngColors } from "@/lib/compress-image";
import CompareSlider from "./CompareSlider";

type Item = { id: string; file: File; url: string };
type Done = CompressResult & { id: string; name: string; outUrl: string; inUrl: string; inSize: number };

const PRESETS = [
  { kb: 20, label: "20 KB" },
  { kb: 50, label: "50 KB" },
  { kb: 100, label: "100 KB" },
  { kb: 200, label: "200 KB" },
  { kb: 500, label: "500 KB" },
  { kb: 1024, label: "1 MB" },
];

const pill = (on: boolean) =>
  `min-h-10 rounded-full border px-4 text-sm transition-colors ${
    on
      ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 font-medium"
      : "border-black/15 dark:border-white/15 hover:border-red-300"
  }`;

export default function CompressImageClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<"quality" | "target">("target");
  const [quality, setQuality] = useState(75);
  const [targetKb, setTargetKb] = useState(100);
  const [custom, setCustom] = useState(false);
  const [format, setFormat] = useState<FormatChoice>("keep");
  const [maxSide, setMaxSide] = useState(0);
  const [pngColors, setPngColors] = useState<PngColors>(256);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done[]>([]);
  const [zip, setZip] = useState<ResultFile | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const outUrls = useRef<string[]>([]);
  const inUrls = useRef<string[]>([]);

  useEffect(
    () => () => {
      outUrls.current.forEach((u) => URL.revokeObjectURL(u));
      inUrls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    []
  );

  const clearResults = () => {
    outUrls.current.forEach((u) => URL.revokeObjectURL(u));
    outUrls.current = [];
    setDone([]);
    setZip(null);
    setCompareId(null);
  };

  const addFiles = useCallback((files: File[]) => {
    setError(null);
    const heic = files.filter(isHeic).length;
    const ok = files.filter((f) => isBrowserImage(f));
    const bad = files.length - ok.length;
    if (bad) {
      setError(
        heic
          ? "HEIC photos can't be compressed directly here. Convert them with HEIC to JPG first, then compress the JPGs."
          : `${bad} file${bad > 1 ? "s" : ""} skipped: only JPG, PNG and WebP images can be compressed.`
      );
    }
    const added = ok.map((file) => {
      const url = URL.createObjectURL(file);
      inUrls.current.push(url);
      return { id: nextId("ci"), file, url };
    });
    setItems((prev) => [...prev, ...added]);
    clearResults();
  }, []);

  const reset = () => {
    clearResults();
    inUrls.current.forEach((u) => URL.revokeObjectURL(u));
    inUrls.current = [];
    setItems([]);
    setError(null);
  };

  const settingsChanged = () => clearResults();
  const hasPng = items.some((it) => /png$/i.test(it.file.type) || /\.png$/i.test(it.file.name));
  const pngOut = hasPng && format === "keep";
  const allPngOut = pngOut && items.every((it) => /png$/i.test(it.file.type) || /\.png$/i.test(it.file.name));

  const run = async () => {
    const targetBytes = Math.round(targetKb * 1024);
    if (mode === "target" && !(targetBytes >= 1024)) {
      setError("Enter a target of at least 1 KB.");
      return;
    }
    clearResults();
    setBusy(true);
    setError(null);
    const settings: CompressSettings = { mode, quality, targetBytes, format, maxSide, pngColors: mode === "quality" ? pngColors : 0 };
    const out: Done[] = [];
    const failed: string[] = [];
    const used = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      setProgress(i / items.length);
      setStatus(`Compressing ${it.file.name} (${i + 1} of ${items.length})…`);
      await yieldToUi();
      try {
        const r = await compressImage(it.file, settings);
        let name = r.keptOriginal ? it.file.name : outputName(it.file, r.type);
        for (let n = 2; used.has(name.toLowerCase()); n++) name = name.replace(/(\.\w+)$/, `-${n}$1`);
        used.add(name.toLowerCase());
        const outUrl = URL.createObjectURL(r.blob);
        outUrls.current.push(outUrl);
        out.push({ ...r, id: it.id, name, outUrl, inUrl: it.url, inSize: it.file.size });
        setDone([...out]);
      } catch (e) {
        console.error(e);
        failed.push(`${it.file.name}: ${e instanceof Error ? e.message : "couldn't be compressed."}`);
      }
    }
    if (out.length > 1) {
      setStatus("Building ZIP…");
      setZip({ name: "compressed-images.zip", blob: await zipFiles(out.map((d) => ({ name: d.name, data: d.blob }))) });
    }
    if (out.length) setCompareId(out[0].id);
    if (failed.length) setError(failed.join(" "));
    setProgress(1);
    setBusy(false);
    setStatus("");
  };

  const inTotal = done.reduce((n, d) => n + d.inSize, 0);
  const cmp = done.find((d) => d.id === compareId);
  const missed = done.filter((d) => !d.metTarget);

  return (
    <div>
      {items.length === 0 ? (
        <Dropzone accept={IMAGE_ACCEPT} multiple onFiles={addFiles} label="Drop JPG, PNG or WebP images here" hint="One photo or a whole batch" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm">
              <strong>{items.length}</strong> image{items.length > 1 ? "s" : ""} · {formatBytes(items.reduce((n, it) => n + it.file.size, 0))}
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
          {items.length > 1 && (
            <ul className="mb-4 flex flex-wrap gap-2">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 pl-3 text-xs max-w-full">
                  <span className="truncate max-w-[12rem]">{it.file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${it.file.name}`}
                    onClick={() => {
                      setItems((p) => p.filter((x) => x.id !== it.id));
                      clearResults();
                    }}
                    className="h-8 w-8 inline-flex items-center justify-center hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 grid gap-5">
            <Segmented
              label="How to compress"
              value={mode}
              onChange={(v) => {
                setMode(v);
                settingsChanged();
              }}
              options={[
                { value: "target", label: "Target size", hint: "Get each image under a size in KB" },
                { value: "quality", label: "Quality", hint: "Pick the quality yourself" },
              ]}
            />

            {mode === "target" ? (
              <fieldset>
                <legend className="text-sm font-medium mb-1.5">Make each image smaller than</legend>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.kb}
                      type="button"
                      aria-pressed={!custom && targetKb === p.kb}
                      onClick={() => {
                        setCustom(false);
                        setTargetKb(p.kb);
                        settingsChanged();
                      }}
                      className={pill(!custom && targetKb === p.kb)}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={custom}
                    onClick={() => {
                      setCustom(true);
                      settingsChanged();
                    }}
                    className={pill(custom)}
                  >
                    Custom
                  </button>
                </div>
                {custom && (
                  <div className="mt-3 max-w-[12rem]">
                    <Field label="Target size in KB">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={1}
                        step={1}
                        value={targetKb}
                        onChange={(e) => {
                          setTargetKb(Number(e.target.value));
                          settingsChanged();
                        }}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                )}
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  The tool keeps the highest quality that fits, and only shrinks the pixel size when quality alone can&apos;t get there.
                </p>
              </fieldset>
            ) : allPngOut ? null : (
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Quality: {quality}%</span>
                <input
                  type="range"
                  min={10}
                  max={95}
                  value={quality}
                  onChange={(e) => {
                    setQuality(Number(e.target.value));
                    settingsChanged();
                  }}
                  className="w-full accent-red-600 h-10"
                />
                <span className="text-xs text-zinc-500">70–80% is the usual sweet spot for photos: much smaller, hard to tell apart.</span>
              </label>
            )}

            {mode === "quality" && pngOut && (
              <fieldset>
                <legend className="text-sm font-medium mb-1.5">PNG colours</legend>
                <div className="flex flex-wrap gap-2">
                  {([256, 128, 64, 32, 0] as PngColors[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={pngColors === c}
                      onClick={() => {
                        setPngColors(c);
                        settingsChanged();
                      }}
                      className={pill(pngColors === c)}
                    >
                      {c ? `${c} colours` : "Lossless"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Fewer colours = smaller PNG, transparency kept. Great for screenshots and logos; photos show banding, so save photos as JPG or WebP instead.
                </p>
              </fieldset>
            )}

            <fieldset>
              <legend className="text-sm font-medium mb-1.5">Save as</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["keep", "Same format"],
                    ["image/jpeg", "JPG"],
                    ["image/webp", "WebP"],
                  ] as [FormatChoice, string][]
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={format === v}
                    onClick={() => {
                      setFormat(v);
                      settingsChanged();
                    }}
                    className={pill(format === v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {hasPng && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  PNG photos shrink most as JPG or WebP. WebP keeps transparency; JPG fills it with white.
                </p>
              )}
            </fieldset>

            <Field label="Also limit the pixel size (optional)">
              <select
                value={maxSide}
                onChange={(e) => {
                  setMaxSide(Number(e.target.value));
                  settingsChanged();
                }}
                className={`${inputClass} min-h-10 max-w-xs`}
              >
                <option value={0}>Keep original dimensions</option>
                <option value={3840}>Longest side 3840 px (4K)</option>
                <option value={2560}>Longest side 2560 px</option>
                <option value={1920}>Longest side 1920 px (Full HD)</option>
                <option value={1280}>Longest side 1280 px</option>
                <option value={800}>Longest side 800 px</option>
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <ActionButton onClick={run} busy={busy} disabled={!items.length}>
              {busy ? "Compressing…" : `Compress ${items.length} image${items.length > 1 ? "s" : ""}`}
            </ActionButton>
          </div>
          {busy && <Progress value={progress} label={status} />}
        </>
      )}

      <ErrorNote>{error}</ErrorNote>

      {done.length > 0 && !busy && (
        <>
          <ResultPanel
            title={done.length > 1 ? `${done.length} images compressed` : "Image compressed"}
            files={zip ? [zip] : [{ blob: done[0].blob, name: done[0].name }]}
            originalSize={inTotal}
            note={
              <>
                {missed.length > 0 && (
                  <span className="block text-amber-700 dark:text-amber-300">
                    {missed.length === 1 ? `${missed[0].name} couldn't` : `${missed.length} images couldn't`} get under {formatBytes(targetKb * 1024)} even at a very small size; the smallest version is included.
                  </span>
                )}
                <span className="block">Camera details and GPS location are removed from re-saved images.</span>
              </>
            }
            onReset={reset}
            resetLabel="Start over"
          />

          <ul className="mt-4 grid gap-2">
            {done.map((d) => {
              const saved = 1 - d.blob.size / d.inSize;
              return (
                <li key={d.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3 flex flex-wrap items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.outUrl} alt={`Compressed ${d.name}`} className="h-12 w-12 rounded object-cover bg-zinc-100 dark:bg-zinc-800" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium" title={d.name}>{d.name}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {formatBytes(d.inSize)} → <strong>{formatBytes(d.blob.size)}</strong>{" "}
                      <span className={saved > 0 ? "text-emerald-700 dark:text-emerald-400" : ""}>
                        ({saved > 0 ? `−${Math.round(saved * 100)}%` : "no smaller"})
                      </span>{" "}
                      · {d.width}×{d.height} · {d.detail}
                    </p>
                    {d.notes.length > 0 && <p className="text-xs text-zinc-500">{d.notes.join(" ")}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-pressed={compareId === d.id}
                      onClick={() => setCompareId(d.id)}
                      className={pill(compareId === d.id)}
                    >
                      Compare
                    </button>
                    {done.length > 1 && (
                      <button
                        type="button"
                        onClick={() => downloadBlob(d.blob, d.name)}
                        aria-label={`Download ${d.name}`}
                        className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-full border border-black/15 dark:border-white/15 hover:border-red-400 hover:text-red-600"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {cmp && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">
                Before and after: {cmp.name} <span className="font-normal text-zinc-500">(drag the slider)</span>
              </p>
              <CompareSlider key={cmp.id} beforeUrl={cmp.inUrl} afterUrl={cmp.outUrl} aspect={cmp.width / cmp.height} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
