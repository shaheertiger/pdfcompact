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
    <ToolPageShell
      icon={tool.icon}
      title={tool.name}
      description={tool.description}
      howTo={[
        "Upload the PDF you want to extract text from.",
        "Wait a moment while the text is pulled from every page.",
        "Preview the text in the box below.",
        "Click \"Download .txt\" to save it to your device.",
      ]}
      faq={[
        {
          question: "Does this work on scanned PDFs?",
          answer:
            "It extracts text that already exists in the PDF. Scanned documents that are just images won't have selectable text to extract.",
        },
      ]}
    >
      <PdfToTextClient />
    </ToolPageShell>
  );
}
