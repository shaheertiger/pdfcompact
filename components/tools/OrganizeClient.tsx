"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, FilePlus, GripVertical, RotateCw, SquarePlus, Trash2, Undo2 } from "lucide-react";
import type { PDFPage } from "@cantoo/pdf-lib";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, InfoNote, Progress, ResultPanel, SecondaryButton, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, isPdf, pdfBlob } from "@/lib/download";
import { nextId } from "@/lib/id";
import {
  PageThumb,
  PdfLoadError,
  ThumbSource,
  createDoc,
  loadEditable,
  moveItem,
  tick,
  usePointerSort,
  type EditDoc,
} from "@/lib/page-tools";

type Source = { id: string; file: File; thumbs: ThumbSource };
type Item = {
  key: string;
  /** Source id, or null for an inserted blank page. */
  src: string | null;
  index: number;
  /** Extra clockwise rotation the user added, 0/90/180/270. */
  rotate: number;
  deleted: boolean;
};

const norm = (deg: number) => ((deg % 360) + 360) % 360;

export default function OrganizeClient() {
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; pages: number } | null>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<Source[]>([]);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);
  // Free pdf.js documents and thumbnail images when leaving the page.
  useEffect(() => () => sourcesRef.current.forEach((s) => s.thumbs.destroy()), []);

  const addFiles = async (files: File[]) => {
    setError(null);
    const pdfs = files.filter(isPdf);
    if (pdfs.length === 0) return setError("That isn't a PDF. Choose a .pdf file.");
    setLoading(true);
    for (const file of pdfs) {
      try {
        const thumbs = await ThumbSource.fromFile(file);
        const src: Source = { id: nextId("src"), file, thumbs };
        setSources((prev) => [...prev, src]);
        setItems((prev) => [
          ...prev,
          ...Array.from({ length: thumbs.pageCount }, (_, i) => ({
            key: nextId("pg"),
            src: src.id,
            index: i,
            rotate: 0,
            deleted: false,
          })),
        ]);
        setResult(null);
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setLoading(false);
  };

  const reset = () => {
    sources.forEach((s) => s.thumbs.destroy());
    setSources([]);
    setItems([]);
    setResult(null);
    setError(null);
  };

  const change = useCallback((fn: (prev: Item[]) => Item[]) => {
    setResult(null);
    setError(null);
    setItems(fn);
  }, []);
  const move = useCallback((from: number, to: number) => change((prev) => moveItem(prev, from, to)), [change]);
  const patch = (key: string, p: (it: Item) => Partial<Item>) =>
    change((prev) => prev.map((it) => (it.key === key ? { ...it, ...p(it) } : it)));
  const sort = usePointerSort(move);

  const kept = items.filter((it) => !it.deleted);
  const deletedCount = items.length - kept.length;
  const rotatedCount = kept.filter((it) => norm(it.rotate) !== 0).length;
  const srcById = new Map(sources.map((s) => [s.id, s]));
  const first = sources[0];

  const handleSave = async () => {
    if (kept.length === 0) return setError("Every page is marked for deletion. Keep at least one page.");
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    let current = "";
    try {
      // Load each source once and copy all of its pages in one call, so shared fonts and images aren't duplicated.
      const usedIds = [...new Set(kept.map((it) => it.src).filter((s): s is string => s !== null))];
      const docs = new Map<string, EditDoc>();
      for (const id of usedIds) {
        const s = srcById.get(id)!;
        current = s.file.name;
        docs.set(id, await loadEditable(await s.file.arrayBuffer()));
        setProgress((docs.size / (usedIds.length + 2)) * 0.8);
        await tick();
      }
      current = "";
      const out = await createDoc(first ? docs.get(first.id) : undefined);
      const copied = new Map<string, Map<number, PDFPage>>();
      for (const id of usedIds) {
        const indices = kept.filter((it) => it.src === id).map((it) => it.index);
        const pages = await out.copyPages(docs.get(id)!, indices);
        copied.set(id, new Map(indices.map((idx, k) => [idx, pages[k]])));
      }
      setProgress(0.85);
      await tick();

      const { degrees } = await import("@cantoo/pdf-lib");
      let lastSize: [number, number] = [595.28, 841.89]; // A4 until we've seen a real page
      for (const it of kept) {
        if (it.src === null) {
          const page = out.addPage(lastSize);
          page.setRotation(degrees(norm(it.rotate)));
          continue;
        }
        const page = copied.get(it.src)!.get(it.index)!;
        out.addPage(page);
        const angle = norm(page.getRotation().angle + it.rotate);
        page.setRotation(degrees(angle));
        // A blank page added after this one matches how this page looks on screen.
        const { width, height } = page.getSize();
        lastSize = angle % 180 === 0 ? [width, height] : [height, width];
      }
      const bytes = await out.save();
      setProgress(1);
      setResult({
        file: { blob: pdfBlob(bytes), name: `${baseName(first?.file.name ?? "document.pdf")}-organized.pdf` },
        pages: kept.length,
      });
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    } catch (e) {
      console.error(e);
      const why = e instanceof PdfLoadError ? e.message : "Couldn't save the PDF. Try re-saving the file with Print to PDF first.";
      setError(current ? `${current}: ${why}` : why);
    } finally {
      setBusy(false);
    }
  };

  if (!first) {
    return (
      <div>
        <Dropzone onFiles={addFiles} />
        {loading && <InfoNote>Reading the PDF…</InfoNote>}
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  const multi = sources.length > 1;
  const summary = [
    `${kept.length} ${kept.length === 1 ? "page" : "pages"}`,
    rotatedCount ? `${rotatedCount} rotated` : "",
    deletedCount ? `${deletedCount} to delete` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <FileBar
        name={multi ? `${first.file.name} + ${sources.length - 1} more` : first.file.name}
        detail={`${items.filter((i) => i.src).length} pages · ${formatBytes(sources.reduce((n, s) => n + s.file.size, 0))}`}
        onReset={reset}
      />

      <div className="flex flex-wrap gap-2">
        <SecondaryButton onClick={() => addInput.current?.click()} disabled={busy || loading}>
          <FilePlus className="h-4 w-4" aria-hidden="true" />
          {loading ? "Reading…" : "Add another PDF"}
        </SecondaryButton>
        <SecondaryButton
          onClick={() =>
            change((prev) => [...prev, { key: nextId("pg"), src: null, index: 0, rotate: 0, deleted: false }])
          }
          disabled={busy}
        >
          <SquarePlus className="h-4 w-4" aria-hidden="true" />
          Add blank page
        </SecondaryButton>
        <SecondaryButton
          onClick={() => change((prev) => prev.map((it) => (it.deleted ? it : { ...it, rotate: norm(it.rotate + 90) })))}
          disabled={busy}
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          Rotate all
        </SecondaryButton>
        <input
          ref={addInput}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          aria-label="Add another PDF"
          onChange={(e) => {
            if (e.target.files) void addFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>
      <InfoNote>
        Drag a page (or its grip on a phone) to move it, or use the arrows. New pages and files go at the end.
      </InfoNote>

      <ErrorNote>{error}</ErrorNote>
      <div ref={resultRef}>
        {result && (
          <ResultPanel
            title="Your PDF is ready"
            files={[result.file]}
            note={`${result.pages} ${result.pages === 1 ? "page" : "pages"}${rotatedCount ? `, ${rotatedCount} rotated` : ""}${deletedCount ? `, ${deletedCount} deleted` : ""}. Keep editing and save again if you need to.`}
            onReset={reset}
            resetLabel="Organize another PDF"
          />
        )}
      </div>

      <ol className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        {items.map((it, i) => {
          const src = it.src ? srcById.get(it.src) : undefined;
          const label = src ? `Page ${it.index + 1}${multi ? ` of ${src.file.name}` : ""}` : "Blank page";
          const isDragged = sort.drag?.from === i;
          const isTarget = sort.drag && sort.drag.over === i && sort.drag.from !== i;
          return (
            <li
              key={it.key}
              {...sort.item(i)}
              className={`relative rounded-lg border p-1 sm:p-1.5 select-none transition-[opacity,box-shadow] ${
                it.deleted
                  ? "border-red-300 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/10"
                  : "border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
              } ${isDragged ? "opacity-40" : ""} ${isTarget ? "ring-2 ring-red-500" : ""} sm:cursor-grab`}
            >
              <div className="relative">
                {src ? (
                  <PageThumb source={src.thumbs} index={it.index} rotation={it.rotate} alt={label} dim={it.deleted} />
                ) : (
                  <div className="aspect-square w-full flex items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-[88%] aspect-[1/1.414] bg-white shadow-sm ring-1 ring-black/10 flex items-center justify-center text-[11px] text-zinc-400 transition-transform ${it.deleted ? "opacity-30" : ""}`}
                      style={{ transform: it.rotate ? `rotate(${it.rotate}deg)` : undefined }}
                    >
                      Blank
                    </div>
                  </div>
                )}
                <span
                  {...sort.handle(i)}
                  aria-hidden="true"
                  title="Drag to move"
                  className="absolute left-0.5 top-0.5 flex h-10 w-10 items-center justify-center rounded-md bg-white/85 dark:bg-zinc-900/85 text-zinc-500 shadow-sm cursor-grab"
                >
                  <GripVertical className="h-5 w-5" />
                </span>
                <span className="absolute right-0.5 top-0.5 flex gap-1">
                  <CardButton
                    label={`Rotate ${label} 90° clockwise`}
                    onClick={() => patch(it.key, (p) => ({ rotate: norm(p.rotate + 90) }))}
                    disabled={busy || it.deleted}
                  >
                    <RotateCw className="h-4 w-4" aria-hidden="true" />
                  </CardButton>
                  <CardButton
                    label={it.deleted ? `Keep ${label}` : `Delete ${label}`}
                    pressed={it.deleted}
                    danger={!it.deleted}
                    onClick={() => patch(it.key, (p) => ({ deleted: !p.deleted }))}
                    disabled={busy}
                  >
                    {it.deleted ? <Undo2 className="h-4 w-4" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                  </CardButton>
                </span>
                {it.deleted && (
                  <span className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                    Will be deleted
                  </span>
                )}
                {norm(it.rotate) !== 0 && !it.deleted && (
                  <span className="absolute left-1 bottom-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">
                    +{norm(it.rotate)}°
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <CardButton label={`Move ${label} left`} onClick={() => move(i, i - 1)} disabled={busy || i === 0} plain>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </CardButton>
                <span className="min-w-0 text-center leading-tight">
                  <span className="block text-sm font-semibold">{i + 1}</span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {src ? `p. ${it.index + 1}${multi ? ` · ${sources.indexOf(src) === 0 ? "orig." : `file ${sources.indexOf(src) + 1}`}` : ""}` : "blank"}
                  </span>
                </span>
                <CardButton
                  label={`Move ${label} right`}
                  onClick={() => move(i, i + 1)}
                  disabled={busy || i === items.length - 1}
                  plain
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </CardButton>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="sticky bottom-0 z-10 -mx-3 sm:-mx-8 mt-4 border-t border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-3 sm:px-8 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <ActionButton onClick={handleSave} busy={busy} disabled={kept.length === 0 || loading}>
            Save PDF
          </ActionButton>
          <span className="text-sm text-zinc-600 dark:text-zinc-400 text-center sm:text-left">{summary}</span>
        </div>
        {busy && <Progress value={progress} label="Saving" />}
        {kept.length === 0 && <InfoNote>Every page is marked for deletion. Keep at least one page.</InfoNote>}
      </div>
    </div>
  );
}

function CardButton({
  label,
  onClick,
  disabled,
  pressed,
  danger,
  plain,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  danger?: boolean;
  plain?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
        plain
          ? "text-zinc-500 hover:text-red-600 hover:bg-black/5 dark:hover:bg-white/10"
          : pressed
            ? "bg-red-600 text-white shadow-sm"
            : `bg-white/85 dark:bg-zinc-900/85 shadow-sm text-zinc-600 dark:text-zinc-300 ${danger ? "hover:text-red-600" : "hover:text-zinc-900 dark:hover:text-white"}`
      }`}
    >
      {children}
    </button>
  );
}
