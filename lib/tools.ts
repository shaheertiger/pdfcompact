export type Category = "organize" | "convert" | "edit-sign";

export type FaqItem = { question: string; answer: string };

export type Tool = {
  slug: string;
  name: string;
  short: string;
  description: string;
  icon: string;
  category: Category;
  keywords: string[];
  about: string[];
  howTo: string[];
  faq: FaqItem[];
};

export const tools: Tool[] = [
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    short: "Combine PDFs into one file",
    description:
      "Combine multiple PDF files into a single document in the order you choose.",
    icon: "Combine",
    category: "organize",
    keywords: ["merge pdf", "combine pdf", "join pdf files"],
    about: [
      "Merging PDFs is useful whenever you need to send one file instead of several — combining scanned receipts, stitching together chapters of a report, or joining signed contract pages into a single document.",
      "This merger keeps every page's original formatting, fonts, and images intact. It simply copies pages from each source file into a new PDF in the order you set.",
    ],
    howTo: [
      "Upload two or more PDF files using the box above.",
      "Drag the files or use the arrow buttons to set the order you want.",
      "Click \"Merge\" to combine them into a single PDF.",
      "Your merged PDF downloads automatically — nothing is uploaded to a server.",
    ],
    faq: [
      {
        question: "Is there a limit to how many PDFs I can merge?",
        answer:
          "No hard limit — merging happens in your browser, so it's limited only by your device's memory.",
      },
      {
        question: "Will merging affect the quality of my PDFs?",
        answer:
          "No. Pages are copied as-is, so text, images, and formatting stay exactly the same.",
      },
      {
        question: "Are my files uploaded anywhere?",
        answer:
          "No. Everything happens locally in your browser using JavaScript — your files never leave your device.",
      },
    ],
  },
  {
    slug: "split",
    name: "Split PDF",
    short: "Split a PDF into multiple files",
    description:
      "Split a PDF by page ranges or every N pages and download the results as a ZIP.",
    icon: "Scissors",
    category: "organize",
    keywords: ["split pdf", "separate pdf pages"],
    about: [
      "Splitting a large PDF makes it easier to share just the section someone needs — an invoice, a single chapter, or a specific form — without sending the whole document.",
      "Choose to break the file into equal chunks every N pages, or define your own custom ranges for full control over how the document is divided.",
    ],
    howTo: [
      "Upload the PDF you want to split.",
      "Choose to split every N pages, or enter custom page ranges.",
      "Click \"Split PDF\" to generate the separate files.",
      "Download the result — a single PDF, or a ZIP if there are multiple parts.",
    ],
    faq: [
      {
        question: "Can I split by custom page ranges?",
        answer:
          "Yes — switch to \"Custom page ranges\" and enter something like 1-3, 4, 6-8 to create one file per range.",
      },
      {
        question: "What if I only get one output file?",
        answer:
          "If your settings produce a single file, it downloads directly as a PDF instead of a ZIP.",
      },
    ],
  },
  {
    slug: "rearrange",
    name: "Rearrange Pages",
    short: "Reorder pages by dragging thumbnails",
    description:
      "Drag and drop page thumbnails to reorder the pages in your PDF.",
    icon: "ArrowDownUp",
    category: "organize",
    keywords: ["rearrange pdf pages", "reorder pdf"],
    about: [
      "Scanned documents don't always come out in the right order, and reports sometimes need a section moved. This tool lets you see every page as a thumbnail and drag them into the order you actually want.",
    ],
    howTo: [
      "Upload the PDF whose pages you want to reorder.",
      "Wait for the page thumbnails to load.",
      "Drag and drop thumbnails into the order you want.",
      "Click \"Save reordered PDF\" to download the result.",
    ],
    faq: [
      {
        question: "Can I reorder a very large PDF?",
        answer:
          "Yes, though generating thumbnails for very large documents may take a little longer since it all happens on your device.",
      },
    ],
  },
  {
    slug: "remove-pages",
    name: "Remove Pages",
    short: "Delete unwanted pages from a PDF",
    description:
      "Preview every page and remove the ones you don't need in a few clicks.",
    icon: "Trash2",
    category: "organize",
    keywords: ["remove pdf pages", "delete pdf pages"],
    about: [
      "Blank cover sheets, duplicate scans, or an outdated page in a contract — this tool lets you preview every page as a thumbnail and delete exactly the ones you don't need, leaving everything else untouched.",
    ],
    howTo: [
      "Upload the PDF you want to edit.",
      "Click each page you want to delete — it will be marked with a trash icon.",
      "Click \"Remove pages\" to generate the new PDF.",
      "Download automatically starts once it's ready.",
    ],
    faq: [
      {
        question: "Can I remove multiple pages at once?",
        answer: "Yes — click every page you want to delete before saving; they're all removed in one step.",
      },
      {
        question: "Can I undo a removal?",
        answer:
          "Click a marked page again to unmark it before saving. Once you save, upload the original file again to start over.",
      },
    ],
  },
  {
    slug: "extract",
    name: "Extract Pages",
    short: "Pull specific pages into a new PDF",
    description:
      "Select the pages you want and save them as a brand new PDF file.",
    icon: "FileOutput",
    category: "organize",
    keywords: ["extract pdf pages", "get pages from pdf"],
    about: [
      "The opposite of removing pages: pick only the pages you need — a single chapter, an appendix, a signed page — and save them as their own standalone PDF, leaving the original file untouched.",
    ],
    howTo: [
      "Upload the PDF you want to pull pages from.",
      "Click each page you want to keep — selected pages get a checkmark.",
      "Click \"Extract pages\" to build a new PDF from just those pages.",
      "The new PDF downloads automatically, in the order the pages originally appeared.",
    ],
    faq: [
      {
        question: "What order will the extracted pages be in?",
        answer:
          "Selected pages keep their original order from the source document, regardless of the order you clicked them in.",
      },
    ],
  },
  {
    slug: "pdf-to-text",
    name: "PDF to Text",
    short: "Extract plain text from a PDF",
    description:
      "Pull all the text out of a PDF and download it as a .txt file.",
    icon: "FileText",
    category: "convert",
    keywords: ["pdf to text", "extract text from pdf"],
    about: [
      "Need to copy a paragraph, feed a document into another tool, or just read the words without the formatting getting in the way? This pulls the raw text out of every page of your PDF.",
    ],
    howTo: [
      "Upload the PDF you want to extract text from.",
      "Wait a moment while the text is pulled from every page.",
      "Preview the text in the box below.",
      "Click \"Download .txt\" to save it to your device.",
    ],
    faq: [
      {
        question: "Does this work on scanned PDFs?",
        answer:
          "It extracts text that already exists in the PDF. Scanned documents that are just images won't have selectable text to extract.",
      },
    ],
  },
  {
    slug: "pdf-to-word",
    name: "PDF to Word",
    short: "Convert a PDF to an editable .docx",
    description:
      "Convert PDF text into a Microsoft Word (.docx) document you can edit.",
    icon: "FileType",
    category: "convert",
    keywords: ["pdf to word", "convert pdf to docx"],
    about: [
      "Turn a locked-down PDF back into editable text. This tool extracts the words from every page and lays them out in a real .docx file, so you can pick up editing in Word or Google Docs.",
    ],
    howTo: [
      "Upload the PDF you want to convert.",
      "We extract the text from every page, keeping page breaks in place.",
      "A .docx file is generated and downloaded automatically.",
      "Open it in Microsoft Word, Google Docs, or any compatible editor.",
    ],
    faq: [
      {
        question: "Will the layout look exactly like the PDF?",
        answer:
          "This tool focuses on getting editable text into Word format. Complex layouts, columns, and images from the original PDF are not recreated.",
      },
      {
        question: "Does it work on scanned PDFs?",
        answer:
          "It converts text that already exists in the PDF. Scanned image-only documents won't have text to extract.",
      },
    ],
  },
  {
    slug: "image-to-pdf",
    name: "Image to PDF",
    short: "Turn photos and images into a PDF",
    description:
      "Combine JPG, PNG, or WebP images into a single, ready-to-share PDF.",
    icon: "Image",
    category: "convert",
    keywords: ["image to pdf", "jpg to pdf", "png to pdf"],
    about: [
      "Turn a stack of photos, screenshots, or scanned pages into one shareable PDF. Each image becomes its own page, sized to match, in the order you choose.",
    ],
    howTo: [
      "Upload one or more images (JPG, PNG, or WebP).",
      "Drag thumbnails to set the page order.",
      "Click \"Convert to PDF\".",
      "Your PDF, with one image per page, downloads automatically.",
    ],
    faq: [
      {
        question: "What image formats are supported?",
        answer: "JPG, PNG, and WebP all work. Each image becomes its own page, sized to match the image.",
      },
    ],
  },
  {
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    short: "Turn PDF pages into JPG images",
    description:
      "Convert every page of a PDF into a high-quality JPG image, ready to download.",
    icon: "FileImage",
    category: "convert",
    keywords: ["pdf to jpg", "pdf to image", "convert pdf to jpg"],
    about: [
      "The reverse of Image to PDF: turn each page of a PDF into its own JPG image, useful for sharing a page as a picture, dropping it into a slide deck, or posting it online.",
      "Every page is rendered at high resolution. A single-page PDF downloads as one JPG; multi-page PDFs download as a ZIP of JPGs.",
    ],
    howTo: [
      "Upload the PDF you want to convert.",
      "Each page is rendered as a high-resolution JPG image.",
      "Click \"Convert to JPG\".",
      "A single page downloads as one .jpg; multiple pages download together in a .zip.",
    ],
    faq: [
      {
        question: "What resolution are the JPG images?",
        answer:
          "Pages are rendered at roughly double the standard screen resolution, sharp enough for printing or zooming in.",
      },
      {
        question: "Can I convert just one page?",
        answer:
          "This tool converts every page. To convert a single page, use Extract Pages first to pull out just that page, then convert the result.",
      },
    ],
  },
  {
    slug: "edit-pdf",
    name: "Edit PDF",
    short: "Add text, shapes, and highlights",
    description:
      "Add text boxes, highlights, and shapes to your PDF, then save the result.",
    icon: "PenLine",
    category: "edit-sign",
    keywords: ["edit pdf", "annotate pdf"],
    about: [
      "Fill in a blank, leave a note, or highlight an important line — all without special software. Add text boxes and highlights directly on top of your PDF, then save a new copy.",
    ],
    howTo: [
      "Upload the PDF you want to edit.",
      "Click \"Add text\" then click anywhere on the page to place a text box — double-click it to change the wording.",
      "Click \"Highlight\" then drag over an area to draw a highlight.",
      "Drag any text box to reposition it, or click the remove button to delete an annotation.",
      "Click \"Save edited PDF\" to download your changes.",
    ],
    faq: [
      {
        question: "Can I edit text that's already in the PDF?",
        answer:
          "This tool adds new text, highlights, and shapes on top of your PDF rather than rewriting existing text embedded in the document.",
      },
      {
        question: "Do edits apply to every page?",
        answer:
          "Annotations are tracked per page — use the Prev/Next controls to move between pages and add edits to each one.",
      },
    ],
  },
  {
    slug: "sign",
    name: "Sign PDF",
    short: "Draw or type a signature",
    description:
      "Draw, type, or upload a signature and place it anywhere on your PDF.",
    icon: "FileSignature",
    category: "edit-sign",
    keywords: ["sign pdf", "esignature pdf", "electronic signature"],
    about: [
      "Sign a contract, form, or letter without printing it out. Draw your signature with a mouse or finger, or type your name for an instant cursive signature, then drop it onto the page.",
    ],
    howTo: [
      "Upload the PDF you need to sign.",
      "Draw your signature with your mouse or finger, or type your name for a cursive signature.",
      "Click \"Place signature\" and click anywhere on the page to add it — drag to reposition or use +/− to resize.",
      "Click \"Save signed PDF\" to download the finished document.",
    ],
    faq: [
      {
        question: "Is this a legally binding e-signature?",
        answer:
          "This tool adds a visual signature image to your PDF. For signatures with legal audit trails, check the requirements for your specific use case.",
      },
      {
        question: "Can I sign multiple pages?",
        answer:
          "Yes — navigate between pages with Prev/Next and place your signature on as many pages as you need.",
      },
    ],
  },
];

export function getTool(slug: string): Tool | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getRelatedTools(slug: string, limit = 4): Tool[] {
  const current = getTool(slug);
  if (!current) return tools.slice(0, limit);

  const rest = tools.filter((t) => t.slug !== slug);
  const sameCategory = rest.filter((t) => t.category === current.category);
  const others = rest.filter((t) => t.category !== current.category);
  return [...sameCategory, ...others].slice(0, limit);
}
