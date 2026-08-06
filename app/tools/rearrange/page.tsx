import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import RearrangeClient from "./RearrangeClient";

const tool = getTool("rearrange")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: "/tools/rearrange" },
};

export default function RearrangePage() {
  return (
    <ToolPageShell
      icon={tool.icon}
      title={tool.name}
      description={tool.description}
      howTo={[
        "Upload the PDF whose pages you want to reorder.",
        "Wait for the page thumbnails to load.",
        "Drag and drop thumbnails into the order you want.",
        "Click \"Save reordered PDF\" to download the result.",
      ]}
      faq={[
        {
          question: "Can I reorder a very large PDF?",
          answer:
            "Yes, though generating thumbnails for very large documents may take a little longer since it all happens on your device.",
        },
      ]}
    >
      <RearrangeClient />
    </ToolPageShell>
  );
}
