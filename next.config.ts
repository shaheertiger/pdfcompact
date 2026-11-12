import type { NextConfig } from "next";
import { registry } from "./lib/registry";

const isDev = process.env.NODE_ENV === "development";
const adsEnabled = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);

// AdSense needs these hosts; they are only allowed once ads are switched on.
const adHosts = adsEnabled
  ? " https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com https://*.adtrafficquality.google"
  : "";

const csp = [
  "default-src 'self'",
  // 'unsafe-inline': static pages can't carry per-request nonces.
  // 'wasm-unsafe-eval': the OCR engine is WebAssembly.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ""}${adHosts}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${adHosts}`,
  "font-src 'self' data:",
  `connect-src 'self' blob: data:${adHosts}`,
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  `frame-src 'self'${adHosts}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async redirects() {
    return [
      // One canonical host: the apex. (Also set this in Vercel → Domains.)
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.pdfcompact.com" }],
        destination: "https://pdfcompact.com/:path*",
        permanent: true,
      },
      // Old /tools/* URLs and spelling variants → one URL per intent (308).
      ...registry.flatMap((t) =>
        (t.legacy ?? []).map((source) => ({ source, destination: `/${t.slug}`, permanent: true }))
      ),
      { source: "/tools", destination: "/#tools", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // The camera is used by Scan to PDF on this origin only.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
      {
        // Versioned worker/WASM/OCR files never change at a given path.
        source: "/vendor/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
