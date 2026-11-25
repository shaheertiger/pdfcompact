/**
 * Shared step for Markdown to PDF and Jupyter Notebook to PDF: lay out an
 * HTML string with the selectable-text engine in lib/html-layout.ts and
 * describe anything that could not be drawn.
 */
import { dataUriBytes, htmlToPdf, toEmbeddable, type LayoutOptions } from "./html-layout";
import { htmlBody } from "./markdown-pdf";

export type DocPdfResult = { bytes: Uint8Array; pages: number; images: number; warnings: string[] };

export async function htmlStringToPdf(
  html: string,
  opts: Pick<LayoutOptions, "pageSize" | "pageNumbers" | "title" | "onProgress"> & { baseSize?: number }
): Promise<DocPdfResult> {
  const body = htmlBody(html);
  let remote = 0;
  const out = await htmlToPdf([body], {
    pageSize: opts.pageSize,
    font: "sans",
    baseSize: opts.baseSize ?? 10.5,
    pageNumbers: opts.pageNumbers,
    title: opts.title,
    onProgress: opts.onProgress,
    loadImage: async (src) => {
      const d = dataUriBytes(src);
      if (!d) {
        remote++;
        return null;
      }
      return toEmbeddable(d.bytes, d.mime);
    },
  });
  const warnings: string[] = [];
  if (remote) {
    warnings.push(
      `${remote} image${remote === 1 ? " links" : "s link"} to a web address or a file next to your document, so ${remote === 1 ? "it was" : "they were"} left out (its alt text is shown instead). Nothing is fetched from the internet.`
    );
  }
  const broken = out.skippedImages - remote;
  if (broken > 0) {
    warnings.push(`${broken} embedded image${broken === 1 ? " couldn't" : "s couldn't"} be decoded and ${broken === 1 ? "was" : "were"} left out.`);
  }
  if (out.replaced) {
    warnings.push(
      `${out.replaced} character${out.replaced === 1 ? " was" : "s were"} replaced (${out.samples.join(" ")}). The built-in PDF fonts cover Latin-script text only, so emoji, CJK and most math symbols can't be drawn.`
    );
  }
  return { bytes: out.bytes, pages: out.pages, images: out.images, warnings };
}
