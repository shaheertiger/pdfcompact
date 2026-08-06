import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import ExtractClient from "./ExtractClient";

const tool = getTool("extract")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: "/tools/extract" },
};

export default function ExtractPage() {
  return (
    <ToolPageShell
      icon={tool.icon}
      title={tool.name}
      description={tool.description}
      howTo={[
        "Upload the PDF you want to pull pages from.",
        "Click each page you want to keep — selected pages get a checkmark.",
        "Click \"Extract pages\" to build a new PDF from just those pages.",
        "The new PDF downloads automatically, in the order the pages originally appeared.",
      ]}
      faq={[
        {
          question: "What order will the extracted pages be in?",
          answer:
            "Selected pages keep their original order from the source document, regardless of the order you clicked them in.",
        },
      ]}
    >
      <ExtractClient />
    </ToolPageShell>
  );
}
