"use client";

/**
 * Shared helpers for the page tools (merge, split, organize, delete, extract):
 * loading PDFs for editing, lazy page thumbnails, page-range parsing and a
 * pointer-based reorder hook that works with touch as well as a mouse.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { PDFDocument } from "@cantoo/pdf-lib";
import { openPdf, type PdfDoc } from "@/lib/pdfjs";
import type { Locale } from "@/lib/i18n";

export type EditDoc = PDFDocument;

/** Let React paint (progress bars) between heavy steps. */
export const tick = () => new Promise<void>((r) => setTimeout(r, 0));

const loadErrors = {
  en: {
    password: "This PDF needs a password to open. Remove the password first, then try again.",
    damaged: "This file couldn't be read. It may be damaged or not a real PDF.",
    empty: "This PDF has no pages.",
  },
  es: {
    password: "Este PDF necesita una contraseña para abrirse. Quita la contraseña primero y vuelve a intentarlo.",
    damaged: "Este archivo no se pudo leer. Puede estar dañado o no ser un PDF real.",
    empty: "Este PDF no tiene páginas.",
  },
};

/** Thrown by loadEditable with a friendly, complete sentence. */
export class PdfLoadError extends Error {
  constructor(
    public reason: "password" | "damaged" | "empty",
    locale: Locale = "en"
  ) {
    super(loadErrors[locale][reason]);
  }
}

/**
 * Open a PDF for page editing. Uses @cantoo/pdf-lib, which can decrypt files
 * that only carry a permissions (owner) password, so their pages copy over
 * readable. Files that need a password to open throw PdfLoadError("password").
 */
export async function loadEditable(data: ArrayBuffer | Uint8Array, locale: Locale = "en"): Promise<EditDoc> {
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  let doc: EditDoc;
  let count: number;
  try {
    doc = await PDFDocument.load(data, { ignoreEncryption: true, password: "", updateMetadata: false });
    count = doc.getPageCount();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password/i.test(msg)) throw new PdfLoadError("password", locale);
    throw new PdfLoadError("damaged", locale);
  }
  if (count === 0) throw new PdfLoadError("empty", locale);
  return doc;
}

/** A new, empty document that keeps the source's title and author. */
export async function createDoc(src?: EditDoc): Promise<EditDoc> {
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const out = await PDFDocument.create();
  const title = src?.getTitle();
  const author = src?.getAuthor();
  if (title) out.setTitle(title);
  if (author) out.setAuthor(author);
  return out;
}

/** Copy pages (0-based, in the given order) from src into a fresh PDF and save it. */
export async function pagesToPdf(src: EditDoc, indices: number[]): Promise<Uint8Array> {
  const out = await createDoc(src);
  const pages = await out.copyPages(src, indices);
  for (const p of pages) out.addPage(p);
  return out.save();
}

/* ------------------------------------------------------------------ */
/* Page ranges                                                         */
/* ------------------------------------------------------------------ */

export type PageRange = { start: number; end: number }; // 1-based, inclusive

const rangeErrors = {
  en: {
    bad: (p: string) => `"${p}" isn't a page or range. Use something like 1-3, 5, 8-.`,
    out: (p: string, n: number) => `"${p}" is outside this file's pages (1–${n}).`,
    backwards: (p: string) => `"${p}" runs backwards. Write the smaller number first.`,
    none: "Type at least one page number.",
  },
  es: {
    bad: (p: string) => `"${p}" no es una página ni un rango. Escribe algo como 1-3, 5, 8-.`,
    out: (p: string, n: number) => `"${p}" está fuera de las páginas de este archivo (1–${n}).`,
    backwards: (p: string) => `"${p}" va al revés. Escribe primero el número menor.`,
    none: "Escribe al menos un número de página.",
  },
};

/**
 * Parse "1-3, 5, 8-" into ranges, keeping the order and grouping the user
 * typed. "8-" means page 8 to the end; "-3" means pages 1 to 3.
 */
export function parseRanges(input: string, pageCount: number, locale: Locale = "en"): PageRange[] {
  const E = rangeErrors[locale];
  const out: PageRange[] = [];
  for (const raw of input.split(/[,;]/)) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(\d*)\s*(?:([-–—])\s*(\d*))?$/);
    if (!m || (!m[1] && !m[3])) throw new Error(E.bad(part));
    const start = m[1] ? parseInt(m[1], 10) : 1;
    const end = m[2] ? (m[3] ? parseInt(m[3], 10) : pageCount) : start;
    if (start > end) throw new Error(E.backwards(part));
    if (start < 1 || end > pageCount) throw new Error(E.out(part, pageCount));
    out.push({ start, end });
  }
  if (out.length === 0) throw new Error(E.none);
  return out;
}

/** Parse a page list into sorted, unique 0-based indices. */
export function parsePages(input: string, pageCount: number, locale: Locale = "en"): number[] {
  const set = new Set<number>();
  for (const r of parseRanges(input, pageCount, locale)) for (let p = r.start; p <= r.end; p++) set.add(p - 1);
  return [...set].sort((a, b) => a - b);
}

/** Format 0-based indices as "1-3, 5". */
export function formatPages(indices: Iterable<number>): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    let end = start;
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) end = sorted[++i];
    parts.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
  }
  return parts.join(", ");
}

/* ------------------------------------------------------------------ */
/* Lazy, progressive thumbnails                                        */
/* ------------------------------------------------------------------ */

const THUMB_ERROR = "error";

/**
 * Renders page thumbnails on demand, one at a time, so a 300-page file shows
 * its first pages right away and never renders pages nobody scrolls to.
 */
