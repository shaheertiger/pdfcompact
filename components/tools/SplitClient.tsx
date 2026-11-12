"use client";

import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
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
import { baseName, downloadBlob, formatBytes, isPdf, pdfBlob, zipFiles } from "@/lib/download";
import { useLocale, useStrings } from "@/lib/i18n";
import { PdfLoadError, loadEditable, pagesToPdf, parseRanges, tick, type EditDoc, type PageRange } from "@/lib/page-tools";

type Mode = "ranges" | "every" | "each";

const strings = {
  en: {
    loading: "Reading the PDF…",
    detail: (pages: number, size: string) => `${pages} ${pages === 1 ? "page" : "pages"} · ${size}`,
    modeLabel: "How do you want to split it?",
    modes: {
      ranges: { label: "Custom ranges", hint: "One file per range" },
      every: { label: "Every N pages", hint: "Equal chunks" },
      each: { label: "Every page", hint: "One file per page" },
    },
    rangesLabel: "Page ranges",
    rangesHint: "Separate ranges with commas. 8- means page 8 to the end. Each range becomes its own file.",
    rangesPlaceholder: "e.g. 1-3, 4-8, 9-",
    everyLabel: "Pages per file",
    everyHint: (n: number, last: number) =>
      last ? `The last file gets the remaining ${last} ${last === 1 ? "page" : "pages"}.` : `Every file gets ${n} pages.`,
    preview: (n: number) => `This makes ${n} ${n === 1 ? "file" : "files"}:`,
    more: (n: number) => `+ ${n} more`,
    range: (r: PageRange) => (r.start === r.end ? `p. ${r.start}` : `pp. ${r.start}–${r.end}`),
    pages: (n: number) => (n === 1 ? "1 page" : `${n} pages`),
    split: (n: number) => (n === 0 ? "Split PDF" : n === 1 ? "Save 1 file" : `Split into ${n} files`),
    working: (i: number, n: number) => `Saving file ${i} of ${n}`,
    zipping: "Packing the ZIP…",
    oneFile: "Only one file: that's the same as the original. Pick ranges or a smaller number.",
    fileName: (base: string, r: PageRange) =>
      r.start === r.end ? `${base}-page-${r.start}.pdf` : `${base}-pages-${r.start}-${r.end}.pdf`,
    zipName: (base: string) => `${base}-split.zip`,
    resultTitle: (n: number) => (n === 1 ? "Your file is ready" : `Split into ${n} files`),
    zipNote: "Download the ZIP for all parts, or save single parts from the list.",
    partsHeading: "Parts",
    download: (name: string) => `Download ${name}`,
    moreInZip: (n: number) => `…and ${n} more in the ZIP.`,
    failed: "Couldn't split this PDF. Try re-saving it with Print to PDF, then split again.",
    notPdf: "That isn't a PDF. Choose a .pdf file.",
    again: "Split another PDF",
  },
  es: {
    loading: "Leyendo el PDF…",
    detail: (pages: number, size: string) => `${pages} ${pages === 1 ? "página" : "páginas"} · ${size}`,
    modeLabel: "¿Cómo quieres dividirlo?",
    modes: {
      ranges: { label: "Rangos propios", hint: "Un archivo por rango" },
      every: { label: "Cada N páginas", hint: "Partes iguales" },
      each: { label: "Cada página", hint: "Un archivo por página" },
    },
    rangesLabel: "Rangos de páginas",
    rangesHint: "Separa los rangos con comas. 8- significa de la página 8 al final. Cada rango será un archivo.",
    rangesPlaceholder: "p. ej. 1-3, 4-8, 9-",
    everyLabel: "Páginas por archivo",
    everyHint: (n: number, last: number) =>
      last
        ? `El último archivo lleva las ${last} ${last === 1 ? "página restante" : "páginas restantes"}.`
        : `Cada archivo lleva ${n} páginas.`,
    preview: (n: number) => `Se crearán ${n} ${n === 1 ? "archivo" : "archivos"}:`,
    more: (n: number) => `+ ${n} más`,
    range: (r: PageRange) => (r.start === r.end ? `pág. ${r.start}` : `págs. ${r.start}–${r.end}`),
    pages: (n: number) => (n === 1 ? "1 página" : `${n} páginas`),
    split: (n: number) => (n === 0 ? "Dividir PDF" : n === 1 ? "Guardar 1 archivo" : `Dividir en ${n} archivos`),
    working: (i: number, n: number) => `Guardando archivo ${i} de ${n}`,
    zipping: "Creando el ZIP…",
    oneFile: "Solo saldría un archivo, igual al original. Elige rangos o un número menor.",
    fileName: (base: string, r: PageRange) =>
      r.start === r.end ? `${base}-pagina-${r.start}.pdf` : `${base}-paginas-${r.start}-${r.end}.pdf`,
    zipName: (base: string) => `${base}-dividido.zip`,
    resultTitle: (n: number) => (n === 1 ? "Tu archivo está listo" : `Dividido en ${n} archivos`),
    zipNote: "Descarga el ZIP con todas las partes o guarda partes sueltas desde la lista.",
    partsHeading: "Partes",
    download: (name: string) => `Descargar ${name}`,
    moreInZip: (n: number) => `…y ${n} más en el ZIP.`,
    failed: "No se pudo dividir este PDF. Vuelve a guardarlo con Imprimir a PDF y prueba otra vez.",
    notPdf: "Eso no es un PDF. Elige un archivo .pdf.",
    again: "Dividir otro PDF",
  },
};

