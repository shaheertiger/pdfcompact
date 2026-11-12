"use client";

import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Filters the server-rendered tool grid in place. Every tool link stays in the
 * HTML for crawlers; this only toggles visibility.
 */
export default function ToolFilter() {
  const [q, setQ] = useState("");

  const apply = (value: string) => {
    setQ(value);
    const needle = value.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>("[data-tool]").forEach((el) => {
      el.hidden = Boolean(needle) && !el.dataset.tool!.includes(needle);
    });
    document.querySelectorAll<HTMLElement>("[data-group]").forEach((g) => {
      g.hidden = Boolean(needle) && !g.querySelector("[data-tool]:not([hidden])");
    });
  };

  return (
    <label className="relative block max-w-xl mx-auto">
      <span className="sr-only">Find a PDF tool</span>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" aria-hidden="true" />
      <input
        type="search"
        value={q}
        onChange={(e) => apply(e.target.value)}
        placeholder="Find a tool…"
        className="w-full rounded-full border border-black/15 dark:border-white/15 bg-white dark:bg-zinc-900 pl-12 pr-4 py-2.5 sm:py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
      />
    </label>
  );
}
