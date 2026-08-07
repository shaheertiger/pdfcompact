import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import RearrangeClient from "./RearrangeClient";

const tool = getTool("rearrange")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.metaDescription ?? tool.description,
  keywords: tool.keywords,
  alternates: { canonical: "/tools/rearrange" },
};

export default function RearrangePage() {
  return (
    <ToolPageShell tool={tool}>
      <RearrangeClient />
    </ToolPageShell>
  );
}
