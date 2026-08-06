import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { tools } from "@/lib/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["", "/about", "/contact", "/privacy", "/terms"];

  return [
    ...staticPages.map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified: new Date(),
    })),
    ...tools.map((tool) => ({
      url: `${siteUrl}/tools/${tool.slug}`,
      lastModified: new Date(),
    })),
  ];
}
