import type { ReactNode } from "react";
import AdSlot from "@/components/AdSlot";
import TrustBadges from "@/components/TrustBadges";
import RelatedTools from "@/components/RelatedTools";
import type { Tool } from "@/lib/tools";

type ToolPageShellProps = {
  tool: Tool;
  children: ReactNode;
};

export default function ToolPageShell({ tool, children }: ToolPageShellProps) {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: tool.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10 w-full">
      {/* First fold: title, one-line description, and the tool itself — no scrolling required to start. */}
      <div className="text-center max-w-2xl mx-auto mb-4 sm:mb-6">
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <span className="text-3xl sm:text-4xl leading-none">{tool.icon}</span>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">{tool.name}</h1>
        </div>
        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
          {tool.description}
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-full px-3 py-1">
          🔒 Processed in your browser — never uploaded.
        </p>
      </div>

      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm p-3 sm:p-8">
        {children}
      </div>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOOL} className="mt-10" />

      {tool.about.length > 0 && (
        <section className="mt-10 sm:mt-14 max-w-3xl">
          <div className="grid gap-3 text-sm sm:text-base text-zinc-700 dark:text-zinc-300">
            {tool.about.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 sm:mt-14">
        <TrustBadges />
      </section>

      {tool.howTo.length > 0 && (
        <section className="mt-10 sm:mt-14">
          <h2 className="text-xl font-semibold mb-4">How it works</h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {tool.howTo.map((step, i) => (
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

      {tool.faq.length > 0 && (
        <section className="mt-10 sm:mt-14">
          <h2 className="text-xl font-semibold mb-4">Frequently asked questions</h2>
          <div className="grid gap-4">
            {tool.faq.map((item, i) => (
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
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
          />
        </section>
      )}

      <RelatedTools slug={tool.slug} />
    </div>
  );
}
