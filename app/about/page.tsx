import type { Metadata } from "next";
import Link from "next/link";
import { siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `About ${siteName} and how our free PDF tools work.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <h1 className="text-3xl font-bold mb-6">About {siteName}</h1>
      <div className="grid gap-4 text-zinc-700 dark:text-zinc-300">
        <p>
          {siteName} is a collection of free, fast PDF tools that run entirely in your web
          browser. Merge, split, rearrange, edit, sign, and convert PDFs without installing
          software, creating an account, or uploading your files anywhere.
        </p>
        <p>
          Every tool on this site uses client-side JavaScript to process your documents
          directly on your device. That means your files stay private, and you get results in
          seconds instead of waiting on uploads and downloads.
        </p>
        <p>
          {siteName} is a project of{" "}
          <a
            href="https://pdfcanada.ca/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 hover:underline"
          >
            PDF Canada
          </a>
          .
        </p>
        <p>
          Have feedback or a tool you&apos;d like to see?{" "}
          <Link href="/contact" className="text-red-600 hover:underline">
            Get in touch
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
