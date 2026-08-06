import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { tools } from "@/lib/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/about", priority: 0.3, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.3, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.1, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.1, changeFrequency: "yearly" },
  ];

  return [
    ...staticPages.map(({ path, priority, changeFrequency }) => ({
      url: `${siteUrl}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    })),
    ...tools.map((tool) => ({
      url: `${siteUrl}/tools/${tool.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
