import { ImageResponse } from "next/og";
import { OgContent } from "@/lib/og";
import { registry } from "@/lib/registry";
import { getToolContent } from "@/lib/content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "PDFCompact tool";

export function generateStaticParams() {
  return registry.map((t) => ({ slug: t.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getToolContent(slug);
  return new ImageResponse(<OgContent subtitle={c.h1} />, size);
}
