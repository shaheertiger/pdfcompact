import type { Metadata } from "next";
import { siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms for using ${siteName}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14 prose prose-zinc dark:prose-invert">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-zinc-500 mb-8">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Using {siteName}</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        {siteName} provides free, browser-based tools for working with PDF files, including
        merging, splitting, rearranging, editing, signing, and converting documents. By using
        this site, you agree to these terms.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">No warranty</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        This site is provided &quot;as is&quot; without warranties of any kind. We do our best
        to make sure the tools work correctly, but we can&apos;t guarantee they will be
        error-free or uninterrupted. Always keep a backup of your original files.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Acceptable use</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        You agree not to use this site to process files you do not have the right to use, or
        for any unlawful purpose.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Limitation of liability</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        To the fullest extent permitted by law, {siteName} and its operators are not liable
        for any indirect, incidental, or consequential damages arising from your use of this
        site.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Changes to these terms</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        We may update these terms from time to time. Continued use of the site after changes
        means you accept the updated terms.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Contact us</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        Questions about these terms? Visit our{" "}
        <a href="/contact" className="text-red-600 hover:underline">
          Contact page
        </a>
        .
      </p>
    </div>
  );
}
