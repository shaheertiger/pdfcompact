import Link from "next/link";
import { ChevronRight, Lock, WifiOff, BadgeCheck } from "lucide-react";
import ToolIcon from "@/components/ToolIcon";
import JsonLd from "@/components/JsonLd";
import AdSlot from "@/components/AdSlot";
import { toolClients } from "@/components/tools";
import { LocaleProvider, type Locale } from "@/lib/i18n";
import { registry, groups, type ToolEntry } from "@/lib/registry";
import { getToolContent, getRelated, renderInline, stripMarkdown } from "@/lib/content";
import { siteUrl, organizationJsonLd, organizationId } from "@/lib/site";

export function toolPath(tool: ToolEntry, locale: Locale = "en"): string {
  return locale === "es" && tool.es ? `/es/${tool.es.slug}` : `/${tool.slug}`;
}

/** hreflang alternates for a tool that has a Spanish page. */
export function toolAlternates(tool: ToolEntry, locale: Locale) {
  if (!tool.es) return { canonical: toolPath(tool, locale) };
  return {
    canonical: toolPath(tool, locale),
    languages: { en: toolPath(tool, "en"), es: toolPath(tool, "es"), "x-default": toolPath(tool, "en") },
  };
}

const labels = {
  en: {
    home: "Home",
    breadcrumb: "Breadcrumb",
    spanishHub: "",
    pill: "Runs on your device — never uploaded",
    quickAnswer: "Quick answer",
    limitsHeading: (n: string) => `${n}: what it does and its limits`,
    faqHeading: (n: string) => `${n} FAQ`,
    onThisPage: "On this page",
    limits: "Limits",
    howTo: "How to",
    faq: "FAQ",
    noUpload: "Nothing is uploaded",
    offline: "Works offline once loaded",
    free: "Free, no sign-up, no watermark",
    howItWorks: "How this works →",
    related: "Related tools",
    allTools: (g: string) => `All ${g.toLowerCase()} tools →`,
  },
  es: {
    // The root crumb points at the English homepage, so use the brand name, not "Inicio".
    home: "PDFCompact",
    breadcrumb: "Ruta de navegación",
    spanishHub: "Herramientas PDF en español",
    pill: "Funciona en tu dispositivo: nunca se sube",
    quickAnswer: "Respuesta rápida",
    limitsHeading: (n: string) => `${n}: qué hace y sus límites`,
    faqHeading: (n: string) => `Preguntas frecuentes sobre ${n}`,
    onThisPage: "En esta página",
    limits: "Límites",
    howTo: "Cómo se hace",
    faq: "Preguntas frecuentes",
    noUpload: "No se sube nada",
    offline: "Funciona sin conexión una vez cargada",
    free: "Gratis, sin registro, sin marca de agua",
    howItWorks: "Cómo funciona (en inglés) →",
    related: "Otras herramientas en español",
    allTools: () => "Ver las demás herramientas PDF (en inglés) →",
  },
} as const;

