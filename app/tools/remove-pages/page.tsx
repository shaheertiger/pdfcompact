import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import RemovePagesClient from "./RemovePagesClient";

const tool = getTool("remove-pages")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: "/tools/remove-pages" },
};

export default function RemovePagesPage() {
  return (
    <ToolPageShell
      icon={tool.icon}
      title={tool.name}
      description={tool.description}
      howTo={[
        "Upload the PDF you want to edit.",
        "Click each page you want to delete — it will be marked with a trash icon.",
        "Click \"Remove pages\" to generate the new PDF.",
        "Download automatically starts once it's ready.",
      ]}
      faq={[
        {
          question: "Can I remove multiple pages at once?",
          answer: "Yes — click every page you want to delete before saving; they're all removed in one step.",
        },
        {
          question: "Can I undo a removal?",
          answer:
            "Click a marked page again to unmark it before saving. Once you save, upload the original file again to start over.",
        },
      ]}
    >
      <RemovePagesClient />
    </ToolPageShell>
  );
}
