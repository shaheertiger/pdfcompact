import Link from "next/link";
import { tools } from "@/lib/tools";

export default function Header() {
  return (
    <header className="border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-black/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <span className="text-2xl leading-none">📎</span>
          <span>
            PDF<span className="text-red-600">Compact</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <div className="group relative">
            <button className="px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 font-medium">
              Tools
            </button>
            <div className="invisible group-hover:visible group-focus-within:visible absolute left-0 top-full pt-2 w-64">
              <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-lg p-2 grid gap-0.5">
                {tools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <span>{tool.icon}</span>
                    <span>{tool.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <Link href="/about" className="px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 font-medium">
            About
          </Link>
          <Link href="/contact" className="px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 font-medium">
            Contact
          </Link>
        </nav>
        <Link
          href="/tools/merge-pdf"
          className="shrink-0 rounded-full bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          Try a tool
        </Link>
      </div>
    </header>
  );
}
