/**
 * Read a DRM-free EPUB (2 or 3) in the browser: container.xml → OPF →
 * spine order → XHTML chapters. Image references are rewritten to
 * "epub:<path in zip>" so the layout engine can ask for their bytes.
 */
import type JSZip from "jszip";

export type EpubBook = {
  title: string;
  author: string;
  chapters: Element[];
  readImage: (src: string) => Promise<{ bytes: Uint8Array; mime: string } | null>;
};

export class EpubError extends Error {}

const FONT_OBFUSCATION = new Set(["http://www.idpf.org/2008/embedding", "http://ns.adobe.com/pdf/enc#RC"]);

function parseXml(text: string, type: DOMParserSupportedType = "application/xml"): Document {
  return new DOMParser().parseFromString(text, type);
}

function failed(doc: Document): boolean {
  return doc.getElementsByTagName("parsererror").length > 0;
}

function byLocalName(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter((e) => e.localName === name);
}

/** Resolve a relative href against the directory of `base` (both zip paths). */
export function resolvePath(base: string, href: string): string {
  const clean = href.split("#")[0].split("?")[0];
  let decoded = clean;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    /* keep as is */
  }
  if (decoded.startsWith("/")) return decoded.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const seg of decoded.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  return parts.join("/");
}

/** Throw if the book is DRM-protected (anything encrypted besides obfuscated fonts). */
async function checkDrm(zip: JSZip) {
  if (zip.file("META-INF/rights.xml") || zip.file("META-INF/sinf.xml")) {
    throw new EpubError(
      "This e-book is DRM-protected (copy protection from the store that sold it), so it can't be converted. Only DRM-free EPUB files work, such as ones from Project Gutenberg, Standard Ebooks, or publishers that sell without DRM."
    );
  }
  const enc = zip.file("META-INF/encryption.xml");
  if (!enc) return;
  const doc = parseXml(await enc.async("string"));
  for (const data of byLocalName(doc, "EncryptedData")) {
    const alg = byLocalName(data, "EncryptionMethod")[0]?.getAttribute("Algorithm") ?? "";
    const uri = byLocalName(data, "CipherReference")[0]?.getAttribute("URI") ?? "";
    const isFont = /\.(otf|ttf|woff2?)$/i.test(uri);
    if (!(FONT_OBFUSCATION.has(alg) && isFont)) {
      throw new EpubError(
        "This e-book is DRM-protected (its chapters are encrypted), so it can't be converted. Only DRM-free EPUB files work, such as ones from Project Gutenberg, Standard Ebooks, or publishers that sell without DRM."
      );
    }
  }
}

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

export async function readEpub(data: ArrayBuffer): Promise<EpubBook> {
  const { default: JSZipCtor } = await import("jszip");
  let zip: JSZip;
  try {
    zip = await JSZipCtor.loadAsync(data);
  } catch {
    throw new EpubError("This file isn't a valid EPUB (it isn't a ZIP archive). It may be damaged or a different e-book format.");
  }
  await checkDrm(zip);

  const container = zip.file("META-INF/container.xml");
  let opfPath = "";
  if (container) {
    const doc = parseXml(await container.async("string"));
    opfPath = byLocalName(doc, "rootfile")[0]?.getAttribute("full-path") ?? "";
  }
  if (!opfPath || !zip.file(opfPath)) {
    opfPath = Object.keys(zip.files).find((p) => p.toLowerCase().endsWith(".opf")) ?? "";
  }
  if (!opfPath) throw new EpubError("This EPUB has no package file (content.opf), so its chapters can't be found.");

  const opf = parseXml(await zip.file(opfPath)!.async("string"));
  if (failed(opf)) throw new EpubError("This EPUB's package file is damaged, so its chapters can't be read.");
  const title = byLocalName(opf, "title")[0]?.textContent?.trim() ?? "";
  const author = byLocalName(opf, "creator")[0]?.textContent?.trim() ?? "";

  const manifest = new Map<string, { href: string; type: string; props: string }>();
  for (const item of byLocalName(opf, "item")) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) {
      manifest.set(id, {
        href: resolvePath(opfPath, href),
        type: item.getAttribute("media-type") ?? "",
        props: item.getAttribute("properties") ?? "",
      });
    }
  }
  const mimeByPath = new Map<string, string>();
  manifest.forEach((m) => mimeByPath.set(m.href, m.type));

  const spine = byLocalName(opf, "itemref")
    .map((ref) => manifest.get(ref.getAttribute("idref") ?? ""))
    .filter((m): m is { href: string; type: string; props: string } => !!m && /html|xml/.test(m.type));
  if (!spine.length) throw new EpubError("This EPUB has no readable chapters in its reading order (spine).");

  const chapters: Element[] = [];
  for (const item of spine) {
    const f = zip.file(item.href);
    if (!f) continue;
    const text = await f.async("string");
    let doc = parseXml(text, "application/xhtml+xml");
    if (failed(doc)) doc = parseXml(text, "text/html");
    const body = byLocalName(doc, "body")[0] ?? doc.documentElement;
    if (!body) continue;
    // Point images at their path inside the zip.
    for (const img of byLocalName(body, "img")) {
      const src = img.getAttribute("src");
      if (src && !/^(data:|https?:)/i.test(src)) img.setAttribute("src", "epub:" + resolvePath(item.href, src));
    }
    for (const img of byLocalName(body, "image")) {
      const href = img.getAttribute("href") ?? img.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      if (href) img.setAttribute("href", "epub:" + resolvePath(item.href, href));
    }
    chapters.push(body);
  }
  if (!chapters.length) throw new EpubError("None of this EPUB's chapters could be read.");

  return {
    title,
    author,
    chapters,
    readImage: async (src) => {
      if (!src.startsWith("epub:")) return null;
      const path = src.slice(5);
      const file = zip.file(path);
      if (!file) return null;
      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      return { bytes: await file.async("uint8array"), mime: mimeByPath.get(path) || IMAGE_MIME[ext] || "" };
    },
  };
}
