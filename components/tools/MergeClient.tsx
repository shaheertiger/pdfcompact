"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownAZ, ChevronDown, ChevronUp, GripVertical, Plus, X } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, InfoNote, Progress, ResultPanel, SecondaryButton, type ResultFile } from "@/components/ui/kit";
import { formatBytes, isPdf, pdfBlob } from "@/lib/download";
import { useLocale, useStrings } from "@/lib/i18n";
import { nextId } from "@/lib/id";
import { PdfLoadError, createDoc, loadEditable, moveItem, tick, usePointerSort } from "@/lib/page-tools";

const strings = {
  en: {
    drop: "Drop PDF files here",
    dropHint: "or tap to choose 2 or more files",
    addMore: "Add more PDFs",
    sortName: "Sort by name",
    clear: "Clear all",
    reading: "Reading…",
    pages: (n: number) => (n === 1 ? "1 page" : `${n} pages`),
    summary: (files: number, pages: number, size: string) =>
      `${files} ${files === 1 ? "file" : "files"} · ${pages} pages · ${size}`,
    orderHint: "The top file becomes the first pages. Drag the grip or use the arrows to reorder.",
    moveUp: (name: string) => `Move ${name} up`,
    moveDown: (name: string) => `Move ${name} down`,
    remove: (name: string) => `Remove ${name}`,
    dragHandle: (name: string) => `Drag to reorder ${name}`,
    merge: (n: number) => `Merge ${n} PDFs`,
    merging: "Merging",
    needTwo: "Add at least two PDF files to merge.",
    fixBad: (names: string) => `Remove ${names} to continue. Files marked in red can't be merged.`,
    notPdf: (names: string) => `Skipped ${names}: not a PDF. Convert images with JPG to PDF first.`,
    failed: (name: string, why: string) => `${name}: ${why}`,
    failedGeneric: "Couldn't merge these files. Try re-saving the file that fails with Print to PDF.",
    resultTitle: "Merged",
    resultNote: (pages: number, files: number) => `${pages} pages from ${files} files, in the order you set.`,
    outName: "merged.pdf",
    again: "Merge other files",
  },
  es: {
    drop: "Suelta aquí tus archivos PDF",
    dropHint: "o toca para elegir 2 o más archivos",
    addMore: "Añadir más PDF",
    sortName: "Ordenar por nombre",
    clear: "Quitar todos",
    reading: "Leyendo…",
    pages: (n: number) => (n === 1 ? "1 página" : `${n} páginas`),
    summary: (files: number, pages: number, size: string) =>
      `${files} ${files === 1 ? "archivo" : "archivos"} · ${pages} páginas · ${size}`,
    orderHint: "El primer archivo de la lista serán las primeras páginas. Arrastra el asa o usa las flechas para cambiar el orden.",
    moveUp: (name: string) => `Subir ${name}`,
    moveDown: (name: string) => `Bajar ${name}`,
    remove: (name: string) => `Quitar ${name}`,
    dragHandle: (name: string) => `Arrastra para mover ${name}`,
    merge: (n: number) => `Unir ${n} PDF`,
    merging: "Uniendo",
    needTwo: "Añade al menos dos archivos PDF para unirlos.",
    fixBad: (names: string) => `Quita ${names} para continuar. Los archivos marcados en rojo no se pueden unir.`,
    notPdf: (names: string) => `Se omitió ${names}: no es un PDF. Convierte las imágenes a PDF primero.`,
    failed: (name: string, why: string) => `${name}: ${why}`,
    failedGeneric: "No se pudieron unir estos archivos. Vuelve a guardar el archivo que falla con Imprimir a PDF.",
    resultTitle: "Listo",
    resultNote: (pages: number, files: number) => `${pages} páginas de ${files} archivos, en el orden que elegiste.`,
    outName: "unido.pdf",
    again: "Unir otros archivos",
  },
};

type Item = {
  id: string;
  file: File;
  pages?: number;
  error?: string;
};

