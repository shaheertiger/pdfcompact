"use client";

import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";

/**
 * Something placed on the page. Positions and sizes are in display-space PDF
 * points (top-left origin), so they map straight to lib/pdf-stamp helpers.
 */
export type StageItem = {
  id: string;
  x: number;
  y: number;
  /** Omit w/h for items that size themselves (text). */
  w?: number;
  h?: number;
  /** Lock w/h to this ratio while resizing. */
  aspect?: number;
  resizable?: boolean;
  label: string;
};

export type StagePoint = { x: number; y: number };

/**
 * A rendered PDF page with draggable, resizable items on top. Works with
 * mouse, pen and touch (pointer events). Dragging an item never scrolls the
 * page; dragging empty page space scrolls normally unless a draw/place mode
 * captures it.
 */
export default function PageStage<T extends StageItem>({
  imageUrl,
  ptWidth,
  ptHeight,
  items,
  selectedId,
  onSelect,
  onChange,
  onRemove,
  renderItem,
  captureStage = false,
  onStageDown,
  onStageMove,
  onStageUp,
  overlay,
  pageLabel,
}: {
  imageUrl: string;
  ptWidth: number;
  ptHeight: number;
  items: T[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<T>) => void;
  onRemove?: (id: string) => void;
  renderItem: (item: T, pxPerPt: number) => ReactNode;
  /** When true, pointer gestures on empty page space go to onStage* instead of scrolling. */
  captureStage?: boolean;
  onStageDown?: (p: StagePoint) => void;
  onStageMove?: (p: StagePoint) => void;
  onStageUp?: (p: StagePoint) => void;
  /** Extra layer drawn above the page (previews), receives px-per-point. */
  overlay?: (pxPerPt: number) => ReactNode;
  pageLabel: string;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [cssWidth, setCssWidth] = useState(0);
  const gesture = useRef<
    | { kind: "move"; id: string; sx: number; sy: number; ox: number; oy: number; pid: number; moved: boolean }
    | { kind: "resize"; id: string; sx: number; sy: number; ow: number; oh: number; aspect?: number; pid: number }
    | { kind: "stage"; pid: number }
    | null
  >(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCssWidth(el.clientWidth));
    ro.observe(el);
    setCssWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const pxPerPt = cssWidth > 0 ? cssWidth / ptWidth : 1;

  const toPt = (clientX: number, clientY: number): StagePoint => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: Math.min(ptWidth, Math.max(0, ((clientX - r.left) / r.width) * ptWidth)),
      y: Math.min(ptHeight, Math.max(0, ((clientY - r.top) / r.height) * ptHeight)),
    };
  };

  const clampPos = (item: T, x: number, y: number) => {
    // Keep sized items fully on the page; self-sizing items keep their anchor on it.
    const w = item.w ?? 12;
    const h = item.h ?? 12;
    const lo = (size: number, max: number) => Math.min(0, max - size);
    const hi = (size: number, max: number) => Math.max(0, max - size);
    return {
      x: Math.min(hi(w, ptWidth), Math.max(lo(w, ptWidth), x)),
      y: Math.min(hi(h, ptHeight), Math.max(lo(h, ptHeight), y)),
    };
  };

  const startMove = (item: T, e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(item.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { kind: "move", id: item.id, sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y, pid: e.pointerId, moved: false };
  };

  const startResize = (item: T, e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = {
      kind: "resize",
      id: item.id,
      sx: e.clientX,
      sy: e.clientY,
      ow: item.w ?? 50,
      oh: item.h ?? 50,
      aspect: item.aspect,
      pid: e.pointerId,
    };
  };

  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || g.pid !== e.pointerId) return;
    if (g.kind === "stage") {
      onStageMove?.(toPt(e.clientX, e.clientY));
      return;
    }
    const item = items.find((i) => i.id === g.id);
    if (!item) return;
    const dx = (e.clientX - g.sx) / pxPerPt;
    const dy = (e.clientY - g.sy) / pxPerPt;
    if (g.kind === "move") {
      if (Math.abs(e.clientX - g.sx) + Math.abs(e.clientY - g.sy) > 2) g.moved = true;
      onChange(g.id, clampPos(item, g.ox + dx, g.oy + dy) as Partial<T>);
    } else {
      const minPt = 8;
      let w = Math.max(minPt, g.ow + dx);
      let h = Math.max(minPt, g.oh + dy);
      if (g.aspect) {
        // Follow whichever axis moved further, keep the ratio.
        if (Math.abs(dx) * (g.oh / g.ow) >= Math.abs(dy)) h = w / g.aspect;
        else w = h * g.aspect;
        if (w < minPt) {
          w = minPt;
          h = w / g.aspect;
        }
      }
      w = Math.min(w, ptWidth * 1.5);
      h = Math.min(h, ptHeight * 1.5);
      onChange(g.id, { w, h } as Partial<T>);
    }
  };

  const onUp = (e: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || g.pid !== e.pointerId) return;
    gesture.current = null;
    if (g.kind === "stage") onStageUp?.(toPt(e.clientX, e.clientY));
  };

  const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (captureStage) {
      e.currentTarget.setPointerCapture(e.pointerId);
      gesture.current = { kind: "stage", pid: e.pointerId };
      onStageDown?.(toPt(e.clientX, e.clientY));
    } else {
      onSelect(null);
    }
  };

  const onKey = (item: T, e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      onChange(item.id, clampPos(item, item.x + dx, item.y + dy) as Partial<T>);
    } else if ((e.key === "Delete" || e.key === "Backspace") && onRemove && e.target === e.currentTarget) {
      e.preventDefault();
      onRemove(item.id);
    }
  };

  return (
    <div className="overflow-hidden p-4 -mx-2 sm:mx-0">
    <div
      ref={boxRef}
      className="relative mx-auto w-full select-none rounded-sm outline outline-1 outline-black/15 dark:outline-white/20 bg-white shadow-sm"
      style={{
        aspectRatio: `${ptWidth} / ${ptHeight}`,
        touchAction: captureStage ? "none" : "auto",
        cursor: captureStage ? "crosshair" : "default",
      }}
      onPointerDown={onStagePointerDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={pageLabel} draggable={false} className="absolute inset-0 h-full w-full pointer-events-none" />
      {cssWidth > 0 && overlay?.(pxPerPt)}
      {cssWidth > 0 &&
        items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`${item.label}. Drag to move${item.resizable ? ", drag the corner to resize" : ""}. Arrow keys nudge it.`}
              aria-pressed={selected}
              onPointerDown={(e) => startMove(item, e)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onKeyDown={(e) => onKey(item, e)}
              onFocus={() => onSelect(item.id)}
              className={`absolute cursor-move outline-none ${
                selected ? "ring-2 ring-red-500 ring-offset-1 ring-offset-transparent" : "hover:ring-1 hover:ring-red-400/70"
              }`}
              style={{
                left: item.x * pxPerPt,
                top: item.y * pxPerPt,
                width: item.w !== undefined ? item.w * pxPerPt : undefined,
                height: item.h !== undefined ? item.h * pxPerPt : undefined,
                touchAction: "none",
              }}
            >
              {/* Invisible margin so small items (a line of text) are easy to grab with a finger. */}
              <span aria-hidden="true" className="absolute -inset-2.5 sm:-inset-1.5" />
              {renderItem(item, pxPerPt)}
              {selected && onRemove && (
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  className="absolute -top-5 -right-5 h-10 w-10 flex items-center justify-center"
                >
                  <span className="h-6 w-6 rounded-full bg-zinc-900/85 text-white flex items-center justify-center shadow">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </button>
              )}
              {selected && item.resizable && (
                <span
                  aria-hidden="true"
                  onPointerDown={(e) => startResize(item, e)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  className="absolute -bottom-5 -right-5 h-10 w-10 flex items-center justify-center cursor-nwse-resize"
                  style={{ touchAction: "none" }}
                >
                  <span className="h-5 w-5 rounded-full border-2 border-white bg-red-600 shadow" />
                </span>
              )}
            </div>
          );
        })}
    </div>
    </div>
  );
}

