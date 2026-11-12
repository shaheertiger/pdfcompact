"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { ResultFile } from "@/components/ui/kit";
import { baseName, isPdf, pdfBlob } from "@/lib/download";
import { loadEditable, tick } from "@/lib/pdf-stamp";
import { applyPlacements, onPage, type ImageSource, type Placed } from "@/lib/placements";
import PageStage, { type StagePoint } from "./PageStage";
import { PlacedView, fromStage, toStage, type Fonts } from "./placed";
import { usePageRender, usePdfDoc } from "./usePdfPreview";

/** File loading, page navigation, placed items, undo and saving, shared by the place-on-page tools. */
export function usePlacementEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPageState] = useState(1);
  const [items, setItemsState] = useState<Placed[]>([]);
  const [history, setHistory] = useState<Placed[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultFile | null>(null);

  const { pdf, error: pdfError, loading } = usePdfDoc(bytes);
  const numPages = pdf?.numPages ?? 0;
  const { render } = usePageRender(pdf, Math.min(page, Math.max(1, numPages)), 900);

  const reset = useCallback(() => {
    setFile(null);
    setBytes(null);
    setLoadError(null);
    setItemsState([]);
    setHistory([]);
    setSelectedId(null);
    setResult(null);
    setError(null);
    setPageState(1);
  }, []);

  const onFiles = useCallback(
    async (files: File[]) => {
      const f = files[0];
      reset();
      if (!isPdf(f)) {
        setLoadError("That isn't a PDF. Choose a .pdf file.");
        return;
      }
      try {
        const b = new Uint8Array(await f.arrayBuffer());
        await loadEditable(b);
        setFile(f);
        setBytes(b);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    },
    [reset]
  );

  /** Record a snapshot for undo, then change items. */
  const commit = useCallback((next: (prev: Placed[]) => Placed[]) => {
    setItemsState((prev) => {
      setHistory((h) => (h[h.length - 1] === prev ? h : [...h.slice(-49), prev]));
      return next(prev);
    });
  }, []);

  const add = useCallback(
    (item: Placed) => {
      commit((prev) => [...prev, item]);
      setSelectedId(item.id);
    },
    [commit]
  );

  /** Live update (drag, slider) without an undo step per frame. */
  const update = useCallback((id: string, patch: Partial<Placed>) => {
    setItemsState((prev) => prev.map((i) => (i.id === id ? ({ ...i, ...patch } as Placed) : i)));
  }, []);

  const remove = useCallback(
    (id: string) => {
      commit((prev) => prev.filter((i) => i.id !== id));
      setSelectedId(null);
    },
    [commit]
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      setItemsState(h[h.length - 1]);
      setSelectedId(null);
      return h.slice(0, -1);
    });
  }, []);

  /** Snapshot before a drag starts so the whole drag is one undo step. */
  const snapshot = useCallback(() => {
    setItemsState((prev) => {
      setHistory((h) => (h[h.length - 1] === prev ? h : [...h.slice(-49), prev]));
      return prev;
    });
  }, []);

  const setPage = (p: number) => {
    setPageState(p);
    setSelectedId(null);
  };

  const save = async (images: Record<string, ImageSource>, suffix: string, prepare?: (items: Placed[]) => Promise<{ items: Placed[]; images: Record<string, ImageSource> }>) => {
    if (!bytes || !file) return;
    setBusy(true);
    setError(null);
    setProgress(0.05);
    try {
      let list = items;
      let imgs = images;
      if (prepare) {
        const r = await prepare(items);
        list = r.items;
        imgs = { ...images, ...r.images };
      }
      const doc = await loadEditable(bytes);
      setProgress(0.15);
      await applyPlacements(doc, list, imgs, async (done, total) => {
        setProgress(0.15 + (done / total) * 0.7);
        await tick();
      });
      const out = await doc.save();
      setProgress(1);
      setResult({ blob: pdfBlob(out), name: `${baseName(file.name)}-${suffix}.pdf` });
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while saving the PDF.");
    } finally {
      setBusy(false);
    }
  };

  const selected = items.find((i) => i.id === selectedId) ?? null;

  return {
    file,
    loadError,
    onFiles,
    reset,
    pdf,
    pdfError,
    loading,
    numPages,
    page: Math.min(page, Math.max(1, numPages)),
    setPage,
    render,
    items,
    add,
    update,
    remove,
    undo,
    canUndo: history.length > 0,
    snapshot,
    selected,
    selectedId,
    setSelectedId,
    busy,
    progress,
    error,
    setError,
    result,
    setResult,
    save,
  };
}

export type PlacementEditor = ReturnType<typeof usePlacementEditor>;

/** The page with the editor's items on it. */
export function PlacementStage({
  ed,
  imageUrls,
  fonts,
  captureStage,
  onStageDown,
  onStageMove,
  onStageUp,
  overlay,
  labelFor,
}: {
  ed: PlacementEditor;
  imageUrls: Record<string, string>;
  fonts: Fonts | null;
  captureStage?: boolean;
  onStageDown?: (p: StagePoint, W: number, H: number) => void;
  onStageMove?: (p: StagePoint, W: number, H: number) => void;
  onStageUp?: (p: StagePoint, W: number, H: number) => void;
  overlay?: (pxPerPt: number) => ReactNode;
  labelFor?: (p: Placed) => string | undefined;
}) {
  const r = ed.render;
  if (!r) return <div className="aspect-[3/4] w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" aria-label="Loading page" />;
  const W = r.ptWidth;
  const H = r.ptHeight;
  const visible = ed.items.filter((i) => onPage(i.target, ed.page - 1)).map((p) => toStage(p, W, H, fonts, labelFor?.(p)));
  return (
    <PageStage
      imageUrl={r.url}
      ptWidth={W}
      ptHeight={H}
      items={visible}
      selectedId={ed.selectedId}
      onSelect={(id) => {
        if (id) ed.snapshot();
        ed.setSelectedId(id);
      }}
      onChange={(id, patch) => {
        const p = ed.items.find((i) => i.id === id);
        if (p) ed.update(id, fromStage(p, patch, W, H, fonts));
      }}
      onRemove={ed.remove}
      renderItem={(it, pxPerPt) => <PlacedView p={it.placed} W={W} pxPerPt={pxPerPt} imageUrls={imageUrls} fonts={fonts} />}
      captureStage={captureStage}
      onStageDown={onStageDown && ((p) => onStageDown(p, W, H))}
      onStageMove={onStageMove && ((p) => onStageMove(p, W, H))}
      onStageUp={onStageUp && ((p) => onStageUp(p, W, H))}
      overlay={overlay}
      pageLabel={`Page ${ed.page} of ${ed.numPages}`}
    />
  );
}
