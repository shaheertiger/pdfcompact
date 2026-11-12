import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "../../globals.css";
import { Analytics } from "@vercel/analytics/next";
import { siteUrl, siteName } from "@/lib/site";
import { registry } from "@/lib/registry";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = { themeColor: "#dc2626" };

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: { default: "Herramientas PDF gratis, sin subir archivos | PDFCompact", template: `%s | ${siteName}` },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

const esTools = registry.filter((t) => t.es);

export default function SpanishLayout({ children }: LayoutProps<"/es">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <header className="border-b border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 sticky top-0 z-40">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
            <Link href="/es" className="font-bold text-lg shrink-0" aria-label="PDFCompact en español">
              PDF<span className="text-red-600">Compact</span>
            </Link>
            <nav aria-label="Principal" className="flex min-w-0 items-center gap-1 text-sm overflow-x-auto [scrollbar-width:none] -mr-2">
              {esTools.map((t) => (
                <Link key={t.slug} href={`/es/${t.es!.slug}`} className="px-2.5 sm:px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 font-medium whitespace-nowrap">
                  {t.es!.name}
                </Link>
              ))}
              <Link href="/" hrefLang="en" className="px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-zinc-500 whitespace-nowrap">
                English
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="border-t border-black/10 dark:border-white/10 mt-16 bg-zinc-50 dark:bg-zinc-950">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="font-bold text-lg mb-2">PDF<span className="text-red-600">Compact</span></div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-sm">
                Herramientas PDF gratuitas que funcionan en tu navegador. Tus archivos nunca salen de tu dispositivo.
              </p>
            </div>
            <ul className="grid gap-1.5 text-sm">
              {esTools.map((t) => (
                <li key={t.slug}>
                  <Link href={`/es/${t.es!.slug}`} className="text-zinc-600 dark:text-zinc-400 hover:text-red-600">{t.es!.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 border-t border-black/10 dark:border-white/10 text-xs text-zinc-500 flex flex-wrap gap-4 justify-between">
            <p>&copy; {new Date().getFullYear()} PDFCompact</p>
            <p>Páginas legales (en inglés): <Link href="/privacy" className="hover:text-red-600">Privacidad</Link> · <Link href="/terms" className="hover:text-red-600">Términos</Link> · <Link href="/contact" className="hover:text-red-600">Contacto</Link></p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