/** Previous / next page control with ≥40px targets. */
export function PageNav({
  page,
  count,
  onChange,
  extra,
}: {
  page: number;
  count: number;
  onChange: (p: number) => void;
  extra?: ReactNode;
}) {
  if (count <= 1) return extra ? <div className="text-xs text-zinc-500 text-center mt-2">{extra}</div> : null;
  return (
    <div className="flex items-center justify-center gap-2 mt-3 text-sm">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="h-10 min-w-10 px-3 rounded-full border border-black/10 dark:border-white/15 disabled:opacity-30 hover:border-red-400"
        aria-label="Previous page"
      >
        ‹
      </button>
      <label className="flex items-center gap-1.5">
        <span className="sr-only">Page</span>
        <select
          value={page}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="h-10 rounded-full border border-black/10 dark:border-white/15 bg-white dark:bg-zinc-900 px-3"
        >
          {Array.from({ length: count }, (_, i) => (
            <option key={i} value={i + 1}>
              Page {i + 1}
            </option>
          ))}
        </select>
        <span className="text-zinc-500">of {count}</span>
      </label>
      <button
        type="button"
        onClick={() => onChange(Math.min(count, page + 1))}
        disabled={page >= count}
        className="h-10 min-w-10 px-3 rounded-full border border-black/10 dark:border-white/15 disabled:opacity-30 hover:border-red-400"
        aria-label="Next page"
      >
        ›
      </button>
      {extra}
    </div>
  );
}
