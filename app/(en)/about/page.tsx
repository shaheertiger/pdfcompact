import type { Metadata } from "next";
import Link from "next/link";
import { siteName, contactEmail } from "@/lib/site";
import { registry } from "@/lib/registry";

export const metadata: Metadata = {
  title: "About",
  description: `${siteName} makes free PDF and image tools that run in your browser, so private documents are never uploaded. Who we are, how we work, how to reach us.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14 w-full">
      <h1 className="text-3xl font-bold">About {siteName}</h1>
      <div className="article mt-6">
        <p>
          {siteName} is a set of {registry.length} free tools for everyday PDF and image jobs: compressing a
          file for an upload portal, merging a job application, making a scan searchable, signing a form.
          Every tool runs in your browser, so the documents people trust us with (CVs, IDs, payslips,
          contracts) are never uploaded anywhere.
        </p>

        <h2>Who runs it</h2>
        <p>
          {siteName} is built and run by the team behind{" "}
          <a href="https://pdfcanada.ca/" target="_blank" rel="noopener">PDF Canada</a>, a small
          independent team that builds browser-based PDF tools. We write the code,
          test every tool on real files before it goes live, and write the guides on each tool page
          ourselves.
        </p>

        <h2>How we work</h2>
        <ul>
          <li><strong>One page per job.</strong> Each tool does one thing and its page explains exactly that, including what it can&apos;t do.</li>
          <li><strong>Real numbers.</strong> Figures like &quot;up to N% smaller&quot; are measured on test files, not guessed.</li>
          <li><strong>No sign-up walls or trials.</strong> Every tool is free to use without an account, and downloads have no watermark.</li>
          <li><strong>Nothing uploaded.</strong> If a job can&apos;t be done safely in the browser, we don&apos;t offer it.</li>
        </ul>

        <h2>Contact</h2>
        <p>
          Found a file a tool can&apos;t handle, a mistake on a page, or a tool you&apos;d like to see?
          Email <a href={`mailto:${contactEmail}`}>{contactEmail}</a> or use the{" "}
          <Link href="/contact">contact page</Link>. Please describe the problem rather than attaching
          a private document.
        </p>
      </div>
    </div>
  );
}
