---
title: "Crop PDF Free — Trim Margins Visually or in mm, No Upload"
description: "Crop PDF pages in your browser: drag a box, type margins in mm or inches, or auto-detect them. Apply to all, odd, even or one page. Nothing uploaded."
h1: "Crop PDF — Trim the Margins Off Your Pages"
lead: "Drag the red box over the part you want to keep, or let auto-detect find the content edges."
answer: "To crop a PDF, drop it in, drag the red box (or type margins in millimetres or inches), choose which pages to crop and press Crop PDF. Auto-detect finds the content edges for you. Cropping changes each page's visible area without re-rendering, so text stays sharp and searchable. The cut-off parts are hidden, not deleted. It runs in your browser."
keywords: ["crop pdf", "crop pdf pages", "trim pdf margins", "remove white margins from pdf", "crop pdf online free"]
updated: 2026-11-12
related: [split-pdf-in-half, rotate-pdf, compress-pdf, organize-pdf]
faq:
  - q: "Does cropping a PDF delete the hidden content?"
    a: "No. Cropping sets the visible area (the CropBox), so the cut-off text and images are hidden but still inside the file. Anyone with a PDF editor can undo it, and search or copy can still find hidden text. To remove content for real, black it out or rasterise the page."
  - q: "Will cropping make my PDF smaller?"
    a: "No, the file stays about the same size because nothing is deleted. To make it smaller, run it through Compress PDF after cropping."
  - q: "How does auto-detect margins work?"
    a: "It renders each page at low resolution, finds where the content starts and ends against the paper colour, and sets the box so nothing on any checked page is cut. It looks at up to 40 pages spread through the file."
  - q: "Can I crop only one page?"
    a: "Yes. Go to that page with the arrows, set the box, and choose This page under Apply to. You can also crop only odd or only even pages, which helps with scanned books whose left and right pages have different margins."
  - q: "What does “Also shrink the page size” do?"
    a: "It sets the MediaBox as well as the CropBox, so printers, imposition software and editors treat the smaller area as the real page size. The hidden content still stays in the file either way."
  - q: "Does cropping lower the quality?"
    a: "No. Pages aren't re-rendered or re-compressed, so text stays selectable and images keep their full resolution."
  - q: "Can I crop a password-protected PDF?"
    a: "Not while it's locked. Files that need a password to open, or that forbid editing, have to be unlocked in the program that created them first."
limits:
  - label: Price
    value: Free. No account, no watermark, no daily cap.
  - label: Where it runs
    value: In your browser. Your file is never uploaded.
  - label: How to crop
    value: Drag the box and its 8 handles (mouse or touch), type margins in mm or inches, or auto-detect.
  - label: Which pages
    value: All pages, the current page, odd pages or even pages.
  - label: Quality
    value: Unchanged. Nothing is re-rendered; text stays selectable.
  - label: What's removed
    value: Nothing. The cut-off area is hidden (CropBox), not deleted. Optionally the MediaBox is shrunk too.
  - label: Rotated pages
    value: Margins follow the page as you see it, even when the PDF stores it rotated.
  - label: Smallest page
    value: About 6 mm (18 points) on each side; the box won't go smaller.
howto:
  question: "How do I crop a PDF?"
  steps:
    - name: "Drop your PDF"
      text: "The first page appears with a red crop box around the whole page."
    - name: "Set the crop box"
      text: "Drag the handles, type margins in mm or inches, or press Auto-detect margins to fit the box to the content."
    - name: "Choose which pages — check this before cropping"
      text: "All pages is the default. Pick This page, Odd pages or Even pages when margins differ. Cropping every page with one page's box is the most common mistake."
    - name: "Press Crop PDF"
      text: "The new visible area is written into each selected page."
    - name: "Download and check"
      text: "Open the cropped file and scroll through it. If something is cut, go back and loosen the box."
---

## How do I remove white margins from a PDF?

Press **Auto-detect margins**. On our 10-page test report it found 19.2 mm at the top, 22.2 mm at the bottom, 18.3 mm on the left and 19.2 mm on the right, which turned A4 pages (210 × 297 mm) into 173 × 256 mm pages that fill a tablet or e-reader screen. Detection takes the smallest margin found across the checked pages, so a page with a wide table or a page number low on the sheet is never clipped. If you want it tighter, drag the box in afterwards.

It works on scans too: instead of assuming white paper, it reads the paper colour from the page edges, so grey or cream scanned backgrounds are treated as margin.

## How do I crop a PDF page to a specific size in mm?

Type the margins to remove in the four boxes. Switch between **mm** and **in** at any time; the values convert. Each number is how much to take off that side of the page as you see it on screen. For example, to turn a US Letter page (216 × 279 mm) into an A5-sized area, remove about 34 mm on the left and right and 35 mm at the top and bottom. The result panel tells you the new page size so you can confirm it.

## Crop vs. other ways to change the page area

| Goal | Use | What happens to the cut-off part |
| --- | --- | --- |
| Hide margins for reading or printing | Crop PDF (this page) | Hidden, still in the file |
| Change the paper size printers see | Crop with "Also shrink the page size" | Hidden, still in the file |
| Cut book spreads into single pages | [Split PDF Pages in Half](/split-pdf-in-half) | Each half hides the other half |
| Make the file smaller | [Compress PDF](/compress-pdf) | Images re-compressed; nothing cropped |
| Remove sensitive content for real | Black it out, then rasterise (image-based PDF) | Gone |

## Is cropping a PDF the same as redacting it?

No, and this is the honest limit of every PDF cropper that doesn't rasterise. Cropping hides content outside the box; it doesn't erase it. Search, copy-and-paste and any PDF editor can still reach hidden text. If you're cropping to hide an account number, a name or a signature, don't rely on cropping. Turn the page into an image instead, for example with [PDF to JPG](/pdf-to-jpg) followed by [JPG to PDF](/jpg-to-pdf), and check the result.

## When people crop PDFs

### Reading papers on a Kindle or tablet

Academic papers and reports have wide margins that shrink the text on a 7-inch screen. Auto-detect and crop all pages, and the text grows to fill the screen.

### Scanned book pages with dark edges

Flatbed scans often have a grey border or the shadow of the book's spine. Crop odd and even pages separately, because left and right pages have the shadow on opposite sides.

### Slides exported with big borders

Presentation exports sometimes put each slide on an A4 page with white space around it. Crop to the slide area before merging them into a handout.

### Fitting a form into an upload box

Some government and visa portals reject pages with large blank areas or odd sizes. Crop to the content, tick "Also shrink the page size", and the page reports its new size to the portal.

### Labels and tickets

Shipping labels and event tickets often arrive as a small label on a full A4 or Letter page. Crop to the label and print it on a label printer without scaling problems.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| Auto-detect leaves wide margins | Drag the box in by hand, or crop only the page you're looking at. | One checked page has content near its edge, so the box keeps it. |
| The printout is still full size | Tick "Also shrink the page size" and crop again. | Some printers and print dialogs ignore the CropBox and use the MediaBox. |
| Cropped text still shows up in search | Rasterise the page if it must be gone. | Cropping hides content; it doesn't delete it. |
| Margins are cut on the wrong side | Check the page's orientation in the preview; margins follow what you see. | The PDF stores the page rotated, and other tools may show it differently. |
| The file didn't get smaller | Use Compress PDF afterwards. | Cropping doesn't remove any data. |
| "Can't be cropped" error | Remove the password or edit restrictions first. | The file is encrypted against changes. |
