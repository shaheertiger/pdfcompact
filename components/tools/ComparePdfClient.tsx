"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, FileText, X, ZoomIn, ZoomOut } from "lucide-react";
import Link from "next/link";
import Dropzone from "@/components/Dropzone";
import {
  ActionButton,
  ErrorNote,
  InfoNote,
  Progress,
  ResultPanel,
  SecondaryButton,
  type ResultFile,
} from "@/components/ui/kit";
import { baseName, bytesToBlob, downloadBlob, isPdf, pdfBlob } from "@/lib/download";
import { openPdf, renderPageToCanvas, type PdfDoc } from "@/lib/pdfjs";
import {
  FLAG_LABELS,
  buildRedline,
  buildReport,
  compareTexts,
  countFlags,
  extractWords,
  lineBoxes,
  summaryLine,
  wordsText,
  type Change,
  type CompareResult,
  type Flag,
} from "@/lib/compare";

type Slot = { file: File; doc: PdfDoc; pages: number };
type Side = "a" | "b";
type Filter = "all" | Flag | "wording";

const FLAG_STYLE: Record<Flag, string> = {
  negation: "bg-red-600 text-white",
  money: "bg-amber-500 text-black",
  percent: "bg-amber-400 text-black",
  date: "bg-sky-600 text-white",
  number: "bg-violet-600 text-white",
};

const tick = () => new Promise((r) => setTimeout(r));

