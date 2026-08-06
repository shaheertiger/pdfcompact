import Script from "next/script";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

/**
 * Loads the Google AdSense script site-wide once NEXT_PUBLIC_ADSENSE_CLIENT
 * is set (e.g. "ca-pub-1234567890123456"). No-op until then, so the site
 * stays fully AdSense-compatible but doesn't request ads before approval.
 */
export default function AdSenseScript() {
  if (!ADSENSE_CLIENT) return null;

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
