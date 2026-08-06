import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import EditPdfClient from "./EditPdfClient";

const tool = getTool("edit-pdf")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: "/tools/edit-pdf" },
};

export default function EditPdfPage() {
  return (
    <ToolPageShell
      icon={tool.icon}
      title={tool.name}
      description={tool.description}
      howTo={[
        "Upload the PDF you want to edit.",
        "Click \"Add text\" then click anywhere on the page to place a text box — double-click it to change the wording.",
        "Click \"Highlight\" then drag over an area to draw a highlight.",
        "Drag any text box to reposition it, or click the ✕ to remove an annotation.",
        "Click \"Save edited PDF\" to download your changes.",
      ]}
      faq={[
        {
          question: "Can I edit text that's already in the PDF?",
          answer:
            "This tool adds new text, highlights, and shapes on top of your PDF rather than rewriting existing text embedded in the document.",
        },
        {
          question: "Do edits apply to every page?",
          answer:
            "Annotations are tracked per page — use the Prev/Next controls to move between pages and add edits to each one.",
        },
      ]}
    >
      <EditPdfClient />
    </ToolPageShell>
  );
}
