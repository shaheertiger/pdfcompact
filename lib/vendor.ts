/**
 * Self-hosted worker and WASM assets, copied from node_modules into
 * public/vendor by scripts/copy-vendor-assets.mjs. Versioned paths let us
 * serve them with an immutable cache header. The copy script fails the build
 * if these versions drift from the installed packages.
 */
export const PDFJS_VERSION = "5.4.624";
export const TESSERACT_VERSION = "7.0.0";
export const TESSERACT_CORE_VERSION = "7.0.0";

export const pdfWorkerSrc = `/vendor/pdfjs-${PDFJS_VERSION}/pdf.worker.min.mjs`;
export const tesseractWorkerPath = `/vendor/tesseract-${TESSERACT_VERSION}/worker.min.js`;
export const tesseractCorePath = `/vendor/tesseract-core-${TESSERACT_CORE_VERSION}`;
export const tesseractLangPath = `/vendor/tessdata-4.0.0_best_int`;

export const ocrLanguages = [
  { code: "eng", label: "English" },
  { code: "hin", label: "Hindi (हिन्दी)" },
  { code: "spa", label: "Spanish (Español)" },
  { code: "fra", label: "French (Français)" },
  { code: "deu", label: "German (Deutsch)" },
  { code: "por", label: "Portuguese (Português)" },
] as const;
