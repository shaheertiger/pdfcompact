import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { registry } from "@/lib/registry";
import { getToolContent } from "@/lib/content";

// lastmod is honest: tool pages use the `updated` date from their content
// file, which only changes when the facts on the page change.
const STATIC_UPDATED = "2026-11-12";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["", "/how-it-works", "/about", "/contact", "/privacy", "/terms"];
  const entries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: STATIC_UPDATED,
  }));
  entries[0].alternates = { languages: { en: siteUrl, es: `${siteUrl}/es` } };
  entries.push({
    url: `${siteUrl}/es`,
    lastModified: STATIC_UPDATED,
    alternates: { languages: { en: siteUrl, es: `${siteUrl}/es` } },
  });

  for (const t of registry) {
    const languages = t.es ? { en: `${siteUrl}/${t.slug}`, es: `${siteUrl}/es/${t.es.slug}` } : undefined;
    entries.push({
      url: `${siteUrl}/${t.slug}`,
      lastModified: getToolContent(t.slug).updated,
      ...(languages && { alternates: { languages } }),
    });
    if (t.es && languages) {
      entries.push({
        url: languages.es,
        lastModified: getToolContent(t.slug, "es").updated,
        alternates: { languages },
      });
    }
  }
  return entries;
}
