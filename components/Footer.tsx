import Link from "next/link";
import { tools } from "@/lib/tools";

export default function Footer() {
  return (
    <footer className="border-t border-black/10 dark:border-white/10 mt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-3">
        <div>
          <div className="font-bold text-lg mb-2">
            PDF<span className="text-red-600">Compact</span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xs">
            Free, fast PDF tools that run entirely in your browser. Your files
            are never uploaded to a server.
          </p>
        </div>
        <div>
          <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-zinc-500">
            Tools
          </h3>
          <ul className="grid grid-cols-2 gap-1 text-sm">
            {tools.map((tool) => (
              <li key={tool.slug}>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-red-600"
                >
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-2 text-sm uppercase tracking-wide text-zinc-500">
            Company
          </h3>
          <ul className="grid gap-1 text-sm">
            <li>
              <Link href="/about" className="text-zinc-600 dark:text-zinc-400 hover:text-red-600">
                About
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-zinc-600 dark:text-zinc-400 hover:text-red-600">
                Contact
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-zinc-600 dark:text-zinc-400 hover:text-red-600">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-zinc-600 dark:text-zinc-400 hover:text-red-600">
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 border-t border-black/10 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
        <p>&copy; {new Date().getFullYear()} PDFCompact. All rights reserved.</p>
        <p>
          A project of{" "}
          <a
            href="https://pdfcanada.ca/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-600 dark:text-zinc-300 hover:text-red-600"
          >
            PDF Canada
          </a>
        </p>
      </div>
    </footer>
  );
}
