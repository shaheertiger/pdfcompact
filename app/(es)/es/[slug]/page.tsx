import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ToolPage, { toolAlternates } from "@/components/ToolPage";
import { registry } from "@/lib/registry";
import { getToolContent } from "@/lib/content";
import { siteName } from "@/lib/site";

export const dynamic = "force-static";
export const dynamicParams = false;

const bySpanishSlug = (slug: string) => registry.find((t) => t.es?.slug === slug);

export function generateStaticParams() {
  return registry.filter((t) => t.es).map((t) => ({ slug: t.es!.slug }));
}

export async function generateMetadata({ params }: PageProps<"/es/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tool = bySpanishSlug(slug);
  if (!tool) return {};
  const c = getToolContent(tool.slug, "es");
  return {
    title: { absolute: c.title },
    description: c.description,
    keywords: c.keywords,
    alternates: toolAlternates(tool, "es"),
    openGraph: { type: "website", url: `/es/${slug}`, title: c.title, description: c.description, siteName, locale: "es_ES" },
    twitter: { card: "summary_large_image", title: c.title, description: c.description },
  };
}

export default async function Page({ params }: PageProps<"/es/[slug]">) {
  const { slug } = await params;
  const tool = bySpanishSlug(slug);
  if (!tool) notFound();
  return <ToolPage tool={tool} locale="es" />;
}
