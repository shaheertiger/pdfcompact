/** Canonical origin: the apex host, no trailing slash. www redirects here (next.config.ts). */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://pdfcompact.com";

export const siteName = "PDFCompact";

/** How people search for the brand ("pdf compact"); used as schema.org alternateName. */
export const siteAlternateNames = ["PDF Compact", "pdfcompact.com"];

export const contactEmail = "support@pdfcompact.com";

/** Organization node shared by every page's JSON-LD graph. */
export const organizationId = `${siteUrl}/#organization`;

export const organizationJsonLd = {
  "@type": "Organization",
  "@id": organizationId,
  name: siteName,
  alternateName: siteAlternateNames,
  url: siteUrl,
  logo: `${siteUrl}/apple-icon`,
  email: contactEmail,
  sameAs: ["https://pdfcanada.ca/"],
};
