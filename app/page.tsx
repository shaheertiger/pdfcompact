import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import { tools } from "@/lib/tools";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="bg-gradient-to-b from-red-50 to-white dark:from-red-950/20 dark:to-black">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-24 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Every PDF tool you need, in one place.
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
            Merge, split, rearrange, edit, sign, and convert PDFs — completely
            free, with no sign-up. Your files stay on your device.
          </p>
          <Link
            href="/tools/merge-pdf"
            className="inline-flex items-center justify-center rounded-full bg-red-600 text-white px-6 py-3 font-semibold hover:bg-red-700 transition-colors"
          >
            Get started — it&apos;s free
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14 w-full">
        <h2 className="text-2xl font-bold mb-6">All tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group rounded-xl border border-black/10 dark:border-white/10 p-5 hover:border-red-400 hover:shadow-md transition-all bg-white dark:bg-zinc-900"
            >
              <div className="text-3xl mb-3">{tool.icon}</div>
              <h3 className="font-semibold mb-1 group-hover:text-red-600">
                {tool.name}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {tool.short}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <AdSlot
        slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME}
        className="mx-auto max-w-6xl w-full px-4 sm:px-6 mb-14"
      />

      <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-16 w-full">
        <div className="grid gap-6 sm:grid-cols-3 text-center">
          <div>
            <div className="text-3xl mb-2">🔒</div>
            <h3 className="font-semibold mb-1">Private by default</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Files are processed locally in your browser and never sent to a
              server.
            </p>
          </div>
          <div>
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="font-semibold mb-1">Fast</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No uploads or queues — results are ready in seconds.
            </p>
          </div>
          <div>
            <div className="text-3xl mb-2">💸</div>
            <h3 className="font-semibold mb-1">Free</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Every tool is free to use, with no account required.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
