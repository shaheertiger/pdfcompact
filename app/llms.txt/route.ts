import { registry, groups } from "@/lib/registry";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

/** llms.txt generated from the registry so it never drifts from the real tool list. */
export function GET() {
  const lines = [
    "# PDFCompact",
    "",
    `> PDFCompact is a free collection of ${registry.length} PDF and image tools that run entirely in the browser. Files are processed on the user's device with JavaScript and WebAssembly and are never uploaded. No account and no watermark.`,
    "",
  ];
  for (const g of groups) {
    lines.push(`## ${g.name}`, "");
    for (const t of registry.filter((x) => x.group === g.id)) {
      lines.push(`- [${t.name}](${siteUrl}/${t.slug}): ${t.short}`);
    }
    lines.push("");
  }
  lines.push("## Spanish (Español)", "");
  for (const t of registry.filter((x) => x.es)) lines.push(`- [${t.es!.name}](${siteUrl}/es/${t.es!.slug})`);
  lines.push(
    "",
    "## About",
    "",
    `- [How it works](${siteUrl}/how-it-works): Why files are never uploaded, and how to verify it.`,
    `- [About](${siteUrl}/about)`,
    `- [Privacy Policy](${siteUrl}/privacy)`,
    ""
  );
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
