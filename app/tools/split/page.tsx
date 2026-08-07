import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import SplitClient from "./SplitClient";

const tool = getTool("split")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.metaDescription ?? tool.description,
  keywords: tool.keywords,
  alternates: { canonical: "/tools/split" },
};

export default function SplitPage() {
  return (
    <ToolPageShell tool={tool}>
      <SplitClient />
    </ToolPageShell>
  );
}
