import Link from "next/link";
import { registry } from "@/lib/registry";

export default function NotFound() {
  const popular = ["compress-pdf", "merge-pdf", "split-pdf", "ocr-pdf", "pdf-to-word", "jpg-to-pdf"]
    .map((s) => registry.find((t) => t.slug === s)!)
    .filter(Boolean);
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16 text-center w-full">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">That page doesn&apos;t exist. These are the tools people use most:</p>
      <ul className="mt-6 flex flex-wrap justify-center gap-2">
        {popular.map((t) => (
          <li key={t.slug}>
            <Link href={`/${t.slug}`} className="inline-block rounded-full border border-black/15 dark:border-white/15 px-4 py-2 text-sm hover:border-red-400 hover:text-red-600">
              {t.name}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8"><Link href="/#tools" className="text-red-600 hover:underline">See all tools →</Link></p>
    </div>
  );
}