export default function ToolPage({ tool, locale = "en" }: { tool: ToolEntry; locale?: Locale }) {
  const slug = tool.slug;
  const L = labels[locale];
  const c = getToolContent(slug, locale);
  const group = groups.find((g) => g.id === tool.group)!;
  const name = locale === "es" ? tool.es!.name : tool.name;
  const path = toolPath(tool, locale);
  const groupHref = locale === "es" ? "/es" : `/#${group.id}`;
  const groupName = locale === "es" ? L.spanishHub : group.name;
  const related =
    locale === "es"
      ? registry.filter((t) => t.es && t.slug !== slug).map((t) => ({ ...t, name: t.es!.name, href: toolPath(t, "es") }))
      : getRelated(c).map((t) => ({ ...t, href: `/${t.slug}` }));
  const Client = toolClients[slug];
  const url = `${siteUrl}${path}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd,
      {
        "@type": "WebApplication",
        "@id": `${url}#app`,
        name,
        url,
        inLanguage: locale,
        description: c.description,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript. Works in current Chrome, Edge, Firefox and Safari.",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: c.limits.map((l) => `${l.label}: ${stripMarkdown(l.value)}`),
        publisher: { "@id": organizationId },
        dateModified: c.updated,
      },
      {
        "@type": "HowTo",
        name: c.howto.question,
        step: c.howto.steps.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.name,
          text: stripMarkdown(s.text),
          url: `${url}#how-to`,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: c.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: stripMarkdown(f.a) },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: L.home, item: siteUrl },
          { "@type": "ListItem", position: 2, name: groupName, item: `${siteUrl}${groupHref}` },
          { "@type": "ListItem", position: 3, name, item: url },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-3 pb-10 sm:pt-6 w-full">
      <JsonLd data={jsonLd} />

      <nav aria-label={L.breadcrumb} className="hidden sm:flex text-xs text-zinc-500 mb-3 items-center gap-1 overflow-hidden">
        <Link href="/" className="hover:text-red-600">{L.home}</Link>
        <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        <Link href={groupHref} className="hover:text-red-600 truncate">{groupName}</Link>
        <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="text-zinc-700 dark:text-zinc-300 truncate">{name}</span>
      </nav>

      {/* First fold: H1, one-line lead, the tool. */}
      <header className="text-center max-w-3xl mx-auto mb-3 sm:mb-6">
        <h1 className="flex items-center justify-center gap-2 text-[1.375rem] leading-tight sm:text-4xl font-bold tracking-tight text-balance">
          <ToolIcon name={tool.icon} className="hidden sm:block h-8 w-8 shrink-0 text-red-600" />
          <span>{c.h1}</span>
        </h1>
        <p className="mt-1.5 sm:mt-2 text-sm sm:text-base leading-snug text-zinc-600 dark:text-zinc-400">{c.lead}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 rounded-full px-3 py-1">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          {L.pill}
        </p>
      </header>

      <section
        aria-label={name}
        className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm p-3 sm:p-8"
      >
        <LocaleProvider locale={locale}>
          <Client />
        </LocaleProvider>
      </section>

      <div className="mt-10 sm:mt-14 grid gap-10 lg:grid-cols-[1fr_15rem] lg:gap-12">
        <div className="min-w-0">
          <section aria-labelledby="quick-answer" className="rounded-xl border-l-4 border-red-600 bg-zinc-50 dark:bg-zinc-900 px-5 py-4">
            <h2 id="quick-answer" className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-1">
              {L.quickAnswer}
            </h2>
            <p className="text-zinc-800 dark:text-zinc-200" dangerouslySetInnerHTML={{ __html: renderInline(c.answer) }} />
          </section>

          <section aria-labelledby="limits" className="mt-8">
            <h2 id="limits" className="text-xl font-semibold mb-3">{L.limitsHeading(name)}</h2>
            <div className="table-wrap">
              <table className="limits">
                <tbody>
                  {c.limits.map((l) => (
                    <tr key={l.label}>
                      <th scope="row">{l.label}</th>
                      <td dangerouslySetInnerHTML={{ __html: renderInline(l.value) }} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="how-to" className="mt-10">
            <h2 id="how-to" className="text-xl sm:text-2xl font-semibold mb-4">{c.howto.question}</h2>
            <ol className="grid gap-3">
              {c.howto.steps.map((s, i) => (
                <li key={i} className="flex gap-3 rounded-xl border border-black/10 dark:border-white/10 p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-white text-sm font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-0.5" dangerouslySetInnerHTML={{ __html: renderInline(s.text) }} />
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <article className="article mt-10" dangerouslySetInnerHTML={{ __html: c.bodyHtml }} />

          <section aria-labelledby="faq" className="mt-12">
            <h2 id="faq" className="text-xl sm:text-2xl font-semibold mb-4">{L.faqHeading(name)}</h2>
            <div className="grid gap-3">
              {c.faq.map((f) => (
                <div key={f.q} className="rounded-xl border border-black/10 dark:border-white/10 p-4">
                  <h3 className="font-semibold">{f.q}</h3>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1" dangerouslySetInnerHTML={{ __html: renderInline(f.a) }} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 grid gap-6 text-sm">
            {c.headings.length > 0 && (
              <nav aria-label={L.onThisPage}>
                <div className="font-semibold mb-2">{L.onThisPage}</div>
                <ul className="grid gap-1.5 text-zinc-600 dark:text-zinc-400">
                  <li><a href="#limits" className="hover:text-red-600">{L.limits}</a></li>
                  <li><a href="#how-to" className="hover:text-red-600">{L.howTo}</a></li>
                  {c.headings.map((h) => (
                    <li key={h.id}><a href={`#${h.id}`} className="hover:text-red-600">{h.text}</a></li>
                  ))}
                  <li><a href="#faq" className="hover:text-red-600">{L.faq}</a></li>
                </ul>
              </nav>
            )}
            <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 grid gap-2 text-zinc-600 dark:text-zinc-400">
              <p className="flex gap-2"><Lock className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" /> {L.noUpload}</p>
              <p className="flex gap-2"><WifiOff className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" /> {L.offline}</p>
              <p className="flex gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" /> {L.free}</p>
              <Link href="/how-it-works" className="text-red-600 hover:underline">{L.howItWorks}</Link>
            </div>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-14">
          <h2 id="related" className="text-xl font-semibold mb-4">{L.related}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={r.href}
                className="rounded-xl border border-black/10 dark:border-white/10 p-4 hover:border-red-400 hover:shadow-sm transition-all bg-white dark:bg-zinc-900"
              >
                <ToolIcon name={r.icon} className="h-5 w-5 mb-2 text-red-600" />
                <div className="font-medium text-sm">{r.name}</div>
                <div className="text-xs text-zinc-500 mt-1">{r.short}</div>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-sm">
            <Link href={locale === "es" ? "/" : `/#${group.id}`} className="text-red-600 hover:underline">
              {L.allTools(group.name)}
            </Link>
          </p>
        </section>
      )}

      {/* Ads stay off until traffic justifies them, and only ever below the tool and article. */}
      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOOL} className="mt-12" />
    </div>
  );
}
