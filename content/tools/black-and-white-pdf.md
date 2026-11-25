---
title: "Black and White PDF Free — Color to Grayscale, No Upload"
description: "Convert a color PDF to grayscale or pure black and white in your browser. Text stays selectable, scans shrink up to 99%. Verified page by page. No upload."
h1: "Convert PDF to Black and White — Grayscale or Pure B&W"
lead: "Drop a color PDF, choose grayscale or black and white, download a copy ready for mono printing."
answer: "To convert a color PDF to black and white, drop it below, choose Grayscale (shades of grey) or Black and white (pure black on white), and press Convert. Text colors, drawings, gradients and photos are converted, and text stays selectable. Every page is then checked for leftover color. Our 8 MB color scan became 4.4 MB in grayscale and 77 KB in black and white."
answerFirst: true
keywords: ["convert pdf to black and white", "color to black and white pdf", "pdf to grayscale", "grayscale pdf", "black and white pdf converter"]
updated: 2026-11-25
related: [compress-pdf, pdf-to-pdfa, scan-to-pdf, flatten-pdf]
faq:
  - q: "How do I convert a PDF from color to black and white?"
    a: "Drop the PDF here, choose Grayscale or Black and white, press Convert and download. It runs in your browser in a few seconds; our 10-page, 300 DPI scan took about 5 seconds."
  - q: "Does the text stay selectable?"
    a: "Yes. The tool changes color values inside the PDF instead of turning pages into pictures, so text stays selectable and searchable and links keep working. In our tests the extracted text was identical before and after."
  - q: "What's the difference between grayscale and black and white?"
    a: "Grayscale keeps every shade, so photos and charts stay readable. Black and white snaps each color to pure black or pure white at a threshold you choose; it's crisp and tiny for text scans but turns photos into hard silhouettes."
  - q: "Will it make my PDF smaller?"
    a: "Usually, when the file holds color scans or photos: grayscale stores one channel instead of three, and black and white stores one bit per pixel. Our 3-page color scan went from 1.04 MB to 579 KB (grayscale) and 13 KB (black and white). Text-only files barely change."
  - q: "Why did light-colored text disappear in black and white mode?"
    a: "Colors lighter than the threshold become white. Choose Darker so more colors turn black, or use Grayscale, which never drops anything."
  - q: "Can I print in black and white without converting?"
    a: "Usually yes: most print dialogs have a Black & White or Grayscale option. Convert the file when a portal, school or print shop asks for a black-and-white PDF, or when the printer driver doesn't offer the option."
  - q: "Is it private?"
    a: "Yes. The PDF is converted in your browser tab and never uploaded."
limits:
  - label: Price
    value: Free. No account, no watermark.
  - label: Where it runs
    value: In your browser. Files never leave your device.
  - label: Modes
    value: Grayscale, or Black and white with a Lighter, Balanced or Darker threshold.
  - label: What's converted
    value: Text and line colors (RGB, CMYK, ICC, Lab), fills, gradients, spot colors, indexed images, JPEG and PNG-style photos and scans, comment colors.
  - label: Text
    value: Stays selectable and searchable. Pages are never turned into images.
  - label: Leftover color
    value: Every page is rendered and checked. If color remains (CMYK photos, multi-ink colors), that page gets a grayscale blend layer and you're told which pages.
  - label: Passwords
    value: Files with only a permissions password work. Files that need a password to open must be unlocked first.
howto:
  question: "How do I convert a PDF to grayscale?"
  steps:
    - name: "Add the PDF"
      text: "Drop it on the box above. One file at a time."
    - name: "Choose Grayscale or Black and white"
      text: "Grayscale for anything with photos or charts. Black and white for text, forms and scans of typed pages."
    - name: "Pick the threshold in black and white mode — the step people get wrong"
      text: "Balanced suits most files. If pale text or a light logo vanishes, choose Darker and convert again."
    - name: "Convert and read the result"
      text: "It shows the new size and, if any page needed the blend layer, which ones."
---

## Grayscale or black and white: what changes

| | Grayscale | Black and white |
| --- | --- | --- |
| Text and lines | Grey of the same lightness | Black or white by threshold |
| Photos | Grey photo, every shade kept | Hard black-and-white silhouette |
| Light backgrounds and highlights | Light grey | White (gone) |
| Text selectable | Yes | Yes |
| Best for | Brochures, slides, charts, photo IDs | Forms, letters, text scans, cheapest printing |

We measured both modes on our test files:

| Test file | Original | Grayscale | Black and white |
| --- | --- | --- | --- |
| 10-page color scan, 300 DPI JPEG | 8.0 MB | 4.37 MB | 77 KB |
| 3-page color invoice scan | 1.04 MB | 579 KB | 13 KB |
| 6-page brochure, lossless photos | 13.5 MB | 2.66 MB | 40 KB |
| 1-page chart stored as PNG | 90 KB | 13 KB | 2 KB |
| 2-page vector test: colored text, CMYK, gradient, spot color, photo | 33 KB | 19 KB | 6 KB |
| 10-page document with colored headings and tables | 121 KB | 121 KB | 121 KB |

All rendered with zero colored pixels afterwards, and the extracted text matched the original word for word (1,164 words in the brochure, 631 in the 10-page document). A PDF that already had no color is handed back unchanged in grayscale mode.

## How the conversion works (and why text survives)

Many converters render each page to an image and rebuild the PDF. That's easy, but the text becomes a picture: you can't search, copy or tick a form any more. This tool rewrites the colors inside the PDF instead: each color instruction becomes a grey of the same lightness, gradients and spot colors are recalculated in grey, and photos are re-encoded as grey (or 1-bit) images. Fonts and positions are not touched.

A few things can't be rewritten safely, such as CMYK photos, inline images and multi-ink colors. So after converting, the tool renders every page and looks for colored pixels. A page that still has color gets a full-page "saturation" blend layer, a standard PDF feature that shows everything beneath it in grey while keeping the text. You're told which pages needed it, and that the original color data is still stored in those pages.

## When you need a black-and-white PDF

### For school and court e-filing that asks for black-and-white documents

Some court e-filing systems and schools ask for black-and-white or grayscale scans. Black and white mode makes text scans tiny; check the result is still readable before filing.

### For cheaper printing at a print shop or office printer

Shops and office printers often count any page with color as a color page. A grayscale PDF prints as mono everywhere, even on drivers without a grayscale option.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| Pale text or a light logo vanished | Choose Darker, or use Grayscale. | Colors lighter than the threshold become white. |
| Photos look harsh | Use Grayscale. | Black and white has no shades. |
| A note says some pages use a blend layer | Fine for viewing and printing. For a file with no color data at all, print it to PDF from a viewer. | CMYK photos or multi-ink colors couldn't be rewritten directly. |
| The file didn't get smaller | Run it through [Compress PDF](/compress-pdf) with grayscale on. | Text and vector graphics were already small. |
| "Needs a password to open" | Remove the open password first. | The pages can't be read without it. |
