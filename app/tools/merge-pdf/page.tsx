import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import MergeClient from "./MergeClient";

const tool = getTool("merge-pdf")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.metaDescription ?? tool.description,
  keywords: tool.keywords,
  alternates: { canonical: "/tools/merge-pdf" },
};

export default function MergePdfPage() {
  return (
    <ToolPageShell tool={tool}>
      <MergeClient />
    </ToolPageShell>
  );
}
