export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type });
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return bytesToBlob(bytes, "application/pdf");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Strip a known extension from a file name. */
export function baseName(filename: string): string {
  return filename.replace(/\.(pdf|docx?|xlsx?|csv|epub|heic|heif|jpe?g|png|webp)$/i, "");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/** Zip several outputs into one blob. */
export async function zipFiles(files: { name: string; data: Blob | Uint8Array }[]): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  return zip.generateAsync({ type: "blob" });
}

/** Parse "1-3, 5, 8-10" into 0-based page indices (sorted, unique). */
export function parsePageList(input: string, pageCount: number): number[] {
  const out = new Set<number>();
  for (const raw of input.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) throw new Error(`"${part}" isn't a page or range. Use something like 1-3, 5.`);
    const a = parseInt(m[1], 10);
    const b = m[2] ? parseInt(m[2], 10) : a;
    if (a < 1 || b > pageCount || a > b) {
      throw new Error(`"${part}" is outside this file's pages (1–${pageCount}).`);
    }
    for (let i = a; i <= b; i++) out.add(i - 1);
  }
  return [...out].sort((x, y) => x - y);
}