type Part = { range: PageRange; name: string; blob: Blob };

export default function SplitClient() {
  const t = useStrings(strings);
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("ranges");
  const [rangesText, setRangesText] = useState("");
  const [every, setEvery] = useState("2");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ files: ResultFile[]; parts: Part[] } | null>(null);
  const docRef = useRef<EditDoc | null>(null);

  const onFiles = async (files: File[]) => {
    const f = files[0];
    setError(null);
    setResult(null);
    if (!isPdf(f)) return setError(t.notPdf);
    setLoading(true);
    try {
      const doc = await loadEditable(await f.arrayBuffer(), locale);
      docRef.current = doc;
      setPageCount(doc.getPageCount());
      setFile(f);
      setRangesText("");
      if (doc.getPageCount() <= 2) setMode("each");
    } catch (e) {
      setError(e instanceof PdfLoadError ? e.message : t.failed);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    docRef.current = null;
    setFile(null);
    setPageCount(0);
    setResult(null);
    setError(null);
    setProgress(null);
  };

  // Work out the parts from the current options; errors show inline.
  const plan = useMemo((): { ranges: PageRange[]; error?: string } => {
    if (!pageCount) return { ranges: [] };
    if (mode === "each") {
      return { ranges: Array.from({ length: pageCount }, (_, i) => ({ start: i + 1, end: i + 1 })) };
    }
    if (mode === "every") {
      const n = Math.floor(Number(every));
      if (!n || n < 1) return { ranges: [] };
      const ranges: PageRange[] = [];
      for (let s = 1; s <= pageCount; s += n) ranges.push({ start: s, end: Math.min(pageCount, s + n - 1) });
      return { ranges };
    }
    if (!rangesText.trim()) return { ranges: [] };
    try {
      return { ranges: parseRanges(rangesText, pageCount, locale) };
    } catch (e) {
      return { ranges: [], error: e instanceof Error ? e.message : String(e) };
    }
  }, [pageCount, mode, every, rangesText, locale]);

  const sameAsOriginal = plan.ranges.length === 1 && plan.ranges[0].start === 1 && plan.ranges[0].end === pageCount;

  const handleSplit = async () => {
    const doc = docRef.current;
    if (!doc || !file || plan.ranges.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const base = baseName(file.name);
    const used = new Map<string, number>();
    const parts: Part[] = [];
    try {
      const n = plan.ranges.length;
      for (let i = 0; i < n; i++) {
        const range = plan.ranges[i];
        setProgress({ value: i / (n + 1), label: t.working(i + 1, n) });
        await tick();
        const indices = Array.from({ length: range.end - range.start + 1 }, (_, k) => range.start - 1 + k);
        const bytes = await pagesToPdf(doc, indices);
        let name = t.fileName(base, range);
        const seen = used.get(name) ?? 0;
        used.set(name, seen + 1);
        if (seen) name = name.replace(/\.pdf$/, `-${seen + 1}.pdf`);
        parts.push({ range, name, blob: pdfBlob(bytes) });
      }
      let files: ResultFile[];
      if (parts.length === 1) {
        files = [{ blob: parts[0].blob, name: parts[0].name }];
      } else {
        setProgress({ value: n / (n + 1), label: t.zipping });
        await tick();
        const zip = await zipFiles(parts.map((p) => ({ name: p.name, data: p.blob })));
        files = [{ blob: zip, name: t.zipName(base) }];
      }
      setResult({ files, parts });
    } catch (e) {
      console.error(e);
      setError(t.failed);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (!file) {
    return (
      <div>
        <Dropzone onFiles={onFiles} />
        {loading && <InfoNote>{t.loading}</InfoNote>}
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  const everyN = Math.floor(Number(every)) || 0;
  const shown = plan.ranges.slice(0, 12);

  return (
    <div>
      <FileBar name={file.name} detail={t.detail(pageCount, formatBytes(file.size))} onReset={reset} />

      <Segmented<Mode>
        label={t.modeLabel}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setResult(null);
        }}
        options={(["ranges", "every", "each"] as const).map((m) => ({ value: m, ...t.modes[m] }))}
      />

      <div className="mt-4">
        {mode === "ranges" && (
          <Field label={t.rangesLabel} hint={t.rangesHint}>
            <input
              className={`${inputClass} text-base sm:text-sm`}
              value={rangesText}
              inputMode="text"
              autoComplete="off"
              placeholder={t.rangesPlaceholder}
              onChange={(e) => {
                setRangesText(e.target.value);
                setResult(null);
              }}
            />
          </Field>
        )}
        {mode === "every" && (
          <Field label={t.everyLabel} hint={everyN > 0 ? t.everyHint(everyN, pageCount % everyN) : undefined}>
            <input
              type="number"
              min={1}
              max={pageCount}
              className={`${inputClass} text-base sm:text-sm w-32`}
              value={every}
              onChange={(e) => {
                setEvery(e.target.value);
                setResult(null);
              }}
            />
          </Field>
        )}
      </div>

      {plan.error && <ErrorNote>{plan.error}</ErrorNote>}

      {plan.ranges.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">{t.preview(plan.ranges.length)}</p>
          <ul className="flex flex-wrap gap-1.5">
            {shown.map((r, i) => (
              <li
                key={i}
                className="rounded-full border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50 px-2.5 py-1 text-xs"
              >
                {t.range(r)} <span className="text-zinc-500">· {t.pages(r.end - r.start + 1)}</span>
              </li>
            ))}
            {plan.ranges.length > shown.length && (
              <li className="px-2 py-1 text-xs text-zinc-500">{t.more(plan.ranges.length - shown.length)}</li>
            )}
          </ul>
        </div>
      )}

      {sameAsOriginal && <InfoNote>{t.oneFile}</InfoNote>}

      <div className="mt-5">
        <ActionButton onClick={handleSplit} busy={busy} disabled={plan.ranges.length === 0 || sameAsOriginal}>
          {t.split(plan.ranges.length || 0)}
        </ActionButton>
      </div>

      {progress && <Progress value={progress.value} label={progress.label} />}
      <ErrorNote>{error}</ErrorNote>

      {result && (
        <ResultPanel
          title={t.resultTitle(result.parts.length)}
          files={result.files}
          note={result.parts.length > 1 ? t.zipNote : t.pages(result.parts[0].range.end - result.parts[0].range.start + 1)}
          onReset={reset}
          resetLabel={t.again}
        />
      )}

      {result && result.parts.length > 1 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">{t.partsHeading}</h3>
          <ul className="divide-y divide-black/5 dark:divide-white/10 rounded-lg border border-black/10 dark:border-white/10">
            {result.parts.slice(0, 100).map((p) => (
              <li key={p.name} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.name}</span>
                  <span className="block text-xs text-zinc-500">
                    {t.pages(p.range.end - p.range.start + 1)} · {formatBytes(p.blob.size)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => downloadBlob(p.blob, p.name)}
                  aria-label={t.download(p.name)}
                  title={t.download(p.name)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:text-red-600 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {result.parts.length > 100 && <InfoNote>{t.moreInZip(result.parts.length - 100)}</InfoNote>}
        </div>
      )}
    </div>
  );
}
