/** Canonical origin: the apex host, no trailing slash. www redirects here (next.config.ts). */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://pdfcompact.com";

export const siteName = "PDFCompact";

export const contactEmail = "support@pdfcompact.com";

/** Organization node shared by every page's JSON-LD graph. */
export const organizationId = `${siteUrl}/#organization`;

export const organizationJsonLd = {
  "@type": "Organization",
  "@id": organizationId,
  name: siteName,
  url: siteUrl,
  logo: `${siteUrl}/apple-icon`,
  email: contactEmail,
  sameAs: ["https://pdfcanada.ca/"],
};
