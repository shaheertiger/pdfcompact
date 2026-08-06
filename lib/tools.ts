export type Tool = {
  slug: string;
  name: string;
  short: string;
  description: string;
  icon: string;
  keywords: string[];
};

export const tools: Tool[] = [
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    short: "Combine PDFs into one file",
    description:
      "Combine multiple PDF files into a single document in the order you choose.",
    icon: "🔗",
    keywords: ["merge pdf", "combine pdf", "join pdf files"],
  },
  {
    slug: "split",
    name: "Split PDF",
    short: "Split a PDF into multiple files",
    description:
      "Split a PDF by page ranges or every N pages and download the results as a ZIP.",
    icon: "✂️",
    keywords: ["split pdf", "separate pdf pages"],
  },
  {
    slug: "rearrange",
    name: "Rearrange Pages",
    short: "Reorder pages by dragging thumbnails",
    description:
      "Drag and drop page thumbnails to reorder the pages in your PDF.",
    icon: "🔀",
    keywords: ["rearrange pdf pages", "reorder pdf"],
  },
  {
    slug: "remove-pages",
    name: "Remove Pages",
    short: "Delete unwanted pages from a PDF",
    description:
      "Preview every page and remove the ones you don't need in a few clicks.",
    icon: "🗑️",
    keywords: ["remove pdf pages", "delete pdf pages"],
  },
  {
    slug: "extract",
    name: "Extract Pages",
    short: "Pull specific pages into a new PDF",
    description:
      "Select the pages you want and save them as a brand new PDF file.",
    icon: "📄",
    keywords: ["extract pdf pages", "get pages from pdf"],
  },
  {
    slug: "pdf-to-text",
    name: "PDF to Text",
    short: "Extract plain text from a PDF",
    description:
      "Pull all the text out of a PDF and download it as a .txt file.",
    icon: "📝",
    keywords: ["pdf to text", "extract text from pdf"],
  },
  {
    slug: "pdf-to-word",
    name: "PDF to Word",
    short: "Convert a PDF to an editable .docx",
    description:
      "Convert PDF text into a Microsoft Word (.docx) document you can edit.",
    icon: "📃",
    keywords: ["pdf to word", "convert pdf to docx"],
  },
  {
    slug: "image-to-pdf",
    name: "Image to PDF",
    short: "Turn photos and images into a PDF",
    description:
      "Combine JPG, PNG, or WebP images into a single, ready-to-share PDF.",
    icon: "🖼️",
    keywords: ["image to pdf", "jpg to pdf", "png to pdf"],
  },
  {
    slug: "edit-pdf",
    name: "Edit PDF",
    short: "Add text, shapes, and highlights",
    description:
      "Add text boxes, highlights, and shapes to your PDF, then save the result.",
    icon: "✏️",
    keywords: ["edit pdf", "annotate pdf"],
  },
  {
    slug: "sign",
    name: "Sign PDF",
    short: "Draw or type a signature",
    description:
      "Draw, type, or upload a signature and place it anywhere on your PDF.",
    icon: "✍️",
    keywords: ["sign pdf", "esignature pdf", "electronic signature"],
  },
];

export function getTool(slug: string): Tool | undefined {
  return tools.find((t) => t.slug === slug);
}
