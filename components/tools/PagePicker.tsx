"use client";

/**
 * Thumbnail grid + "pages" text box that stay in sync. Shared by
 * Delete PDF Pages and Extract PDF Pages.
 */

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Check, Trash2 } from "lucide-react";
import { formatPages, parsePages, PageThumb, type ThumbSource } from "@/lib/page-tools";

export function usePageSelection(pageCount: number) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [text, setText] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const last = useRef<number | null>(null);

  const apply = useCallback((next: Set<number>) => {
    setSelected(next);
    setText(formatPages(next));
    setTextError(null);
  }, []);

  const toggle = useCallback(
    (index: number, shift = false) => {
      const next = new Set(selected);
      if (shift && last.current !== null && last.current !== index) {
        // Shift-click sets the whole run to match the anchor page.
        const on = selected.has(last.current);
        const [a, b] = last.current < index ? [last.current, index] : [index, last.current];
        for (let i = a; i <= b; i++) {
          if (on) next.add(i);
          else next.delete(i);
        }
      } else if (next.has(index)) next.delete(index);
      else next.add(index);
      last.current = index;
      apply(next);
    },
    [selected, apply]
  );

  const onText = useCallback(
    (value: string) => {
      setText(value);
      if (!value.trim()) {
        setSelected(new Set());
        setTextError(null);
        return;
      }
      try {
        setSelected(new Set(parsePages(value, pageCount)));
        setTextError(null);
      } catch (e) {
        setTextError(e instanceof Error ? e.message : String(e));
      }
    },
    [pageCount]
  );

  const reset = useCallback(() => {
    setSelected(new Set());
    setText("");
    setTextError(null);
    last.current = null;
  }, []);

  return { selected, text, textError, toggle, onText, apply, reset };
}

export function QuickPick({
  pageCount,
  onPick,
  includeAll,
}: {
  pageCount: number;
  onPick: (s: Set<number>) => void;
  includeAll?: boolean;
}) {
  const range = (pred: (i: number) => boolean) =>
    new Set(Array.from({ length: pageCount }, (_, i) => i).filter(pred));
  const btn = (label: string, s: Set<number>) => (
    <button
      type="button"
      onClick={() => onPick(s)}
      className="min-h-10 rounded-full border border-black/15 dark:border-white/20 px-3.5 text-sm hover:border-red-400 hover:text-red-600"
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {includeAll && btn("All", range(() => true))}
      {btn("Odd pages", range((i) => i % 2 === 0))}
      {btn("Even pages", range((i) => i % 2 === 1))}
      {btn("Clear", new Set())}
    </div>
  );
}

export function PageGrid({
  source,
  selected,
  onToggle,
  variant,
}: {
  source: ThumbSource;
  selected: Set<number>;
  onToggle: (index: number, shift: boolean) => void;
  variant: "delete" | "select";
}) {
  const cells: ReactNode[] = [];
  for (let i = 0; i < source.pageCount; i++) {
    const on = selected.has(i);
    const label =
      variant === "delete"
        ? `Page ${i + 1}${on ? ", marked for deletion" : ""}`
        : `Page ${i + 1}${on ? ", selected" : ""}`;
    cells.push(
      <li key={i}>
        <button
          type="button"
          aria-pressed={on}
          aria-label={label}
          onClick={(e) => onToggle(i, e.shiftKey)}
          className={`relative block w-full rounded-lg border-2 p-0.5 transition-colors ${
            on
              ? variant === "delete"
                ? "border-red-500 bg-red-50 dark:bg-red-500/10"
                : "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
              : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
          }`}
        >
          <PageThumb source={source} index={i} alt={`Page ${i + 1}`} dim={on && variant === "delete"} />
          <span
            className={`absolute left-1.5 bottom-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
              on ? (variant === "delete" ? "bg-red-600 text-white" : "bg-emerald-600 text-white") : "bg-black/70 text-white"
            }`}
          >
            {i + 1}
          </span>
          {on && (
            <span
              className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white ${
                variant === "delete" ? "bg-red-600" : "bg-emerald-600"
              }`}
              aria-hidden="true"
            >
              {variant === "delete" ? <Trash2 className="h-3.5 w-3.5" /> : <Check className="h-4 w-4" />}
            </span>
          )}
        </button>
      </li>
    );
  }
  return <ul className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 sm:gap-2">{cells}</ul>;
}

/** Sticky footer that keeps the main action in reach while scrolling a long grid. */
export function StickyBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-3 sm:-mx-8 mt-4 border-t border-black/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-3 sm:px-8 py-3">
      {children}
    </div>
  );
}
