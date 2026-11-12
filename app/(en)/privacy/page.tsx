import type { Metadata } from "next";
import Link from "next/link";
import { siteName, contactEmail } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `${siteName}'s privacy policy: files are processed in your browser and never uploaded. Cookie-free analytics only. What we collect and why.`,
  alternates: { canonical: "/privacy" },
};

const UPDATED = "November 12, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14 w-full">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-zinc-500 mt-2">Last updated: {UPDATED}</p>
      <div className="article mt-6">
        <h2>Your files never leave your device</h2>
        <p>
          Every {siteName} tool runs in your web browser. When you choose a PDF or image, it is read
          and processed on your device and saved back to your device. We don&apos;t receive, store or
          have access to your files, their names or their contents. <Link href="/how-it-works">How
          this works, and how to check it</Link>.
        </p>

        <h2>What we collect</h2>
        <p>
          We use Vercel Web Analytics to count page views. It doesn&apos;t use cookies, doesn&apos;t
          identify you, and doesn&apos;t track you across sites. It records which pages are visited,
          the referring site, country, browser and device type, aggregated so no individual visitor
          can be singled out. Our host, Vercel, keeps standard server logs (such as IP address and
          requested URL) for security and operations.
        </p>
        <p>
          The OCR and image tools download their language and engine files from our own domain. Those
          requests contain no part of your documents.
        </p>

        <h2>Cookies and advertising</h2>
        <p>
          {siteName} currently shows no ads and sets no advertising cookies. If we add ads in the future
          (for example Google AdSense, placed below the tools), this policy will be updated first.
          Third-party vendors such as Google may then use cookies to serve ads based on prior visits to
          this and other websites; you can opt out of personalized advertising at{" "}
          <a href="https://adssettings.google.com/" target="_blank" rel="noopener">Google Ads Settings</a>.
        </p>

        <h2>Emails you send us</h2>
        <p>
          If you email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>, we use your address and
          message only to reply. Please don&apos;t attach private documents; we never need them.
        </p>

        <h2>Children</h2>
        <p>This site isn&apos;t directed at children under 13, and we don&apos;t knowingly collect their personal information.</p>

        <h2>Changes</h2>
        <p>We&apos;ll post any change to this policy on this page and update the date above.</p>
      </div>
    </div>
  );
}
