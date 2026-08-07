import type { Metadata } from "next";
import ToolPageShell from "@/components/ToolPageShell";
import { getTool } from "@/lib/tools";
import SignClient from "./SignClient";

const tool = getTool("sign")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
  alternates: { canonical: "/tools/sign" },
};

export default function SignPage() {
  return (
    <ToolPageShell tool={tool}>
      <SignClient />
    </ToolPageShell>
  );
}
