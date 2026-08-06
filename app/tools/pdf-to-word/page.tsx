import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import PdfToWordClient from "./PdfToWordClient";

const tool = getTool("pdf-to-word")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: "/tools/pdf-to-word" },
};

export default function PdfToWordPage() {
  return (
    <ToolPageShell
      icon={tool.icon}
      title={tool.name}
      description={tool.description}
      howTo={[
        "Upload the PDF you want to convert.",
        "We extract the text from every page, keeping page breaks in place.",
        "A .docx file is generated and downloaded automatically.",
        "Open it in Microsoft Word, Google Docs, or any compatible editor.",
      ]}
      faq={[
        {
          question: "Will the layout look exactly like the PDF?",
          answer:
            "This tool focuses on getting editable text into Word format. Complex layouts, columns, and images from the original PDF are not recreated.",
        },
        {
          question: "Does it work on scanned PDFs?",
          answer:
            "It converts text that already exists in the PDF. Scanned image-only documents won't have text to extract.",
        },
      ]}
    >
      <PdfToWordClient />
    </ToolPageShell>
  );
}
