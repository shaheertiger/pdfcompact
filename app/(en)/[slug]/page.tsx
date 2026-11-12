import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ToolPage, { toolAlternates } from "@/components/ToolPage";
import { registry } from "@/lib/registry";
import { getToolContent } from "@/lib/content";
import { siteName } from "@/lib/site";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return registry.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tool = registry.find((t) => t.slug === slug);
  if (!tool) return {};
  const c = getToolContent(slug);
  return {
    title: { absolute: c.title },
    description: c.description,
    keywords: c.keywords,
    alternates: toolAlternates(tool, "en"),
    openGraph: { type: "website", url: `/${slug}`, title: c.title, description: c.description, siteName, locale: "en_US" },
    twitter: { card: "summary_large_image", title: c.title, description: c.description },
  };
}

export default async function Page({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const tool = registry.find((t) => t.slug === slug);
  if (!tool) notFound();
  return <ToolPage tool={tool} />;
}
