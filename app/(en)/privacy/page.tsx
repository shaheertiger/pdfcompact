import type { Metadata } from "next";
import { siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `${siteName}'s privacy policy: your files are processed locally in your browser and are never uploaded to our servers or stored.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14 prose prose-zinc dark:prose-invert">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-zinc-500 mb-8">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Your files never leave your device</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        {siteName}&apos;s tools run entirely in your web browser using JavaScript. When you
        upload a PDF or image to merge, split, edit, sign, or convert, that file is processed
        locally on your device. We do not upload your files to a server, store them, or have
        access to their contents.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Information we collect</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        We may collect standard, non-identifying technical information such as your browser
        type, device type, and pages visited, via analytics services, to help us understand
        how the site is used and improve it.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Cookies and advertising</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        We may use third-party advertising companies, including Google, to serve ads when you
        visit this site. These companies may use cookies and similar technologies to serve ads
        based on your prior visits to this and other websites. Google&apos;s use of advertising
        cookies enables it and its partners to serve ads based on your visits to this site
        and/or other sites on the Internet.
      </p>
      <p className="text-zinc-700 dark:text-zinc-300">
        You may opt out of personalized advertising by visiting{" "}
        <a
          href="https://adssettings.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-600 hover:underline"
        >
          Google Ads Settings
        </a>
        . You can also learn more about how Google uses data at{" "}
        <a
          href="https://policies.google.com/technologies/partner-sites"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-600 hover:underline"
        >
          policies.google.com/technologies/partner-sites
        </a>
        .
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Third-party links</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        Our site may contain links to other websites. We are not responsible for the privacy
        practices of those third-party sites.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Children&apos;s privacy</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        This site is not directed at children under 13, and we do not knowingly collect
        personal information from children.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Changes to this policy</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        We may update this Privacy Policy from time to time. Changes will be posted on this
        page.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Contact us</h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        If you have questions about this policy, please visit our{" "}
        <a href="/contact" className="text-red-600 hover:underline">
          Contact page
        </a>
        .
      </p>
    </div>
  );
}
