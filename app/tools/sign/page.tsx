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
    <ToolPageShell
      icon={tool.icon}
      title={tool.name}
      description={tool.description}
      howTo={[
        "Upload the PDF you need to sign.",
        "Draw your signature with your mouse or finger, or type your name for a cursive signature.",
        "Click \"Place signature\" and click anywhere on the page to add it — drag to reposition or use +/− to resize.",
        "Click \"Save signed PDF\" to download the finished document.",
      ]}
      faq={[
        {
          question: "Is this a legally binding e-signature?",
          answer:
            "This tool adds a visual signature image to your PDF. For signatures with legal audit trails, check the requirements for your specific use case.",
        },
        {
          question: "Can I sign multiple pages?",
          answer:
            "Yes — navigate between pages with Prev/Next and place your signature on as many pages as you need.",
        },
      ]}
    >
      <SignClient />
    </ToolPageShell>
  );
}
