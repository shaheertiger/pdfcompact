/**
 * The single source of truth for which tools exist.
 *
 * Plain data only, with no imports, so Node can load it directly from
 * scripts/check-content.mjs (type stripping) as well as from Next.js.
 *
 * Every entry needs a matching content file at content/tools/<slug>.md and a
 * client component registered in components/tools/index.tsx. The content
 * linter fails the build when either is missing.
 */

export type GroupId =
  | "organize"
  | "optimize"
  | "convert-from"
  | "convert-to"
  | "edit-sign"
  | "scan-ocr"
  | "image";

export type ToolEntry = {
  slug: string;
  /** Short name used in navigation, cards and auto-links ("Compress PDF"). */
  name: string;
  /** One line for the homepage hub and related-tool cards. */
  short: string;
  group: GroupId;
  /** lucide-react icon name, mapped in components/ToolIcon.tsx. */
  icon: string;
  /** "main" pages need 800+ words; "small" (narrow jobs) need 500+. */
  size: "main" | "small";
  /** Old URLs that 308-redirect to this tool. */
  legacy?: string[];
  /** Fully translated Spanish page at /es/<slug>. */
  es?: { slug: string; name: string };
};

export type Group = { id: GroupId; name: string; blurb: string };

export const groups: Group[] = [
  {
    id: "organize",
    name: "Organize PDF",
    blurb: "Merge, split, reorder, rotate and remove pages.",
  },
  {
    id: "optimize",
    name: "Optimize PDF",
    blurb: "Make files smaller, flatten them, or compare two versions.",
  },
  {
    id: "convert-from",
    name: "Convert from PDF",
    blurb: "Turn a PDF into Word, Excel, images, text or an e-book.",
  },
  {
    id: "convert-to",
    name: "Convert to PDF",
    blurb: "Turn photos, Word, Excel and e-books into a PDF.",
  },
  {
    id: "edit-sign",
    name: "Edit and Sign",
    blurb: "Add text, signatures, page numbers, watermarks and passwords.",
  },
  {
    id: "scan-ocr",
    name: "Scan and OCR",
    blurb: "Scan paper with your phone and make scans searchable.",
  },
  {
    id: "image",
    name: "Image Tools",
    blurb: "Compress, resize and fix photos and screenshots.",
  },
];

