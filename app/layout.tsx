import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSenseScript from "@/components/AdSenseScript";
import { siteUrl, siteName } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#dc2626",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: `${siteName} — Free PDF Tools in Your Browser`,
    template: `%s | ${siteName}`,
  },
  description:
    "Merge, split, rearrange, edit, sign, and convert PDFs for free. Every tool runs locally in your browser — no uploads, no waiting.",
  openGraph: {
    type: "website",
    siteName,
    url: siteUrl,
    title: `${siteName} — Free PDF Tools in Your Browser`,
    description:
      "Merge, split, rearrange, edit, sign, and convert PDFs for free. Every tool runs locally in your browser.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} — Free PDF Tools in Your Browser`,
    description:
      "Merge, split, rearrange, edit, sign, and convert PDFs for free. Every tool runs locally in your browser.",
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  sameAs: ["https://pdfcanada.ca/"],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  url: siteUrl,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-black text-zinc-900 dark:text-zinc-100">
        <Header />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
        <AdSenseScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </body>
    </html>
  );
}
