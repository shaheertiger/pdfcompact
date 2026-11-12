import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSenseScript from "@/components/AdSenseScript";
import { Analytics } from "@vercel/analytics/next";
import { siteUrl, siteName } from "@/lib/site";
import { registry } from "@/lib/registry";

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

const defaultTitle = "Free PDF Tools — Compress, Merge, OCR, No Upload | PDFCompact";
const defaultDescription =
  `${registry.length} free PDF tools that run in your browser: compress, merge, split, OCR, convert, sign and more. No upload, no sign-up, no watermark.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  openGraph: { type: "website", siteName, url: siteUrl, title: defaultTitle, description: defaultDescription },
  twitter: { card: "summary_large_image", title: defaultTitle, description: defaultDescription },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <Header />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
        <AdSenseScript />
        <Analytics />
      </body>
    </html>
  );
}
