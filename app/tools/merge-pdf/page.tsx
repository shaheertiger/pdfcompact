import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import MergeClient from "./MergeClient";

const tool = getTool("merge-pdf")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: "/tools/merge-pdf" },
};

export default function MergePdfPage() {
  return (
    <ToolPageShell
      icon={tool.icon}
      title={tool.name}
      description={tool.description}
      howTo={[
        "Upload two or more PDF files using the box above.",
        "Drag the files or use the arrow buttons to set the order you want.",
        "Click \"Merge\" to combine them into a single PDF.",
        "Your merged PDF downloads automatically — nothing is uploaded to a server.",
      ]}
      faq={[
        {
          question: "Is there a limit to how many PDFs I can merge?",
          answer:
            "No hard limit — merging happens in your browser, so it's limited only by your device's memory.",
        },
        {
          question: "Will merging affect the quality of my PDFs?",
          answer:
            "No. Pages are copied as-is, so text, images, and formatting stay exactly the same.",
        },
        {
          question: "Are my files uploaded anywhere?",
          answer:
            "No. Everything happens locally in your browser using JavaScript — your files never leave your device.",
        },
      ]}
    >
      <MergeClient />
    </ToolPageShell>
  );
}
