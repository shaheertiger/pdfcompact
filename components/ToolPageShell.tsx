import type { ReactNode } from "react";
import AdSlot from "@/components/AdSlot";

type FaqItem = { question: string; answer: string };

type ToolPageShellProps = {
  icon: string;
  title: string;
  description: string;
  children: ReactNode;
  howTo?: string[];
  faq?: FaqItem[];
};

export default function ToolPageShell({
  icon,
  title,
  description,
  children,
  howTo,
  faq,
}: ToolPageShellProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 w-full">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="text-5xl mb-3">{icon}</div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          {title}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">{description}</p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-full px-3 py-1">
          🔒 Files are processed locally in your browser and never uploaded.
        </p>
      </div>

      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm p-4 sm:p-8">
        {children}
      </div>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOOL} className="mt-10" />

      {howTo && howTo.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-semibold mb-4">How it works</h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {howTo.map((step, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-xl border border-black/10 dark:border-white/10 p-4"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                  {i + 1}
                </span>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {faq && faq.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-semibold mb-4">Frequently asked questions</h2>
          <div className="grid gap-4">
            {faq.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-black/10 dark:border-white/10 p-4"
              >
                <h3 className="font-medium mb-1">{item.question}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
