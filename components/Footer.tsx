import Link from "next/link";
import { registry, groups } from "@/lib/registry";

export default function Footer() {
  return (
    <footer className="border-t border-black/10 dark:border-white/10 mt-16 bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid gap-8 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <div className="col-span-2 md:col-span-4 lg:col-span-1">
          <div className="font-bold text-lg mb-2">
            PDF<span className="text-red-600">Compact</span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Free PDF tools that run in your browser. Your files never leave your device.
          </p>
        </div>
        {groups.map((g) => (
          <div key={g.id}>
            <h2 className="font-semibold mb-2 text-xs uppercase tracking-wide text-zinc-500">
              <Link href={`/#${g.id}`} className="hover:text-red-600">{g.name}</Link>
            </h2>
            <ul className="grid gap-1.5 text-sm">
              {registry
                .filter((t) => t.group === g.id)
                .map((t) => (
                  <li key={t.slug}>
                    <Link href={`/${t.slug}`} className="text-zinc-600 dark:text-zinc-400 hover:text-red-600">
                      {t.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 border-t border-black/10 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
        <p>&copy; {new Date().getFullYear()} PDFCompact</p>
        <nav aria-label="Company" className="flex flex-wrap justify-center gap-4">
          <Link href="/how-it-works" className="hover:text-red-600">How it works</Link>
          <Link href="/about" className="hover:text-red-600">About</Link>
          <Link href="/contact" className="hover:text-red-600">Contact</Link>
          <Link href="/privacy" className="hover:text-red-600">Privacy</Link>
          <Link href="/terms" className="hover:text-red-600">Terms</Link>
        </nav>
        <p>
          A project of{" "}
          <a href="https://pdfcanada.ca/" target="_blank" rel="noopener" className="font-medium text-zinc-600 dark:text-zinc-300 hover:text-red-600">
            PDF Canada
          </a>
        </p>
      </div>
    </footer>
  );
}
