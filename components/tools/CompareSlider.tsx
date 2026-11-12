"use client";

import { useState } from "react";

/**
 * Before/after viewer: the compressed image sits on top of the original and
 * is revealed up to the slider. "Zoom 2×" scales both together, so they stay
 * aligned and compression artefacts become visible.
 */
export default function CompareSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Original",
  afterLabel = "Compressed",
  aspect,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** width / height */
  aspect: number;
}) {
  const [pos, setPos] = useState(50);
  const [zoom, setZoom] = useState(1);
  return (
    <div>
      <div
        className="relative w-full overflow-hidden rounded-lg bg-[repeating-conic-gradient(#e4e4e7_0%_25%,#fff_0%_50%)] dark:bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)] [background-size:16px_16px] select-none"
        style={{ aspectRatio: String(aspect), maxHeight: "70vh" }}
      >
        <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beforeUrl} alt={beforeLabel} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={afterUrl}
            alt={afterLabel}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
            draggable={false}
          />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]" style={{ left: `${pos}%` }} />
        <span className="pointer-events-none absolute top-2 left-2 rounded bg-zinc-900/75 px-2 py-0.5 text-xs text-white">{afterLabel}</span>
        <span className="pointer-events-none absolute top-2 right-2 rounded bg-zinc-900/75 px-2 py-0.5 text-xs text-white">{beforeLabel}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <label className="flex-1">
          <span className="sr-only">Move the comparison divider</span>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            className="w-full accent-red-600 h-10"
          />
        </label>
        <button
          type="button"
          aria-pressed={zoom > 1}
          onClick={() => setZoom((z) => (z > 1 ? 1 : 2.5))}
          className={`min-h-10 rounded-full border px-4 text-sm ${zoom > 1 ? "border-red-500 text-red-700 dark:text-red-300" : "border-black/15 dark:border-white/15"}`}
        >
          Zoom in
        </button>
      </div>
    </div>
  );
}