export default function ComparePdfClient() {
  const [slotA, setSlotA] = useState<Slot | null>(null);
  const [slotB, setSlotB] = useState<Slot | null>(null);
  const [loading, setLoading] = useState<Side | null>(null);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [emptyPages, setEmptyPages] = useState<[number, number]>([0, 0]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [pageA, setPageA] = useState(1);
  const [pageB, setPageB] = useState(1);
  const [view, setView] = useState<Side>("b");
  const [redline, setRedline] = useState<ResultFile[] | null>(null);
  const [redlineBusy, setRedlineBusy] = useState(false);
  const [redlineError, setRedlineError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const loadSlot = useCallback(async (side: Side, file: File) => {
    if (!isPdf(file)) {
      setError(`"${file.name}" isn't a PDF. Choose a .pdf file.`);
      return;
    }
    setError(null);
    setLoading(side);
    try {
      const doc = await openPdf(await file.arrayBuffer());
      const slot = { file, doc, pages: doc.numPages };
      const setter = side === "a" ? setSlotA : setSlotB;
      setter((old) => {
        old?.doc.destroy();
        return slot;
      });
      setResult(null);
      setRedline(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this PDF.");
    } finally {
      setLoading(null);
    }
  }, []);

  const onFiles = useCallback(
    (side: Side) => async (files: File[]) => {
      if (files.length >= 2) {
        // Two files dropped at once: first is the original, second the changed version.
        await loadSlot("a", files[0]);
        await loadSlot("b", files[1]);
      } else if (files[0]) await loadSlot(side, files[0]);
    },
    [loadSlot],
  );

  const clearSlot = (side: Side) => {
    const setter = side === "a" ? setSlotA : setSlotB;
    setter((old) => {
      old?.doc.destroy();
      return null;
    });
    setResult(null);
    setRedline(null);
  };

  const swap = () => {
    setSlotA(slotB);
    setSlotB(slotA);
    setResult(null);
    setRedline(null);
  };

  const reset = () => {
    slotA?.doc.destroy();
    slotB?.doc.destroy();
    setSlotA(null);
    setSlotB(null);
    setResult(null);
    setRedline(null);
    setRedlineError(null);
    setError(null);
    setSelected(null);
    setFilter("all");
    setProgress(0);
  };

  const runCompare = async () => {
    if (!slotA || !slotB) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setRedline(null);
    setRedlineError(null);
    setProgress(0);
    try {
      const total = slotA.pages + slotB.pages;
      const A = await extractWords(slotA.doc, async (p) => {
        setProgress((p / total) * 0.9);
        await tick();
      });
      const B = await extractWords(slotB.doc, async (p) => {
        setProgress(((slotA.pages + p) / total) * 0.9);
        await tick();
      });
      const noText = (s: Slot) =>
        `"${s.file.name}" has no selectable text, so it looks like a scan or a photo. Make it searchable with [OCR PDF](/ocr-pdf) first, then compare the OCR'd copy.`;
      if (A.words.length === 0) throw new Error(noText(slotA));
      if (B.words.length === 0) throw new Error(noText(slotB));
      await tick();
      const r = compareTexts(A.words, B.words, { ignoreCase });
      setProgress(1);
      setEmptyPages([A.emptyPages, B.emptyPages]);
      setResult(r);
      setFilter("all");
      const first = r.changes[0];
      if (first) {
        setSelected(first.id);
        setPageA(first.aPage);
        setPageB(first.bPage);
        setView(first.added.length ? "b" : "a");
      } else {
        setSelected(null);
        setPageA(1);
        setPageB(1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't compare these files.");
    } finally {
      setBusy(false);
    }
  };

  const select = (ch: Change, scroll = true) => {
    setSelected(ch.id);
    setPageA(ch.aPage);
    setPageB(ch.bPage);
    setView(ch.added.length ? "b" : "a");
    if (scroll) {
      requestAnimationFrame(() => viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const visible = useMemo(() => {
    if (!result) return [];
    if (filter === "all") return result.changes;
    if (filter === "wording") return result.changes.filter((c) => c.flags.length === 0);
    return result.changes.filter((c) => c.flags.includes(filter));
  }, [result, filter]);

  const step = (dir: 1 | -1) => {
    if (!visible.length) return;
    const idx = visible.findIndex((c) => c.id === selected);
    const next = idx < 0 ? (dir === 1 ? 0 : visible.length - 1) : (idx + dir + visible.length) % visible.length;
    select(visible[next], false);
  };

  const makeRedline = async () => {
    if (!slotA || !slotB || !result) return;
    setRedlineBusy(true);
    setRedlineError(null);
    try {
      const bytes = new Uint8Array(await slotB.file.arrayBuffer());
      const out = await buildRedline(bytes, result, slotA.file.name, slotB.file.name);
      setRedline([{ blob: pdfBlob(out), name: `${baseName(slotB.file.name)}-redline.pdf` }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setRedlineError(
        /encrypt/i.test(msg)
          ? "The Changed file is encrypted (it has an owner password), so we can't draw on it. The comparison above and the .txt report still work."
          : "Couldn't build the redline PDF from this file. The comparison above and the .txt report still work.",
      );
    } finally {
      setRedlineBusy(false);
    }
  };

  const downloadReport = () => {
    if (!slotA || !slotB || !result) return;
    const txt = buildReport(result, slotA.file.name, slotB.file.name);
    downloadBlob(
      bytesToBlob(new TextEncoder().encode(txt), "text/plain;charset=utf-8"),
      `${baseName(slotB.file.name)}-changes.txt`,
    );
  };

  /* ---------------------------- pick view ---------------------------- */
  const slotCard = (side: Side, slot: Slot | null) => (
    <div className="min-w-0">
      <p className="text-sm font-semibold mb-2">
        {side === "a" ? "1. Original" : "2. Changed"}
        <span className="font-normal text-zinc-500"> {side === "a" ? "(older version)" : "(newer version)"}</span>
      </p>
      {slot ? (
        <div className="flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 min-h-[5.5rem]">
          <FileText
            className={`h-8 w-8 shrink-0 ${side === "a" ? "text-red-500" : "text-emerald-600"}`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{slot.file.name}</p>
            <p className="text-xs text-zinc-500">
              {slot.pages} page{slot.pages === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => clearSlot(side)}
            disabled={busy}
            aria-label={`Remove ${side === "a" ? "original" : "changed"} file`}
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <Dropzone
          multiple
          onFiles={onFiles(side)}
          label={loading === side ? "Opening…" : side === "a" ? "Drop the original PDF" : "Drop the changed PDF"}
          hint={side === "a" ? "or tap to choose (you can pick both files at once)" : "or tap to choose"}
        />
      )}
    </div>
  );

  const counts = result ? countFlags(result.changes) : null;
  const wordingCount = result ? result.changes.filter((c) => c.flags.length === 0).length : 0;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        {slotCard("a", slotA)}
        <div className="flex justify-center sm:pb-6">
          <button
            type="button"
            onClick={swap}
            disabled={(!slotA && !slotB) || busy}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-full text-sm text-zinc-600 dark:text-zinc-300 border border-black/10 dark:border-white/15 hover:border-red-400 hover:text-red-600 disabled:opacity-40"
            aria-label="Swap original and changed"
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            <span className="sm:sr-only">Swap</span>
          </button>
        </div>
        {slotCard("b", slotB)}
      </div>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm min-h-10 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 accent-red-600"
            checked={ignoreCase}
            onChange={(e) => {
              setIgnoreCase(e.target.checked);
              setResult(null);
            }}
          />
          Ignore letter case and punctuation
        </label>
        <ActionButton onClick={runCompare} disabled={!slotA || !slotB} busy={busy}>
          {busy ? "Comparing…" : "Compare PDFs"}
        </ActionButton>
      </div>

      {busy && <Progress value={progress} label="Reading text and comparing…" />}
      {error && (
        <ErrorNote>
          <LinkedText text={error} />
        </ErrorNote>
      )}
      {!result && !busy && (
        <InfoNote>
          Compares the words in both files: changed numbers, money amounts, percentages, dates and added or removed
          negations (“not”, “no”, “never”) are flagged. Nothing is uploaded.
        </InfoNote>
      )}

      {result && slotA && slotB && counts && (
        <div className="mt-6">
          {/* Summary */}
          <section
            aria-label="Comparison summary"
            className={`rounded-xl border p-4 sm:p-5 ${
              result.changes.length
                ? "border-amber-300/70 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5"
                : "border-emerald-300/60 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5"
            }`}
          >
            <p className="text-lg font-semibold">
              {result.changes.length === 0
                ? "No differences in the text"
                : `${result.changes.length} change${result.changes.length === 1 ? "" : "s"} found`}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              {result.changes.length === 0
                ? `All ${result.wordsA.toLocaleString()} words match. Only the text is compared, so changes to images, colours or layout aren't detected.`
                : summaryLine(result.changes).replace(/^\d+ changes?: /, "")}
            </p>
            {result.changes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter changes">
                <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
                  All {result.changes.length}
                </FilterChip>
                {(["money", "percent", "number", "date", "negation"] as Flag[]).map((f) =>
                  counts[f] ? (
                    <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)} flag={f}>
                      {counts[f]} {FLAG_LABELS[f][counts[f] === 1 ? 0 : 1]}
                    </FilterChip>
                  ) : null,
                )}
                {wordingCount > 0 && (
                  <FilterChip active={filter === "wording"} onClick={() => setFilter("wording")}>
                    {wordingCount} other wording
                  </FilterChip>
                )}
              </div>
            )}
            {(emptyPages[0] > 0 || emptyPages[1] > 0) && (
              <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
                {emptyPages[0] > 0 && `${emptyPages[0]} page(s) of the original`}
                {emptyPages[0] > 0 && emptyPages[1] > 0 && " and "}
                {emptyPages[1] > 0 && `${emptyPages[1]} page(s) of the changed file`} have no text layer (scans or
                images) and weren&apos;t compared. Run them through{" "}
                <Link className="underline" href="/ocr-pdf">
                  OCR PDF
                </Link>{" "}
                first to include them.
              </p>
            )}
            {result.method === "lines" && (
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                These files differ a lot, so the comparison was done line by line first. Expect larger change blocks.
              </p>
            )}
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              {result.changes.length > 0 && (
                <ActionButton onClick={makeRedline} busy={redlineBusy} disabled={!!redline}>
                  {redlineBusy ? "Building redline…" : "Create redline PDF"}
                </ActionButton>
              )}
              <SecondaryButton onClick={downloadReport}>Download report (.txt)</SecondaryButton>
              <SecondaryButton onClick={reset}>Compare other files</SecondaryButton>
            </div>
            {redlineError && <ErrorNote>{redlineError}</ErrorNote>}
            {redline && (
              <ResultPanel
                title="Redline PDF ready"
                files={redline}
                note="A summary page listing every change, then the Changed document with green boxes on new wording and red markers where text was deleted."
              />
            )}
          </section>

          {/* Change list */}
          {result.changes.length > 0 && (
            <section aria-label="List of changes" className="mt-5">
              <ol className="grid gap-2 max-h-[24rem] overflow-y-auto overscroll-contain pr-1">
                {visible.map((ch) => (
                  <li key={ch.id}>
                    <ChangeRow change={ch} active={ch.id === selected} onClick={() => select(ch)} />
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Side-by-side viewer */}
          <section ref={viewerRef} aria-label="Page view" className="mt-6 scroll-mt-4">
            <div className="py-2 flex flex-wrap items-center gap-2 justify-between">
              <div
                className="flex rounded-full border border-black/10 dark:border-white/15 p-0.5 lg:hidden"
                role="group"
                aria-label="Choose document"
              >
                {(["a", "b"] as Side[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={view === s}
                    onClick={() => setView(s)}
                    className={`h-9 px-4 rounded-full text-sm font-medium ${
                      view === s
                        ? s === "a"
                          ? "bg-red-600 text-white"
                          : "bg-emerald-600 text-white"
                        : "text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    {s === "a" ? "Original" : "Changed"}
                  </button>
                ))}
              </div>
              {result.changes.length > 0 && (
                <div className="flex items-center gap-1 ml-auto">
                  <NavButton onClick={() => step(-1)} label="Previous change">
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </NavButton>
                  <span className="text-sm tabular-nums px-1 min-w-[5.5rem] text-center">
                    {selected ? `Change ${selected} of ${result.changes.length}` : `${result.changes.length} changes`}
                  </span>
                  <NavButton onClick={() => step(1)} label="Next change">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </NavButton>
                </div>
              )}
            </div>
            <div className="mt-2 grid gap-4 lg:grid-cols-2">
              <div className={`min-w-0 ${view === "a" ? "block" : "hidden lg:block"}`}>
                <PagePane
                  side="a"
                  slot={slotA}
                  page={pageA}
                  setPage={setPageA}
                  changes={result.changes}
                  selected={selected}
                  onPick={select}
                />
              </div>
              <div className={`min-w-0 ${view === "b" ? "block" : "hidden lg:block"}`}>
                <PagePane
                  side="b"
                  slot={slotB}
                  page={pageB}
                  setPage={setPageB}
                  changes={result.changes}
                  selected={selected}
                  onPick={select}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/50 align-middle" /> removed from the
              original · <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/50 align-middle" /> added
              in the changed file · <span className="inline-block h-2.5 w-0.5 bg-red-600 align-middle" /> deletion
              point. Boxes are placed from the PDF&apos;s text positions and can be a few pixels off.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

/** Render "[label](/path)" in a message as a link (used for the OCR hint). */
function LinkedText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\(\/[^)]+\))/);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[([^\]]+)\]\((\/[^)]+)\)$/);
        return m ? (
          <Link key={i} href={m[2]} className="underline font-medium">
            {m[1]}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  flag,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  flag?: Flag;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors ${
        active
          ? "border-red-500 bg-red-600 text-white"
          : "border-black/10 dark:border-white/15 bg-white dark:bg-zinc-900 hover:border-red-300"
      }`}
    >
      {flag && <span className={`h-2.5 w-2.5 rounded-full ${FLAG_STYLE[flag].split(" ")[0]}`} aria-hidden="true" />}
      {children}
    </button>
  );
}

function NavButton({
  onClick,
  label,
  children,
  disabled,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-black/10 dark:border-white/15 hover:border-red-400 hover:text-red-600 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function ChangeRow({ change: ch, active, onClick }: { change: Change; active: boolean; onClick: () => void }) {
  const removed = wordsText(ch.removed);
  const added = wordsText(ch.added);
  const clip = (s: string, n = 220) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
        active
          ? "border-red-500 bg-red-50/70 dark:bg-red-500/10"
          : "border-black/10 dark:border-white/10 hover:border-red-300"
      }`}
    >
      <span className="flex flex-wrap items-center gap-1.5 mb-1">
        <span className="inline-flex h-5 min-w-5 px-1 items-center justify-center rounded bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold">
          {ch.id}
        </span>
        {ch.flags.map((f) => (
          <span
            key={f}
            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${FLAG_STYLE[f]}`}
          >
            {FLAG_LABELS[f][0]}
            {f === "negation" && ch.negationNote ? `: ${ch.negationNote}` : ""}
          </span>
        ))}
        {ch.flags.length === 0 && (
          <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-zinc-200 dark:bg-zinc-700">
            {ch.type === "replaced" ? "wording" : ch.type}
          </span>
        )}
        <span className="ml-auto text-xs text-zinc-500">
          {ch.aPage === ch.bPage ? `p. ${ch.bPage}` : `p. ${ch.aPage} → ${ch.bPage}`}
        </span>
      </span>
      <span className="block text-zinc-700 dark:text-zinc-300 break-words">
        {ch.before && <span className="text-zinc-500">…{ch.before} </span>}
        {removed && (
          <del className="bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 decoration-red-500 rounded px-0.5">
            {clip(removed)}
          </del>
        )}
        {removed && added && " → "}
        {added && (
          <ins className="no-underline bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 font-medium rounded px-0.5">
            {clip(added)}
          </ins>
        )}
        {ch.after && <span className="text-zinc-500"> {ch.after}…</span>}
      </span>
    </button>
  );
}

function PagePane({
  side,
  slot,
  page,
  setPage,
  changes,
  selected,
  onPick,
}: {
  side: Side;
  slot: Slot;
  page: number;
  setPage: (n: number) => void;
  changes: Change[];
  selected: number | null;
  onPick: (c: Change, scroll?: boolean) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(true);
  const [aspect, setAspect] = useState(1.414);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const pg = await slot.doc.getPage(page);
        const vp = pg.getViewport({ scale: 1 });
        if (cancelled) return;
        setAspect(vp.height / vp.width);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const scale = Math.min(4, (620 * dpr * zoom) / vp.width);
        const canvas = await renderPageToCanvas(slot.doc, page, scale);
        if (cancelled || !holder.current) return;
        canvas.className = "block w-full h-auto";
        canvas.setAttribute("aria-hidden", "true");
        holder.current.replaceChildren(canvas);
      } catch {
        // A failed render leaves the previous page in place.
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slot.doc, page, zoom]);

  const boxes = useMemo(() => {
    const out: { id: number; ch: Change; v: [number, number, number, number]; kind: "del" | "ins" | "mark" }[] = [];
    for (const ch of changes) {
      const words = side === "a" ? ch.removed : ch.added;
      for (const b of lineBoxes(words))
        if (b.p === page) out.push({ id: ch.id, ch, v: b.v, kind: side === "a" ? "del" : "ins" });
    }
    return out;
  }, [changes, side, page]);

  // Insertion/deletion points: a thin bar where text is missing on this side.
  const marks = useMemo(() => {
    const out: { id: number; ch: Change; left: number; top: number; height: number }[] = [];
    for (const ch of changes) {
      const anchor = side === "a" ? ch.aAnchor : ch.bAnchor;
      if (!anchor || anchor.p !== page) continue;
      out.push({ id: ch.id, ch, left: anchor.x, top: anchor.y, height: anchor.h });
    }
    return out;
  }, [changes, side, page]);

  const [markPos, setMarkPos] = useState<{ id: number; ch: Change; v: [number, number, number, number] }[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!marks.length) {
        setMarkPos([]);
        return;
      }
      const pg = await slot.doc.getPage(page);
      const vp = pg.getViewport({ scale: 1 });
      const res = marks.map((m) => {
        const r = vp.convertToViewportRectangle([m.left - 1, m.top - 1, m.left + 1, m.top + m.height + 1]);
        const l = Math.min(r[0], r[2]);
        const t = Math.min(r[1], r[3]);
        return {
          id: m.id,
          ch: m.ch,
          v: [l / vp.width, t / vp.height, Math.abs(r[2] - r[0]) / vp.width, Math.abs(r[3] - r[1]) / vp.height] as [
            number,
            number,
            number,
            number,
          ],
        };
      });
      if (!cancelled) setMarkPos(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [marks, slot.doc, page]);

  // Bring the selected change into view inside the page once it's drawn.
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (rendering || selected == null) return;
    const el = overlayRef.current?.querySelector<HTMLElement>(`[data-change="${selected}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [rendering, selected, page]);

  const color = side === "a" ? "text-red-600" : "text-emerald-700 dark:text-emerald-400";
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className={`text-sm font-semibold truncate ${color}`}>
          {side === "a" ? "Original" : "Changed"} <span className="font-normal text-zinc-500">· {slot.file.name}</span>
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <NavButton onClick={() => setZoom(zoom === 1 ? 2 : 1)} label={zoom === 1 ? "Zoom in" : "Zoom out"}>
            {zoom === 1 ? (
              <ZoomIn className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ZoomOut className="h-4 w-4" aria-hidden="true" />
            )}
          </NavButton>
          <NavButton onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} label="Previous page">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </NavButton>
          <span className="text-xs tabular-nums w-14 text-center">
            {page} / {slot.pages}
          </span>
          <NavButton
            onClick={() => setPage(Math.min(slot.pages, page + 1))}
            disabled={page >= slot.pages}
            label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </NavButton>
        </div>
      </div>
      <div
        className={`rounded-lg border border-black/10 dark:border-white/10 bg-white shadow-sm ${
          zoom > 1 ? "overflow-auto max-h-[80vh] overscroll-contain" : "overflow-hidden"
        }`}
      >
        <div className="relative" style={{ aspectRatio: `1 / ${aspect}`, width: `${zoom * 100}%` }}>
          <div ref={holder} className="absolute inset-0" />
          <div ref={overlayRef} className="absolute inset-0">
            {boxes.map((b, i) => (
              <button
                key={`${b.id}-${i}`}
                type="button"
                data-change={b.id}
                title={`Change ${b.id}`}
                aria-label={`Change ${b.id}`}
                onClick={() => onPick(b.ch, false)}
                className={`absolute rounded-[2px] ${
                  b.kind === "del" ? "bg-red-500/30 ring-red-600" : "bg-emerald-500/30 ring-emerald-600"
                } ${selected === b.id ? "ring-2 animate-pulse" : "ring-1 ring-opacity-50"}`}
                style={{
                  left: `${b.v[0] * 100 - 0.2}%`,
                  top: `${b.v[1] * 100}%`,
                  width: `${b.v[2] * 100 + 0.4}%`,
                  height: `${b.v[3] * 100}%`,
                }}
              />
            ))}
            {markPos.map((m) => (
              <button
                key={`m${m.id}`}
                type="button"
                data-change={m.id}
                title={`Change ${m.id}: text ${side === "a" ? "added here" : "deleted here"}`}
                aria-label={`Change ${m.id}`}
                onClick={() => onPick(m.ch, false)}
                className={`absolute ${side === "a" ? "bg-emerald-600 ring-emerald-600" : "bg-red-600 ring-red-600"} ${selected === m.id ? "ring-2 ring-offset-1" : ""}`}
                style={{
                  left: `calc(${m.v[0] * 100}% - 1px)`,
                  top: `${m.v[1] * 100}%`,
                  width: "3px",
                  height: `${m.v[3] * 100}%`,
                }}
              />
            ))}
          </div>
          {rendering && (
            <div className="absolute inset-x-0 top-2 text-center text-xs text-zinc-400" aria-live="polite">
              Rendering page…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
