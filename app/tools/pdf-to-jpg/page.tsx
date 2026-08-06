import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import PdfToJpgClient from "./PdfToJpgClient";

const tool = getTool("pdf-to-jpg")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: "/tools/pdf-to-jpg" },
};

export default function PdfToJpgPage() {
  return (
    <ToolPageShell tool={tool}>
      <PdfToJpgClient />
    </ToolPageShell>
  );
}
