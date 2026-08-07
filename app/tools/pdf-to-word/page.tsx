import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import PdfToWordClient from "./PdfToWordClient";

const tool = getTool("pdf-to-word")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.metaDescription ?? tool.description,
  keywords: tool.keywords,
  alternates: { canonical: "/tools/pdf-to-word" },
};

export default function PdfToWordPage() {
  return (
    <ToolPageShell tool={tool}>
      <PdfToWordClient />
    </ToolPageShell>
  );
}