export class ThumbSource {
  readonly pageCount: number;
  private urls = new Map<number, string>();
  private listeners = new Set<() => void>();
  private queue: number[] = [];
  private running = false;
  private destroyed = false;

  constructor(
    private pdf: PdfDoc,
    private size = 200
  ) {
    this.pageCount = pdf.numPages;
  }

  static async fromFile(file: File, size?: number): Promise<ThumbSource> {
    const pdf = await openPdf(await file.arrayBuffer());
    return new ThumbSource(pdf, size);
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  get(index: number): string | undefined {
    return this.urls.get(index);
  }

  request(index: number) {
    if (this.destroyed || this.urls.has(index) || this.queue.includes(index)) return;
    this.queue.push(index);
    void this.pump();
  }

  forget(index: number) {
    const i = this.queue.indexOf(index);
    if (i >= 0) this.queue.splice(i, 1);
  }

  destroy() {
    this.destroyed = true;
    this.queue = [];
    for (const url of this.urls.values()) if (url !== THUMB_ERROR) URL.revokeObjectURL(url);
    this.urls.clear();
    void this.pdf.destroy();
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length && !this.destroyed) {
      const index = this.queue.shift()!;
      let url: string;
      try {
        url = await this.render(index);
      } catch {
        url = THUMB_ERROR;
      }
      if (this.destroyed) {
        if (url !== THUMB_ERROR) URL.revokeObjectURL(url);
        break;
      }
      this.urls.set(index, url);
      for (const fn of this.listeners) fn();
    }
    this.running = false;
  }

  private async render(index: number): Promise<string> {
    const page = await this.pdf.getPage(index + 1);
    const base = page.getViewport({ scale: 1 });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const scale = (this.size * dpr) / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    page.cleanup();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error("no blob");
    return URL.createObjectURL(blob);
  }
}

/** A square box that renders one page thumbnail when it scrolls into view. */
export function PageThumb({
  source,
  index,
  rotation = 0,
  alt,
  dim = false,
}: {
  source: ThumbSource;
  index: number;
  rotation?: number;
  alt: string;
  dim?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const url = useSyncExternalStore(
    source.subscribe,
    () => source.get(index),
    () => undefined
  );

  useEffect(() => {
    if (url) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) source.request(index);
          else source.forget(index);
        }
      },
      { rootMargin: "300px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [source, index, url]);

  return (
    <div
      ref={ref}
      className="aspect-square w-full flex items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800 p-1.5"
    >
      {url && url !== THUMB_ERROR ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          draggable={false}
          className={`max-w-full max-h-full object-contain shadow-sm ring-1 ring-black/10 transition-[transform,opacity] duration-200 select-none ${dim ? "opacity-30" : ""}`}
          style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined }}
        />
      ) : url === THUMB_ERROR ? (
        <span className="text-xs text-zinc-400 text-center px-2">{alt}</span>
      ) : (
        <span className="h-5 w-5 rounded-full border-2 border-zinc-300 border-t-red-500 animate-spin" aria-hidden="true" />
      )}
    </div>
  );
}

/** Open a ThumbSource for a file and destroy it when the file changes. */
export function useThumbSource(file: File | null): { source: ThumbSource | null; error: string | null } {
  const [state, setState] = useState<{ file: File | null; source: ThumbSource | null; error: string | null }>({
    file: null,
    source: null,
    error: null,
  });
  useEffect(() => {
    if (!file) return;
    let src: ThumbSource | null = null;
    let cancelled = false;
    ThumbSource.fromFile(file)
      .then((s) => {
        if (cancelled) return s.destroy();
        src = s;
        setState({ file, source: s, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ file, source: null, error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
      src?.destroy();
    };
  }, [file]);
  if (!file || state.file !== file) return { source: null, error: null };
  return { source: state.source, error: state.error };
}

/* ------------------------------------------------------------------ */
/* Pointer reorder (mouse, pen and touch)                              */
/* ------------------------------------------------------------------ */

type DragState = { from: number; over: number };

/**
 * Drag-to-reorder built on pointer events, so it also works on iPhone and
 * Android where HTML5 drag-and-drop doesn't. Put `data-sort-index={i}` on each
 * item. `handle(i)` goes on a grip (works with touch); `item(i)` makes the
 * whole item draggable with a mouse only, so touch users can still scroll.
 */
export function usePointerSort(onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const st = useRef<{ from: number; over: number; x: number; y: number; active: boolean; id: number } | null>(null);

  const begin = useCallback((index: number, e: ReactPointerEvent<HTMLElement>) => {
    st.current = { from: index, over: index, x: e.clientX, y: e.clientY, active: false, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const s = st.current;
    if (!s || s.id !== e.pointerId) return;
    if (!s.active) {
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return;
      s.active = true;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-sort-index]");
    if (el?.dataset.sortIndex) s.over = Number(el.dataset.sortIndex);
    setDrag({ from: s.from, over: s.over });
    const edge = 64;
    if (e.clientY < edge) window.scrollBy(0, -16);
    else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 16);
  }, []);

  const finish = useCallback(
    (e: ReactPointerEvent<HTMLElement>, commit: boolean) => {
      const s = st.current;
      if (!s || s.id !== e.pointerId) return;
      st.current = null;
      setDrag(null);
      if (commit && s.active && s.over !== s.from) onMove(s.from, s.over);
    },
    [onMove]
  );

  const common = {
    onPointerMove,
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => finish(e, false),
  };

  const handle = (index: number) => ({
    ...common,
    style: { touchAction: "none" as const },
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      begin(index, e);
    },
  });

  const item = (index: number) => ({
    ...common,
    "data-sort-index": index,
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button, input, a, label")) return;
      begin(index, e);
    },
  });

  return { drag, handle, item };
}

/** Move an array item, returning a new array. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}