export const registry: ToolEntry[] = [
  // Organize
  { slug: "merge-pdf", name: "Merge PDF", short: "Combine several PDFs into one file, in any order.", group: "organize", icon: "Combine", size: "main", legacy: ["/merge", "/tools/merge-pdf", "/combine-pdf"], es: { slug: "unir-pdf", name: "Unir PDF" } },
  { slug: "split-pdf", name: "Split PDF", short: "Split by page ranges or every N pages, download as ZIP.", group: "organize", icon: "Scissors", size: "main", legacy: ["/tools/split"], es: { slug: "dividir-pdf", name: "Dividir PDF" } },
  { slug: "organize-pdf", name: "Organize PDF", short: "Reorder, rotate and delete pages by dragging thumbnails.", group: "organize", icon: "LayoutGrid", size: "main", legacy: ["/tools/rearrange", "/rearrange-pdf"] },
  { slug: "delete-pdf-pages", name: "Delete PDF Pages", short: "Click the pages you don't want and save the rest.", group: "organize", icon: "Trash2", size: "small", legacy: ["/tools/remove-pages", "/remove-pdf-pages"] },
  { slug: "extract-pdf-pages", name: "Extract PDF Pages", short: "Pull chosen pages out into a new PDF.", group: "organize", icon: "FileOutput", size: "small", legacy: ["/tools/extract"] },
  { slug: "rotate-pdf", name: "Rotate PDF", short: "Turn pages 90° or 180°, one page or all of them.", group: "organize", icon: "RotateCw", size: "main" },
  { slug: "split-pdf-by-size", name: "Split PDF by Size", short: "Cut a big PDF into parts under a size you set (e.g. 10 MB).", group: "organize", icon: "Ruler", size: "small" },
  { slug: "split-pdf-in-half", name: "Split PDF Pages in Half", short: "Cut two-page scanned spreads into single pages.", group: "organize", icon: "SquareSplitHorizontal", size: "small" },
  { slug: "crop-pdf", name: "Crop PDF", short: "Trim margins off every page or just one.", group: "organize", icon: "Crop", size: "main" },

  // Optimize
  { slug: "compress-pdf", name: "Compress PDF", short: "Shrink a PDF with 3 levels and see the new size first.", group: "optimize", icon: "Minimize2", size: "main", es: { slug: "comprimir-pdf", name: "Comprimir PDF" } },
  { slug: "flatten-pdf", name: "Flatten PDF", short: "Lock form fields and annotations into the page.", group: "optimize", icon: "Layers", size: "small" },
  { slug: "compare-pdf", name: "Compare PDF", short: "Highlight every changed word, number and date between two PDFs.", group: "optimize", icon: "Diff", size: "main" },
  { slug: "pdf-to-pdfa", name: "PDF to PDF/A", short: "Make an archive-ready PDF/A-2b copy of a document.", group: "optimize", icon: "FileArchive", size: "main" },

  // Convert from PDF
  { slug: "pdf-to-word", name: "PDF to Word", short: "Turn PDF text into an editable .docx file.", group: "convert-from", icon: "FileType", size: "main", legacy: ["/tools/pdf-to-word"] },
  { slug: "pdf-to-text", name: "PDF to Text", short: "Pull all the text out of a PDF as a .txt file.", group: "convert-from", icon: "FileText", size: "small", legacy: ["/tools/pdf-to-text"] },
  { slug: "pdf-to-jpg", name: "PDF to JPG", short: "Save every page as a sharp JPG image.", group: "convert-from", icon: "FileImage", size: "main", legacy: ["/tools/pdf-to-jpg"] },
  { slug: "pdf-to-png", name: "PDF to PNG", short: "Save pages as lossless PNG images, transparent if you like.", group: "convert-from", icon: "Image", size: "small" },
  { slug: "pdf-to-excel", name: "PDF to Excel", short: "Pull tables out of a PDF into an .xlsx spreadsheet.", group: "convert-from", icon: "FileSpreadsheet", size: "main", es: { slug: "pdf-a-excel", name: "PDF a Excel" } },
  { slug: "extract-images", name: "Extract Images from PDF", short: "Save every picture inside a PDF at its original size.", group: "convert-from", icon: "Images", size: "small" },

  // Convert to PDF
  { slug: "jpg-to-pdf", name: "JPG to PDF", short: "Turn JPG, PNG or WebP photos into one PDF.", group: "convert-to", icon: "FileImage", size: "main", legacy: ["/tools/image-to-pdf", "/image-to-pdf", "/jpeg-to-pdf", "/png-to-pdf"] },
  { slug: "word-to-pdf", name: "Word to PDF", short: "Convert a .docx file to PDF without Microsoft Word.", group: "convert-to", icon: "FileText", size: "main", legacy: ["/docx-to-pdf"] },
  { slug: "excel-to-pdf", name: "Excel to PDF", short: "Turn .xlsx sheets or CSV files into a printable PDF.", group: "convert-to", icon: "Sheet", size: "main", legacy: ["/xlsx-to-pdf"] },
  { slug: "heic-to-pdf", name: "HEIC to PDF", short: "Convert iPhone photos (HEIC) straight to PDF.", group: "convert-to", icon: "Smartphone", size: "small" },
  { slug: "epub-to-pdf", name: "EPUB to PDF", short: "Turn a DRM-free e-book into a printable PDF.", group: "convert-to", icon: "BookText", size: "small" },

  // Edit and Sign
  { slug: "edit-pdf", name: "Edit PDF", short: "Add text, highlights and boxes on top of any page.", group: "edit-sign", icon: "PenLine", size: "main", legacy: ["/tools/edit-pdf"] },
  { slug: "sign-pdf", name: "Sign PDF", short: "Draw or type a signature and place it on the page.", group: "edit-sign", icon: "FileSignature", size: "main", legacy: ["/tools/sign"] },
  { slug: "add-page-numbers", name: "Add Page Numbers", short: "Number pages with your choice of position and style.", group: "edit-sign", icon: "Hash", size: "small" },
  { slug: "watermark-pdf", name: "Watermark PDF", short: "Stamp text like CONFIDENTIAL or DRAFT across every page.", group: "edit-sign", icon: "Stamp", size: "small" },
  { slug: "add-image-to-pdf", name: "Add Image to PDF", short: "Place a photo, logo or stamp anywhere on a PDF page.", group: "edit-sign", icon: "ImagePlus", size: "small" },
  { slug: "protect-pdf", name: "Protect PDF", short: "Lock a PDF with a password (AES-256).", group: "edit-sign", icon: "Lock", size: "main" },

  // Scan and OCR
  { slug: "ocr-pdf", name: "OCR PDF", short: "Make scanned PDFs searchable and copyable, in 6 languages.", group: "scan-ocr", icon: "ScanText", size: "main" },
  { slug: "scan-to-pdf", name: "Scan to PDF", short: "Use your phone camera to scan paper into a clean PDF.", group: "scan-ocr", icon: "Camera", size: "main" },

  // Image tools
  { slug: "compress-image", name: "Compress Image", short: "Shrink JPG, PNG and WebP photos to a target size in KB.", group: "image", icon: "ImageDown", size: "main", legacy: ["/compress-jpg", "/compress-png"] },
  { slug: "resize-image", name: "Resize Image", short: "Resize photos by pixels, percent or for Instagram, passports and more.", group: "image", icon: "Scaling", size: "main" },
  { slug: "edit-text-in-image", name: "Edit Text in Image", short: "Find text in a picture, cover it and type new words.", group: "image", icon: "TextCursorInput", size: "main" },
  { slug: "heic-to-jpg", name: "HEIC to JPG", short: "Convert iPhone HEIC photos to JPG, in bulk.", group: "image", icon: "Smartphone", size: "small" },
];

/** Legacy tool URLs whose old in-page tool no longer exists (none yet). */
export const retiredPaths: string[] = [];