export default function MergeClient() {
  const t = useStrings(strings);
  const locale = useLocale();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; pages: number; files: number } | null>(null);
  const moreInput = useRef<HTMLInputElement>(null);

  // Read each new file once to count its pages and catch damaged or locked files early.
  useEffect(() => {
    const pending = items.filter((it) => it.pages === undefined && !it.error);
    if (pending.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const it of pending) {
        let patch: Partial<Item>;
        try {
          const doc = await loadEditable(await it.file.arrayBuffer(), locale);
          patch = { pages: doc.getPageCount() };
        } catch (e) {
          patch = { error: e instanceof PdfLoadError ? e.message : new PdfLoadError("damaged", locale).message };
        }
        if (cancelled) return;
        setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, ...patch } : p)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items, locale]);

  const addFiles = useCallback(
    (files: File[]) => {
      setError(null);
      setResult(null);
      const pdfs = files.filter(isPdf);
      const skipped = files.filter((f) => !isPdf(f)).map((f) => f.name);
      setNotice(skipped.length ? t.notPdf(skipped.join(", ")) : null);
      setItems((prev) => [...prev, ...pdfs.map((file) => ({ id: nextId("merge"), file }))]);
    },
    [t]
  );

  const update = (fn: (prev: Item[]) => Item[]) => {
    setResult(null);
    setError(null);
    setItems(fn);
  };
  const move = useCallback((from: number, to: number) => {
    setResult(null);
    setItems((prev) => moveItem(prev, from, to));
  }, []);
  const sort = usePointerSort(move);

  const ready = items.filter((it) => it.pages !== undefined);
  const bad = items.filter((it) => it.error);
  const reading = items.some((it) => it.pages === undefined && !it.error);
  const totalPages = ready.reduce((n, it) => n + (it.pages ?? 0), 0);
  const totalSize = items.reduce((n, it) => n + it.file.size, 0);

  const handleMerge = async () => {
    if (items.length < 2) return setError(t.needTwo);
    if (bad.length) return setError(t.fixBad(bad.map((b) => b.file.name).join(", ")));
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    let current = "";
    try {
      const out = await createDoc();
      for (let i = 0; i < items.length; i++) {
        current = items[i].file.name;
        const src = await loadEditable(await items[i].file.arrayBuffer(), locale);
        const pages = await out.copyPages(src, src.getPageIndices());
        for (const p of pages) out.addPage(p);
        setProgress((i + 1) / (items.length + 1));
        await tick();
      }
      current = "";
      const bytes = await out.save();
      setResult({
        file: { blob: pdfBlob(bytes), name: t.outName },
        pages: out.getPageCount(),
        files: items.length,
      });
      setProgress(1);
    } catch (e) {
      console.error(e);
      if (e instanceof PdfLoadError && current) setError(t.failed(current, e.message));
      else setError(current ? `${current}: ${t.failedGeneric}` : t.failedGeneric);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setItems([]);
    setResult(null);
    setError(null);
    setNotice(null);
  };

  if (items.length === 0) {
    return (
      <div>
        <Dropzone multiple onFiles={addFiles} label={t.drop} hint={t.dropHint} />
        <ErrorNote>{notice}</ErrorNote>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SecondaryButton onClick={() => moreInput.current?.click()} disabled={busy}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t.addMore}
        </SecondaryButton>
        <SecondaryButton
          onClick={() =>
            update((prev) =>
              [...prev].sort((a, b) =>
                a.file.name.localeCompare(b.file.name, locale, { numeric: true, sensitivity: "base" })
              )
            )
          }
          disabled={busy || items.length < 2}
        >
          <ArrowDownAZ className="h-4 w-4" aria-hidden="true" />
          {t.sortName}
        </SecondaryButton>
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="ml-auto text-sm text-zinc-500 hover:text-red-600 px-2 py-2 disabled:opacity-40"
        >
          {t.clear}
        </button>
        <input
          ref={moreInput}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          aria-label={t.addMore}
          onChange={(e) => {
            if (e.target.files) addFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{t.orderHint}</p>

      <ol className="grid grid-cols-1 gap-2">
        {items.map((it, i) => {
          const isDragged = sort.drag?.from === i;
          const isTarget = sort.drag && sort.drag.over === i && sort.drag.from !== i;
          return (
            <li
              key={it.id}
              {...sort.item(i)}
              className={`flex items-center gap-2 rounded-lg border px-1.5 py-1.5 sm:px-2 transition-colors select-none ${
                it.error
                  ? "border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10"
                  : "border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50"
              } ${isDragged ? "opacity-50" : ""} ${isTarget ? "ring-2 ring-red-500" : ""} sm:cursor-grab`}
            >
              <span
                {...sort.handle(i)}
                aria-hidden="true"
                title={t.dragHandle(it.file.name)}
                className="flex h-10 w-7 shrink-0 items-center justify-center text-zinc-400 cursor-grab"
              >
                <GripVertical className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-xs font-semibold">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{it.file.name}</span>
                <span className={`block text-xs ${it.error ? "text-red-700 dark:text-red-300" : "text-zinc-500"}`}>
                  {it.error
                    ? it.error
                    : `${it.pages === undefined ? t.reading : t.pages(it.pages)} · ${formatBytes(it.file.size)}`}
                </span>
              </span>
              <span className="flex shrink-0">
                <IconButton label={t.moveUp(it.file.name)} disabled={busy || i === 0} onClick={() => move(i, i - 1)}>
                  <ChevronUp className="h-5 w-5" aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={t.moveDown(it.file.name)}
                  disabled={busy || i === items.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ChevronDown className="h-5 w-5" aria-hidden="true" />
                </IconButton>
                <IconButton
                  label={t.remove(it.file.name)}
                  disabled={busy}
                  onClick={() => update((prev) => prev.filter((p) => p.id !== it.id))}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </IconButton>
              </span>
            </li>
          );
        })}
      </ol>

      <InfoNote>{t.summary(items.length, totalPages, formatBytes(totalSize))}</InfoNote>

      <div className="mt-5">
        <ActionButton onClick={handleMerge} busy={busy} disabled={items.length < 2 || reading || bad.length > 0}>
          {t.merge(items.length)}
        </ActionButton>
      </div>

      {items.length < 2 && <InfoNote>{t.needTwo}</InfoNote>}
      {bad.length > 0 && <ErrorNote>{t.fixBad(bad.map((b) => b.file.name).join(", "))}</ErrorNote>}
      <ErrorNote>{notice}</ErrorNote>
      <ErrorNote>{error}</ErrorNote>
      {busy && <Progress value={progress} label={t.merging} />}

      {result && (
        <ResultPanel
          title={t.resultTitle}
          files={[result.file]}
          note={t.resultNote(result.pages, result.files)}
          onReset={reset}
          resetLabel={t.again}
        />
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
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-md text-zinc-500 hover:text-red-600 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
