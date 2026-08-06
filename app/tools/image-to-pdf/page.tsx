import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import ImageToPdfClient from "./ImageToPdfClient";

const tool = getTool("image-to-pdf")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: "/tools/image-to-pdf" },
};

export default function ImageToPdfPage() {
  return (
    <ToolPageShell
      icon={tool.icon}
      title={tool.name}
      description={tool.description}
      howTo={[
        "Upload one or more images (JPG, PNG, or WebP).",
        "Drag thumbnails to set the page order.",
        "Click \"Convert to PDF\".",
        "Your PDF, with one image per page, downloads automatically.",
      ]}
      faq={[
        {
          question: "What image formats are supported?",
          answer: "JPG, PNG, and WebP all work. Each image becomes its own page, sized to match the image.",
        },
      ]}
    >
      <ImageToPdfClient />
    </ToolPageShell>
  );
}
