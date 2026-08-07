import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import PdfToTextClient from "./PdfToTextClient";

const tool = getTool("pdf-to-text")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: "/tools/pdf-to-text" },
};

export default function PdfToTextPage() {
  return (
    <ToolPageShell tool={tool}>
      <PdfToTextClient />
    </ToolPageShell>
  );
}
