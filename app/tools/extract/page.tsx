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
    <ToolPageShell tool={tool}>
      <ExtractClient />
    </ToolPageShell>
  );
}
