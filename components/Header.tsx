import Link from "next/link";
import { registry, groups } from "@/lib/registry";
import ToolIcon from "@/components/ToolIcon";
import MobileMenu from "@/components/MobileMenu";

function ToolMenu({ columns }: { columns: string }) {
  return (
    <div className={`grid gap-x-6 gap-y-5 ${columns}`}>
      {groups.map((g) => (
        <div key={g.id}>
          <Link href={`/#${g.id}`} className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:text-red-600 mb-1.5">
            {g.name}
          </Link>
          <ul className="grid gap-0.5">
            {registry
              .filter((t) => t.group === g.id)
              .map((t) => (
                <li key={t.slug}>
                  <Link
                    href={`/${t.slug}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <ToolIcon name={t.icon} className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{t.name}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function Header() {
  return (
    <header className="border-b border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
        <Link href="/" className="font-bold text-lg shrink-0" aria-label="PDFCompact home">
          PDF<span className="text-red-600">Compact</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm" aria-label="Main">
          <div className="group relative">
            <Link href="/#tools" className="block px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 font-medium">
              All PDF tools
            </Link>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-full pt-2 w-[min(56rem,90vw)]">
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-xl p-5">
                <ToolMenu columns="grid-cols-3" />
              </div>
            </div>
          </div>
          <Link href="/compress-pdf" className="px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 font-medium">Compress</Link>
          <Link href="/merge-pdf" className="px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 font-medium">Merge</Link>
          <Link href="/ocr-pdf" className="px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 font-medium">OCR</Link>
          <Link href="/how-it-works" className="px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 font-medium">How it works</Link>
        </nav>

        <MobileMenu />
      </div>
    </header>
  );
}
