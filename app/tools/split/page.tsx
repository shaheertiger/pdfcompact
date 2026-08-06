import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import SplitClient from "./SplitClient";

const tool = getTool("split")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: "/tools/split" },
};

export default function SplitPage() {
  return (
    <ToolPageShell
      icon={tool.icon}
      title={tool.name}
      description={tool.description}
      howTo={[
        "Upload the PDF you want to split.",
        "Choose to split every N pages, or enter custom page ranges.",
        "Click \"Split PDF\" to generate the separate files.",
        "Download the result — a single PDF, or a ZIP if there are multiple parts.",
      ]}
      faq={[
        {
          question: "Can I split by custom page ranges?",
          answer:
            "Yes — switch to \"Custom page ranges\" and enter something like 1-3, 4, 6-8 to create one file per range.",
        },
        {
          question: "What if I only get one output file?",
          answer:
            "If your settings produce a single file, it downloads directly as a PDF instead of a ZIP.",
        },
      ]}
    >
      <SplitClient />
    </ToolPageShell>
  );
}
