"use client";

import { useCallback, useState } from "react";
import { FileText, Plus, X, Archive, ImageOff } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import {
  ActionButton,
  ErrorNote,
  InfoNote,
  Progress,
  ResultPanel,
  SecondaryButton,
  Segmented,
  inputClass,
} from "@/components/ui/kit";
import { baseName, downloadBlob, formatBytes, isPdf, pdfBlob, zipFiles } from "@/lib/download";
import { nextId } from "@/lib/id";
import { useStrings } from "@/lib/i18n";
import type { Level, PdfCompressor, ProgressFn, RunStats, Stage } from "@/lib/compress";

type Mode = "level" | "target";
type Preset = "200" | "500" | "1024" | "2048" | "custom";

type Outcome =
  | { kind: "smaller"; stats: RunStats }
  | { kind: "already" }
  | { kind: "underTarget" }
  | { kind: "reached"; stats: RunStats }
  | { kind: "notReached"; stats: RunStats; smallest: number; rasterSize?: number }
  | { kind: "rasterized"; reached: boolean; dpi: number };

type Item = {
  id: string;
  file: File;
  result?: { blob: Blob; name: string; outcome: Outcome; ms: number; target?: number };
  error?: string;
};

const strings = {
  en: {
    modeLegend: "How do you want to compress?",
    modeLevel: "Choose a level",
    modeTarget: "Compress to a specific size",
    suffix: "compressed",
    zipName: "compressed-pdfs.zip",
    levelLegend: "Compression level",
    levels: {
      light: { label: "Light", hint: "Best for printing and archiving. Images stay sharp (200 DPI)." },
      recommended: { label: "Recommended", hint: "Best for email and sharing. 150 DPI, looks the same on screen." },
      strong: { label: "Strong", hint: "Best for strict upload limits. 100 DPI, photos look softer." },
    },
    targetLegend: "Target size for each file",
    custom: "Custom",
    customLabel: "Custom target",
    unit: "Unit",
    grayscale: "Convert images to grayscale",
    grayscaleHint: "Photos and scans become black and white. Text and drawings keep their colours.",
    compress: (n: number) => (n > 1 ? `Compress ${n} PDFs` : "Compress PDF"),
    addMore: "Add more PDFs",
    remove: (name: string) => `Remove ${name}`,
    notPdf: (names: string) => `Skipped (not a PDF): ${names}`,
    badTarget: "Enter a target size of at least 20 KB.",
    stage: (s: Stage, cur: number, total: number) =>
      s === "load"
        ? "Opening the file"
        : s === "scan"
          ? `Reading page ${cur} of ${total}`
          : s === "image"
            ? `Image ${cur} of ${total}`
            : s === "page"
              ? `Rendering page ${cur} of ${total}`
              : "Saving",
    fileOf: (i: number, n: number) => `File ${i} of ${n}`,
    attempt: (n: number) => `try ${n}`,
    took: (s: string) => `Took ${s} s.`,
    images: (st: RunStats) =>
      st.images === 0
        ? "This file has no images, so only its structure could be cleaned up."
        : `${st.recompressed} of ${st.images} images recompressed${st.unsupported ? ` (${st.unsupported} left as they were: masks or formats we don't re-encode safely)` : ""}.`,
    already:
      "Already optimized: compressing didn't make this file any smaller, so this is your original, unchanged. Try Strong, or a target size.",
    underTarget: (t: string) => `Already under ${t}, so this is your original file, unchanged.`,
    reached: (t: string) => `Under your ${t} target.`,
    notReached: (t: string, min: string) =>
      `Couldn't get under ${t} while keeping the text as text. The smallest we reached is ${min}. What's left is text, fonts, drawings or images in formats we don't re-encode (such as CMYK), which this mode can't shrink further.`,
    rasterOffer: (t: string) => `Rasterize pages to reach ${t}`,
    rasterWarn:
      "Last resort: this turns every page into a picture of the page. Text will no longer be selectable or searchable, links stop working, and small print can blur.",
    rasterized: (dpi: number) =>
      `Pages were rasterized at ${dpi} DPI. Text is now part of an image: it can't be selected, searched or copied.`,
    rasterMissed: (t: string) => `Even as images, the pages don't fit in ${t}. This is the smallest version. Try Split PDF by Size instead.`,
    rasterBigger: (size: string) =>
      `Turning the pages into images made the file bigger (${size}), so we kept the version above. To get under the limit, split the PDF into parts with Split PDF by Size.`,
    zip: "Download all as ZIP",
    zipping: "Zipping…",
    startOver: "Start over",
    another: "Compress another PDF",
    total: (a: string, b: string) => `All files: ${a} → ${b}`,
    errEncrypted:
      "This PDF needs a password to open, so it can't be read or compressed. Remove the password first, then try again.",
    errUnreadable: "Couldn't read this PDF. It may be damaged or not a real PDF. Try re-saving it with Print to PDF.",
    errMemory: "Your browser ran out of memory on this file. Try a laptop, close other tabs, or split the file first.",
  },
  es: {
    modeLegend: "¿Cómo quieres comprimir?",
    modeLevel: "Elegir un nivel",
    modeTarget: "Comprimir a un tamaño exacto",
    suffix: "comprimido",
    zipName: "pdf-comprimidos.zip",
    levelLegend: "Nivel de compresión",
    levels: {
      light: { label: "Ligera", hint: "Ideal para imprimir y archivar. Imágenes nítidas (200 DPI)." },
      recommended: { label: "Recomendada", hint: "Ideal para correo y compartir. 150 DPI, se ve igual en pantalla." },
      strong: { label: "Fuerte", hint: "Ideal para límites estrictos. 100 DPI, las fotos se ven más suaves." },
    },
    targetLegend: "Tamaño objetivo de cada archivo",
    custom: "Otro",
    customLabel: "Tamaño personalizado",
    unit: "Unidad",
    grayscale: "Convertir imágenes a escala de grises",
    grayscaleHint: "Fotos y escaneos pasan a blanco y negro. El texto y los dibujos conservan su color.",
    compress: (n: number) => (n > 1 ? `Comprimir ${n} PDF` : "Comprimir PDF"),
    addMore: "Agregar más PDF",
    remove: (name: string) => `Quitar ${name}`,
    notPdf: (names: string) => `Omitidos (no son PDF): ${names}`,
    badTarget: "Escribe un tamaño objetivo de al menos 20 KB.",
    stage: (s: Stage, cur: number, total: number) =>
      s === "load"
        ? "Abriendo el archivo"
        : s === "scan"
          ? `Leyendo la página ${cur} de ${total}`
          : s === "image"
            ? `Imagen ${cur} de ${total}`
            : s === "page"
              ? `Convirtiendo la página ${cur} de ${total}`
              : "Guardando",
    fileOf: (i: number, n: number) => `Archivo ${i} de ${n}`,
    attempt: (n: number) => `intento ${n}`,
    took: (s: string) => `Tardó ${s} s.`,
    images: (st: RunStats) =>
      st.images === 0
        ? "Este archivo no tiene imágenes, así que solo se pudo limpiar su estructura."
        : `Se recomprimieron ${st.recompressed} de ${st.images} imágenes${st.unsupported ? ` (${st.unsupported} quedaron igual: máscaras o formatos que no recodificamos con seguridad)` : ""}.`,
    already:
      "Ya estaba optimizado: comprimirlo no lo hizo más pequeño, así que este es tu archivo original, sin cambios. Prueba el nivel Fuerte o un tamaño exacto.",
    underTarget: (t: string) => `Ya pesa menos de ${t}, así que este es tu archivo original, sin cambios.`,
    reached: (t: string) => `Por debajo de tu objetivo de ${t}.`,
    notReached: (t: string, min: string) =>
      `No se pudo bajar de ${t} sin convertir el texto en imagen. Lo mínimo que logramos es ${min}. Lo que queda es texto, fuentes, dibujos o imágenes en formatos que no recodificamos (como CMYK), y este modo no puede reducirlo más.`,
    rasterOffer: (t: string) => `Convertir páginas en imagen para llegar a ${t}`,
    rasterWarn:
      "Último recurso: cada página se convierte en una imagen de la página. El texto ya no se podrá seleccionar ni buscar, los enlaces dejan de funcionar y la letra pequeña puede verse borrosa.",
    rasterized: (dpi: number) =>
      `Las páginas se convirtieron en imagen a ${dpi} DPI. El texto ahora es parte de una imagen: no se puede seleccionar, buscar ni copiar.`,
    rasterMissed: (t: string) => `Ni como imágenes caben las páginas en ${t}. Esta es la versión más pequeña. Prueba a dividir el PDF.`,
    rasterBigger: (size: string) =>
      `Convertir las páginas en imagen hizo el archivo más grande (${size}), así que conservamos la versión de arriba. Para bajar del límite, divide el PDF en partes.`,
    zip: "Descargar todo en ZIP",
    zipping: "Creando ZIP…",
    startOver: "Empezar de nuevo",
    another: "Comprimir otro PDF",
    total: (a: string, b: string) => `Todos los archivos: ${a} → ${b}`,
    errEncrypted:
      "Este PDF necesita una contraseña para abrirse, así que no se puede leer ni comprimir. Quita primero la contraseña y vuelve a intentarlo.",
    errUnreadable: "No se pudo leer este PDF. Puede estar dañado o no ser un PDF real. Prueba a guardarlo de nuevo con Imprimir a PDF.",
    errMemory: "Tu navegador se quedó sin memoria con este archivo. Prueba en una computadora, cierra otras pestañas o divide el archivo primero.",
  },
};

const PRESETS: { value: Preset; label: string }[] = [
  { value: "200", label: "200 KB" },
  { value: "500", label: "500 KB" },
  { value: "1024", label: "1 MB" },
  { value: "2048", label: "2 MB" },
];


export default function CompressPdfClient() {
  const t = useStrings(strings);
  const outName = (file: File) => `${baseName(file.name)}-${t.suffix}.pdf`;
  const [items, setItems] = useState<Item[]>([]);
  const [mode, setMode] = useState<Mode>("level");
  const [level, setLevel] = useState<Level>("recommended");
  const [preset, setPreset] = useState<Preset>("1024");
  const [customValue, setCustomValue] = useState("750");
  const [customUnit, setCustomUnit] = useState<"KB" | "MB">("KB");
  const [grayscale, setGrayscale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);

  const addFiles = useCallback(
    (files: File[]) => {
      const pdfs = files.filter(isPdf);
      const rejected = files.filter((f) => !isPdf(f));
      setError(rejected.length ? t.notPdf(rejected.map((f) => f.name).join(", ")) : null);
      setItems((prev) => [...prev, ...pdfs.map((file) => ({ id: nextId("cmp"), file }))]);
    },
    [t]
  );

  const targetBytes = (): number | null => {
    if (preset !== "custom") return parseInt(preset, 10) * 1024;
    const v = parseFloat(customValue.replace(",", "."));
    if (!Number.isFinite(v)) return null;
    const bytes = Math.round(v * (customUnit === "MB" ? 1024 * 1024 : 1024));
    return bytes >= 20 * 1024 ? bytes : null;
  };

  const friendly = (e: unknown): string => {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "encrypted") return t.errEncrypted;
    if (e instanceof RangeError || (e instanceof Error && /memory|allocation/i.test(e.message))) return t.errMemory;
    if (e instanceof Error && /password/i.test(e.message)) return t.errEncrypted;
    return t.errUnreadable;
  };

  const run = async () => {
    const target = mode === "target" ? targetBytes() : null;
    if (mode === "target" && !target) {
      setError(t.badTarget);
      return;
    }
    setError(null);
    setBusy(true);
    const lib = await import("@/lib/compress");
    const n = items.length;
    const next: Item[] = items.map((it) => ({ ...it, result: undefined, error: undefined }));
    setItems(next);
    for (let i = 0; i < n; i++) {
      const it = next[i];
      const prefix = n > 1 ? `${t.fileOf(i + 1, n)} · ` : "";
      let attempt = 0;
      const onProgress: ProgressFn = (stage, cur, total) => {
        const inner =
          stage === "scan" ? 0.1 * (cur / total) : stage === "image" ? 0.1 + 0.8 * (cur / total) : stage === "save" ? 0.95 : 0;
        const att = attempt > 1 ? ` (${t.attempt(attempt)})` : "";
        setProgress({ value: (i + inner) / n, label: prefix + t.stage(stage, cur, total) + att });
      };
      onProgress("load", 0, 1);
      await new Promise((r) => setTimeout(r));
      const started = performance.now();
      let compressor: PdfCompressor | null = null;
      try {
        const bytes = new Uint8Array(await it.file.arrayBuffer());
        const original = it.file.size;
        if (target && original <= target) {
          next[i] = {
            ...it,
            result: { blob: it.file, name: it.file.name, outcome: { kind: "underTarget" }, ms: 0, target },
          };
        } else {
          compressor = await lib.PdfCompressor.open(bytes, onProgress);
          let out: Uint8Array;
          let outcome: Outcome;
          if (target) {
            const r = await lib.compressToTarget(compressor, target, grayscale, onProgress, (a) => (attempt = a));
            out = r.bytes;
            outcome = r.reached
              ? { kind: "reached", stats: r.stats }
              : { kind: "notReached", stats: r.stats, smallest: Math.min(r.bytes.length, original) };
          } else {
            const r = await compressor.run({ ...lib.LEVELS[level], grayscale }, onProgress);
            out = r.bytes;
            outcome = { kind: "smaller", stats: r.stats };
          }
          const ms = performance.now() - started;
          // Never hand back a bigger file.
          if (out.length >= original) {
            const keep: Outcome = outcome.kind === "notReached" ? outcome : { kind: "already" };
            next[i] = { ...it, result: { blob: it.file, name: it.file.name, outcome: keep, ms, target: target ?? undefined } };
          } else {
            next[i] = { ...it, result: { blob: pdfBlob(out), name: outName(it.file), outcome, ms, target: target ?? undefined } };
          }
        }
      } catch (e) {
        next[i] = { ...it, error: friendly(e) };
      } finally {
        compressor?.dispose();
      }
      setItems([...next]);
    }
    setProgress(null);
    setBusy(false);
  };

  const rasterize = async (id: string) => {
    const idx = items.findIndex((x) => x.id === id);
    const it = items[idx];
    const target = it?.result?.target;
    if (!it || !target) return;
    setBusy(true);
    setError(null);
    let attempt = 0;
    const onProgress: ProgressFn = (stage, cur, total) =>
      setProgress({
        value: cur / total,
        label: t.stage(stage, cur, total) + (attempt > 1 ? ` (${t.attempt(attempt)})` : ""),
      });
    try {
      const { rasterizeToTarget } = await import("@/lib/compress");
      const started = performance.now();
      const bytes = new Uint8Array(await it.file.arrayBuffer());
      const r = await rasterizeToTarget(bytes, target, grayscale, onProgress, (a) => (attempt = a));
      const ms = performance.now() - started;
      const prev = it.result!;
      const result =
        r.bytes.length < Math.min(it.file.size, prev.blob.size)
          ? { blob: pdfBlob(r.bytes), name: outName(it.file), outcome: { kind: "rasterized", reached: r.reached, dpi: r.dpi } as Outcome, ms, target }
          : prev.outcome.kind === "notReached"
            ? { ...prev, outcome: { ...prev.outcome, rasterSize: r.bytes.length } }
            : prev;
      setItems((list) => list.map((x) => (x.id === id ? { ...x, result } : x)));
    } catch (e) {
      setItems((list) => list.map((x) => (x.id === id ? { ...x, error: friendly(e) } : x)));
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  const reset = () => {
    setItems([]);
    setError(null);
    setProgress(null);
  };

  const downloadZip = async () => {
    setZipping(true);
    try {
      const done = items.filter((x) => x.result);
      const used = new Set<string>();
      const files = done.map((x) => {
        let name = x.result!.name;
        for (let k = 2; used.has(name); k++) name = x.result!.name.replace(/\.pdf$/i, `-${k}.pdf`);
        used.add(name);
        return { name, data: x.result!.blob };
      });
      downloadBlob(await zipFiles(files), t.zipName);
    } finally {
      setZipping(false);
    }
  };

  const note = (it: Item) => {
    const r = it.result!;
    const tgt = r.target ? formatBytes(r.target) : "";
    const o = r.outcome;
    const lines: string[] = [];
    switch (o.kind) {
      case "smaller":
        lines.push(t.images(o.stats));
        break;
      case "already":
        lines.push(t.already);
        break;
      case "underTarget":
        lines.push(t.underTarget(tgt));
        break;
      case "reached":
        lines.push(t.reached(tgt), t.images(o.stats));
        break;
      case "notReached":
        lines.push(t.notReached(tgt, formatBytes(o.smallest)));
        if (o.rasterSize) lines.push(t.rasterBigger(formatBytes(o.rasterSize)));
        break;
      case "rasterized":
        lines.push(t.rasterized(o.dpi));
        if (!o.reached) lines.push(t.rasterMissed(tgt));
        break;
    }
    if (r.ms > 0) lines.push(t.took((r.ms / 1000).toFixed(1)));
    return (
      <>
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
        {o.kind === "notReached" && !o.rasterSize && (
          <div className="mt-3 rounded-lg border border-amber-300/70 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
            <p className="flex gap-2 text-amber-900 dark:text-amber-200">
              <ImageOff className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{t.rasterWarn}</span>
            </p>
            <div className="mt-2">
              <SecondaryButton onClick={() => rasterize(it.id)} disabled={busy}>
                {t.rasterOffer(tgt)}
              </SecondaryButton>
            </div>
          </div>
        )}
      </>
    );
  };

  const done = items.filter((x) => x.result);
  const totalIn = done.reduce((s, x) => s + x.file.size, 0);
  const totalOut = done.reduce((s, x) => s + x.result!.blob.size, 0);

  if (items.length === 0) {
    return (
      <>
        <Dropzone multiple onFiles={addFiles} />
        <ErrorNote>{error}</ErrorNote>
      </>
    );
  }

  return (
    <div>
      <ul className="grid gap-2 mb-4">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50"
          >
            <FileText className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
            <span className="text-sm truncate flex-1 min-w-0">
              <span className="font-medium">{it.file.name}</span>
              <span className="text-zinc-500"> · {formatBytes(it.file.size)}</span>
            </span>
            <button
              type="button"
              onClick={() => setItems((list) => list.filter((x) => x.id !== it.id))}
              disabled={busy}
              aria-label={t.remove(it.file.name)}
              className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-full text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-40"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <label
        className={`mb-5 inline-flex items-center gap-2 rounded-full border border-dashed border-black/20 dark:border-white/20 px-4 py-2 min-h-10 text-sm cursor-pointer hover:border-red-400 hover:text-red-600 ${busy ? "pointer-events-none opacity-40" : ""}`}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t.addMore}
        <input
          type="file"
          accept="application/pdf"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) addFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </label>

      <div className="grid gap-5">
        <fieldset>
          <legend className="sr-only">{t.modeLegend}</legend>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1">
            {(
              [
                ["level", t.modeLevel],
                ["target", t.modeTarget],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={`min-h-10 rounded-lg px-2 py-2 text-sm font-medium leading-tight transition-colors ${
                  mode === value
                    ? "bg-white dark:bg-zinc-900 text-red-700 dark:text-red-300 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-red-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {mode === "level" ? (
          <Segmented<Level>
            label={t.levelLegend}
            value={level}
            onChange={setLevel}
            options={(["light", "recommended", "strong"] as const).map((l) => ({
              value: l,
              label: t.levels[l].label,
              hint: t.levels[l].hint,
            }))}
          />
        ) : (
          <fieldset>
            <legend className="text-sm font-medium mb-2">{t.targetLegend}</legend>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[...PRESETS, { value: "custom" as Preset, label: t.custom }].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={preset === p.value}
                  onClick={() => setPreset(p.value)}
                  className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    preset === p.value
                      ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300"
                      : "border-black/10 dark:border-white/10 hover:border-red-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="mt-3 flex gap-2 items-end">
                <label className="grid gap-1 text-sm flex-1 max-w-[12rem]">
                  <span className="font-medium">{t.customLabel}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    className={`${inputClass} min-h-10`}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="sr-only">{t.unit}</span>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as "KB" | "MB")}
                    className={`${inputClass} min-h-10`}
                  >
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                  </select>
                </label>
              </div>
            )}
          </fieldset>
        )}

        <label className="flex items-start gap-3 text-sm cursor-pointer min-h-10">
          <input
            type="checkbox"
            checked={grayscale}
            onChange={(e) => setGrayscale(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-red-600 shrink-0"
          />
          <span>
            <span className="font-medium block">{t.grayscale}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{t.grayscaleHint}</span>
          </span>
        </label>

        <div>
          <ActionButton onClick={run} busy={busy} disabled={items.length === 0}>
            {t.compress(items.length)}
          </ActionButton>
        </div>
      </div>

      {progress && <Progress value={progress.value} label={progress.label} />}
      <ErrorNote>{error}</ErrorNote>

      {items.map((it) =>
        it.error ? (
          <div key={it.id} data-file={it.file.name} data-outcome="error">
            <ErrorNote>
              <strong>{it.file.name}:</strong> {it.error}
            </ErrorNote>
          </div>
        ) : it.result ? (
          <div
            key={it.id}
            data-file={it.file.name}
            data-outcome={it.result.outcome.kind}
            data-size={it.result.blob.size}
            data-ms={Math.round(it.result.ms)}
          >
            <ResultPanel
              title={it.file.name}
              files={[{ blob: it.result.blob, name: it.result.name }]}
              originalSize={it.file.size}
              note={note(it)}
              onReset={items.length === 1 && !busy ? reset : undefined}
              resetLabel={t.another}
            />
          </div>
        ) : null
      )}

      {items.length > 1 && done.length > 0 && !busy && (
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 sm:flex-1">
            {t.total(formatBytes(totalIn), formatBytes(totalOut))}
          </p>
          <button
            type="button"
            onClick={downloadZip}
            disabled={zipping}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
            {zipping ? t.zipping : t.zip}
          </button>
          <SecondaryButton onClick={reset}>{t.startOver}</SecondaryButton>
        </div>
      )}
      {items.length > 1 && done.length === 0 && !busy && (
        <InfoNote>
          <button type="button" onClick={reset} className="underline hover:text-red-600">
            {t.startOver}
          </button>
        </InfoNote>
      )}
    </div>
  );
}
