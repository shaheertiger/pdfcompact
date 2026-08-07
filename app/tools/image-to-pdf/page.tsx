import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import ImageToPdfClient from "./ImageToPdfClient";

const tool = getTool("image-to-pdf")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.metaDescription ?? tool.description,
  keywords: tool.keywords,
  alternates: { canonical: "/tools/image-to-pdf" },
};

export default function ImageToPdfPage() {
  return (
    <ToolPageShell tool={tool}>
      <ImageToPdfClient />
    </ToolPageShell>
  );
}
