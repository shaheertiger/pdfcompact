import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import RemovePagesClient from "./RemovePagesClient";

const tool = getTool("remove-pages")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.metaDescription ?? tool.description,
  keywords: tool.keywords,
  alternates: { canonical: "/tools/remove-pages" },
};

export default function RemovePagesPage() {
  return (
    <ToolPageShell tool={tool}>
      <RemovePagesClient />
    </ToolPageShell>
  );
}
