/**
 * Open a PDF for editing with the @cantoo/pdf-lib fork, which decrypts files
 * that only carry a permissions (owner) password, common on bank statements.
 * Plain pdf-lib with ignoreEncryption would write unreadable page streams for
 * those. Files that need a password to open throw a friendly PdfOpenError.
 */
import type { PDFDocument } from "@cantoo/pdf-lib";

export class PdfOpenError extends Error {}

export async function loadEditable(data: ArrayBuffer | Uint8Array): Promise<PDFDocument> {
  const lib = await import("@cantoo/pdf-lib");
  try {
    return await lib.PDFDocument.load(data, { ignoreEncryption: true, password: "", updateMetadata: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password|encrypt/i.test(msg)) {
      throw new PdfOpenError("This PDF needs a password to open. Remove the password first, then try again.");
    }
    throw new PdfOpenError("Couldn't read this PDF. It may be damaged or not a real PDF.");
  }
}

/** Friendly message for an error thrown while editing a PDF. */
export function editErrorMessage(e: unknown, fallback: string): string {
  return e instanceof PdfOpenError ? e.message : fallback;
}
