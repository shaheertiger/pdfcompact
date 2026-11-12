"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import ToolIcon from "@/components/ToolIcon";
import { registry, groups } from "@/lib/registry";

const POPULAR = ["compress-pdf", "merge-pdf", "split-pdf", "pdf-to-word", "jpg-to-pdf", "ocr-pdf"];

/**
 * Phone menu: a full-height sheet under the header. It closes when you pick a
 * link, navigate, press Escape or tap the X. The page behind can't scroll
 * while it's open. Open state is tied to the path it was opened on, so any
 * navigation closes it without an effect.
 */
export default function MobileMenu() {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const open = openOn === pathname;
  const panelId = useId();

  const close = () => {
    setOpenOn(null);
    setQuery("");
  };

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenOn(null);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const needle = query.trim().toLowerCase();
  const matches = (t: (typeof registry)[number]) =>
    !needle || `${t.name} ${t.short}`.toLowerCase().includes(needle);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => (open ? close() : setOpenOn(pathname))}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-11 w-11 -mr-2 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
      >
        {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
      </button>

      {open && (
        <div
          id={panelId}
          className="fixed inset-x-0 top-14 bottom-0 z-50 overflow-y-auto overscroll-contain bg-white dark:bg-zinc-950 border-t border-black/10 dark:border-white/10"
        >
          <div className="px-4 pt-4 pb-10">
            <label className="relative block">
              <span className="sr-only">Find a tool</span>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a tool…"
                className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 pl-11 pr-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </label>

            {!needle && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Popular</div>
                <div className="flex flex-wrap gap-2">
                  {POPULAR.map((slug) => {
                    const t = registry.find((x) => x.slug === slug)!;
                    return (
                      <Link
                        key={slug}
                        href={`/${slug}`}
                        onClick={close}
                        className="inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium"
                      >
                        <ToolIcon name={t.icon} className="h-4 w-4" />
                        {t.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {groups.map((g) => {
              const tools = registry.filter((t) => t.group === g.id && matches(t));
              if (tools.length === 0) return null;
              return (
                <section key={g.id} className="mt-6">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">{g.name}</h2>
                  <ul className="grid grid-cols-2 gap-x-2">
                    {tools.map((t) => (
                      <li key={t.slug}>
                        <Link
                          href={`/${t.slug}`}
                          onClick={close}
                          aria-current={pathname === `/${t.slug}` ? "page" : undefined}
                          className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm leading-tight hover:bg-black/5 dark:hover:bg-white/10 aria-[current=page]:bg-red-50 aria-[current=page]:text-red-700 dark:aria-[current=page]:bg-red-500/10 dark:aria-[current=page]:text-red-300"
                        >
                          <ToolIcon name={t.icon} className="h-4 w-4 shrink-0 text-red-600" />
                          <span>{t.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            {needle && !registry.some(matches) && (
              <p className="mt-6 text-sm text-zinc-500">No tool matches “{query}”.</p>
            )}

            <nav aria-label="Company" className="mt-8 pt-5 border-t border-black/10 dark:border-white/10 flex flex-wrap gap-x-5 gap-y-3 text-sm">
              {[
                ["/how-it-works", "How it works"],
                ["/about", "About"],
                ["/contact", "Contact"],
                ["/es", "Español"],
              ].map(([href, label]) => (
                <Link key={href} href={href} onClick={close} className="text-zinc-600 dark:text-zinc-400 hover:text-red-600">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
