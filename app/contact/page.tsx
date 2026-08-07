import type { Metadata } from "next";
import { siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Questions, feedback, or a tool request for ${siteName}? Get in touch with our team by email — we'd love to hear from you.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <h1 className="text-3xl font-bold mb-6">Contact us</h1>
      <p className="text-zinc-700 dark:text-zinc-300 mb-4">
        Questions, feedback, or a tool request? We&apos;d love to hear from you.
      </p>
      <a
        href="mailto:support@pdfcompact.com"
        className="inline-flex items-center rounded-full bg-red-600 text-white px-6 py-2.5 font-semibold hover:bg-red-700 transition-colors"
      >
        support@pdfcompact.com
      </a>
    </div>
  );
}
