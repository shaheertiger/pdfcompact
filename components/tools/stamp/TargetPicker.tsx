"use client";

import { useState } from "react";
import { parsePageList } from "@/lib/download";
import type { Target } from "@/lib/placements";

/** "This page / Every page / These pages" for a placed item. */
export default function TargetPicker({
  target,
  current,
  count,
  onChange,
}: {
  target: Target;
  /** 0-based current page. */
  current: number;
  count: number;
  onChange: (t: Target) => void;
}) {
  const [text, setText] = useState(target.mode === "list" ? toText(target.pages) : "");
  const [error, setError] = useState<string | null>(null);
  const mode = target.mode;
  const btn = (active: boolean) =>
    `h-10 rounded-full border px-3 text-sm ${
      active ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300" : "border-black/10 dark:border-white/15 hover:border-red-300"
    }`;

  const apply = (v: string) => {
    setText(v);
    try {
      const pages = parsePageList(v, count);
      if (!pages.length) throw new Error("Type at least one page.");
      setError(null);
      onChange({ mode: "list", pages });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (count <= 1) return null;
  return (
    <fieldset>
      <legend className="text-sm font-medium mb-2">Put it on</legend>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={mode === "one"} className={btn(mode === "one")} onClick={() => onChange({ mode: "one", page: current })}>
          This page
        </button>
        <button type="button" aria-pressed={mode === "all"} className={btn(mode === "all")} onClick={() => onChange({ mode: "all" })}>
          Every page
        </button>
        <button
          type="button"
          aria-pressed={mode === "list"}
          className={btn(mode === "list")}
          onClick={() => apply(text || (count > 1 ? `1-${count}` : "1"))}
        >
          Some pages
        </button>
      </div>
      {mode === "list" && (
        <label className="mt-2 grid gap-1 text-sm">
          <span className="sr-only">Pages</span>
          <input
            value={text}
            onChange={(e) => apply(e.target.value)}
            placeholder={`e.g. 1-${count}`}
            className="h-11 rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-zinc-900 px-3 text-sm"
          />
          {error ? <span className="text-xs text-red-600">{error}</span> : <span className="text-xs text-zinc-500">Pages like 1-3, 5. Same spot on each page.</span>}
        </label>
      )}
    </fieldset>
  );
}

function toText(pages: number[]): string {
  return pages.map((p) => p + 1).join(", ");
}
