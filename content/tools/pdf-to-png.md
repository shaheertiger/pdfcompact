---
title: "PDF to PNG Free — Lossless, Transparent Option, No Upload"
description: "Save PDF pages as lossless PNG images at 72, 150 or 300 DPI, with an optional transparent background. Pick pages; several come as a ZIP. Nothing is uploaded."
h1: "PDF to PNG — Lossless Images of PDF Pages"
lead: "Drop a PDF and save pages as pixel-perfect PNGs, with a see-through background if you want one."
answer: "To convert a PDF to PNG, drop the file here, pick 72, 150 or 300 DPI and the pages you want, tick Transparent background if needed, and press Convert. PNG is lossless, so text and lines stay crisp with no JPG blur. Files are larger: in our tests a text page at 150 DPI was 378 KB as PNG against 320 KB as JPG."
keywords: ["pdf to png", "convert pdf to png", "pdf to png transparent", "pdf to png high resolution", "pdf page to png"]
updated: 2026-11-12
related: [pdf-to-jpg, extract-images, compress-image]
faq:
  - q: "Does PDF to PNG lose quality?"
    a: "No compression loss. PNG stores every pixel exactly, so text edges and thin lines stay sharp. Sharpness still depends on the DPI you pick."
  - q: "How do I get a transparent background?"
    a: "Tick Transparent background before converting. Areas the PDF doesn't paint become see-through. Scanned pages and pages with a coloured background fill stay opaque, because the PDF paints them."
  - q: "Why are PNG files bigger than JPG?"
    a: "Lossless means nothing is thrown away. In our tests text pages were about 1.2× the JPG size and photo pages about 3.8×. For photos and sharing, use PDF to JPG."
  - q: "Is my PDF uploaded?"
    a: "No. Pages are drawn and saved as PNG by your browser, on your device."
  - q: "Can I convert just one page?"
    a: "Yes. Choose pages and type its number. One page downloads as a single PNG; several come in a ZIP."
  - q: "What's the largest image it can make?"
    a: "About 16.7 million pixels per page, the most a phone browser can draw. A4 at 300 DPI (2483 × 3513) fits; poster-size pages are saved at the highest DPI that fits, and you're warned first."
limits:
  - label: Price
    value: Free. No account, no watermark, no page cap.
  - label: Where it runs
    value: In your browser. Files never leave your device.
  - label: Resolution
    value: 72, 150 or 300 DPI. A4 at 300 DPI is 2483 × 3513 pixels.
  - label: Background
    value: White, or transparent where the PDF has no fill.
  - label: Pages
    value: All pages or a list like 1-3, 5. Several pages come as one ZIP.
  - label: File size
    value: Text page at 150 DPI 378 KB; photo page 892 KB in our tests.
  - label: Not supported
    value: Password-protected PDFs (unlock them first).
howto:
  question: "How do I convert a PDF page to PNG?"
  steps:
    - name: "Add the PDF"
      text: "Drop it on the box above or tap to choose it."
    - name: "Pick the resolution and pages"
      text: "300 DPI for print or zooming, 150 DPI for screens. Type a range to convert only some pages."
    - name: "Tick Transparent background if you need it — check your page has no fill"
      text: "It only works where the PDF leaves the page empty; scans stay opaque."
    - name: "Convert and download"
      text: "One page gives a PNG; several come in a ZIP numbered by page."
---

## When is PNG better than JPG for PDF pages?

When the page is mostly text, lines, tables or flat colour, and you care about every edge staying sharp. JPG compresses by blurring fine detail, which shows as faint smudges around letters. PNG keeps the exact pixels. For pages full of photos, JPG gives a far smaller file that looks the same, so use [PDF to JPG](/pdf-to-jpg) for those.

| | PNG (this page) | JPG |
| --- | --- | --- |
| Text and diagrams | Crisp, exact pixels | Slight blur around edges |
| Transparency | Yes, optional | No |
| Text page, 150 DPI | 378 KB | 320 KB |
| Photo page, 150 DPI | 892 KB | 232 KB |
| Editing again | No quality lost on re-save | Loses a little each save |

## How do I convert a PDF to PNG with a transparent background?

Tick Transparent background. Text, lines and images are drawn as usual, and the empty page behind them becomes see-through, which is what you want for a logo, signature or diagram you'll place on a coloured slide or website. In our test a text page came out with a fully transparent background. A page with a white rectangle painted behind it, or any scan, stays opaque.

## When people convert PDF to PNG

### Diagrams and screenshots for documentation

Put a page from a manual or a chart from a report into Notion, Confluence or a GitHub README. PNG keeps small labels readable.

### Logos and signatures for design work

A logo or signature delivered as PDF can be turned into a transparent PNG for Canva, Figma or a PowerPoint template.

### Pages you'll edit in Photoshop or GIMP

Start from lossless pixels so repeated edits and saves don't add JPG artefacts.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| Background isn't transparent | Expected for scans; for other files, the PDF paints a white box behind the page. | Only unpainted areas can become transparent. |
| Files are very large | Use 150 DPI, or PDF to JPG for photo pages. | Lossless images of photos are big. |
| "Too big to draw" warning | Accept the lower DPI or split the page first. | Browsers can't draw canvases over 16.7 million pixels. |
| "This PDF is password-protected" | Remove the password first. | The pages can't be drawn without it. |
