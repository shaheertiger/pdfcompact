// Pings IndexNow (Bing, Yandex, Seznam, Naver; Bing feeds several AI engines)
// with every URL in the sitemap after a production build on Vercel. Never
// fails the build. The key is public by design; its file is public/<key>.txt.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KEY = "8ea53f78c4efed4ef9a952ffad4b566b";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.VERCEL_ENV !== "production") {
  console.log("IndexNow: skipped (not a Vercel production build).");
  process.exit(0);
}

try {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://pdfcompact.com").replace(/\/$/, "");
  const { registry } = await import(join(root, "lib", "registry.ts"));
  const urls = [
    siteUrl,
    `${siteUrl}/es`,
    ...registry.map((t) => `${siteUrl}/${t.slug}`),
    ...registry.filter((t) => t.es).map((t) => `${siteUrl}/es/${t.es.slug}`),
  ];
  readFileSync(join(root, "public", `${KEY}.txt`)); // key file must ship
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(siteUrl).host, key: KEY, keyLocation: `${siteUrl}/${KEY}.txt`, urlList: urls }),
  });
  console.log(`IndexNow: submitted ${urls.length} URLs, HTTP ${res.status}.`);
} catch (e) {
  console.warn("IndexNow: ping failed (build continues):", e?.message ?? e);
}
