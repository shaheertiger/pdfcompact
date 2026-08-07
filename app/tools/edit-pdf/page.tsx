import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import EditPdfClient from "./EditPdfClient";

const tool = getTool("edit-pdf")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.metaDescription ?? tool.description,
  keywords: tool.keywords,
  alternates: { canonical: "/tools/edit-pdf" },
};

export default function EditPdfPage() {
  return (
    <ToolPageShell tool={tool}>
      <EditPdfClient />
    </ToolPageShell>
  );
}
