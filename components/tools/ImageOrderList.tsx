"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, RotateCw, X } from "lucide-react";
import { formatBytes } from "@/lib/download";

export type OrderItem = {
  id: string;
  file: File;
  /** Object URL for the thumbnail, or null when the browser can't preview this format (HEIC). */
  url: string | null;
  rotation: 0 | 90 | 180 | 270;
};

/**
 * Thumbnail grid with drag-to-reorder (mouse), arrow buttons (touch and
 * keyboard), a per-image rotate button and remove.
 */
export default function ImageOrderList({
  items,
  onChange,
  onRemove,
  canRotate = true,
}: {
  items: OrderItem[];
  onChange: (items: OrderItem[]) => void;
  onRemove: (id: string) => void;
  canRotate?: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  const rotate = (id: string) =>
    onChange(items.map((it) => (it.id === id ? { ...it, rotation: (((it.rotation + 90) % 360) as OrderItem["rotation"]) } : it)));

  return (
    <ol className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" aria-label="Pages in order">
      {items.map((it, i) => (
        <li
          key={it.id}
          draggable
          onDragStart={(e) => {
            setDragIndex(i);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIndex(i);
          }}
          onDragLeave={() => setOverIndex((o) => (o === i ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null) move(dragIndex, i);
            setDragIndex(null);
            setOverIndex(null);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
          }}
          className={`rounded-lg border bg-zinc-50 dark:bg-zinc-800/50 p-2 flex flex-col gap-2 cursor-grab active:cursor-grabbing ${
            overIndex === i && dragIndex !== i ? "border-red-500" : "border-black/10 dark:border-white/10"
          } ${dragIndex === i ? "opacity-50" : ""}`}
        >
          <div className="relative aspect-square overflow-hidden rounded bg-white dark:bg-zinc-900 flex items-center justify-center">
            {it.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.url}
                alt={`Page ${i + 1}: ${it.file.name}`}
                draggable={false}
                className="max-h-full max-w-full object-contain transition-transform"
                style={{ transform: `rotate(${it.rotation}deg)` }}
              />
            ) : (
              <span className="flex flex-col items-center gap-1 text-xs text-zinc-500" style={{ transform: `rotate(${it.rotation}deg)` }}>
                <ImageIcon className="h-8 w-8" aria-hidden="true" />
                {it.file.name.split(".").pop()?.toUpperCase()}
              </span>
            )}
            <span className="absolute top-1 left-1 h-6 min-w-6 px-1.5 rounded-full bg-zinc-900/75 text-white text-xs font-semibold flex items-center justify-center">
              {i + 1}
            </span>
          </div>
          <p className="text-xs truncate" title={it.file.name}>
            {it.file.name} <span className="text-zinc-500">· {formatBytes(it.file.size)}</span>
          </p>
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => move(i, i - 1)}
              disabled={i === 0}
              className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30"
              aria-label={`Move ${it.file.name} earlier`}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            {canRotate && (
              <button
                type="button"
                onClick={() => rotate(it.id)}
                className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700"
                aria-label={`Rotate ${it.file.name} 90° clockwise`}
              >
                <RotateCw className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemove(it.id)}
              className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-red-600"
              aria-label={`Remove ${it.file.name}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => move(i, i + 1)}
              disabled={i === items.length - 1}
              className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30"
              aria-label={`Move ${it.file.name} later`}
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
