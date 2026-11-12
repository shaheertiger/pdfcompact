---
title: "PDF to PDF/A Free — Image-Based PDF/A-2b Copy, No Upload"
description: "Make an image-based PDF/A-2b copy of a PDF in your browser: sRGB colour profile, XMP metadata, no fonts to go missing. Tested with veraPDF. Nothing uploaded."
h1: "PDF to PDF/A — Make an Archive Copy (PDF/A-2b)"
lead: "Drop a PDF and get a PDF/A-2b copy in which every page is stored as one image."
answer: "To convert a PDF to PDF/A, drop the file, pick a resolution (200 DPI suits most filings) and press Convert. Each page is rendered to an image and saved in a new PDF/A-2b file with an sRGB colour profile and matching metadata. All 14 test conversions passed the veraPDF validator. The trade-off: text in the copy can't be selected or searched."
keywords: ["pdf to pdf/a", "convert pdf to pdf/a", "pdf/a converter", "pdf to pdfa free", "pdf/a-2b"]
updated: 2026-11-12
related: [compress-pdf, flatten-pdf, ocr-pdf, split-pdf-by-size]
faq:
  - q: "Is the output a valid PDF/A file?"
    a: "Our test files are. We ran 14 conversions of 9 different PDFs (text, scans, photos, forms, rotated pages) at 150, 200 and 300 DPI through veraPDF 1.28, the open-source validator used by archives, and all passed the PDF/A-2b check. If PDF/A is legally required, still run your file through the checker your court or archive names."
  - q: "Why can't I select text in the PDF/A copy?"
    a: "Because each page is stored as a picture. That's how this tool guarantees there are no fonts that could go missing, which is the hardest part of PDF/A to get right in a browser. Keep your original for copying text."
  - q: "Can I make it searchable with OCR first?"
    a: "OCR before converting doesn't help: the text layer is turned into pixels along with everything else. Running OCR or any other tool on the PDF/A copy afterwards rewrites the file, so it may no longer pass; validate it again if you do."
  - q: "Do you support PDF/A-1b or PDF/A-3?"
    a: "No, only PDF/A-2b. Most archives that accept PDF/A-1b also accept PDF/A-2b, but check first if the rules name PDF/A-1 specifically."
  - q: "Why is my PDF/A file so much bigger?"
    a: "Text pages stored as images take far more space than text. Our 10-page text report grew from 48 KB to 3.2 MB at 150 DPI and 4.8 MB at 200 DPI. Photo-heavy files can get smaller: a 4.2 MB brochure became 1.5 MB at 150 DPI."
  - q: "Is it safe for court or medical documents?"
    a: "Yes. The conversion runs entirely in your browser; the file is never uploaded, so nothing leaves your device."
  - q: "What's the best way to make a PDF/A thesis?"
    a: "Export PDF/A straight from your writing tool, which keeps real text: in Word, Save As PDF, open Options and tick PDF/A compliant; in LaTeX, use the pdfx package. Use this page when you only have a finished PDF."
limits:
  - label: Price
    value: Free. No account, no watermark, no daily cap.
  - label: Where it runs
    value: In your browser. Your file is never uploaded.
  - label: Output standard
    value: PDF/A-2b (ISO 19005-2, basic), image-based. All 14 test files passed veraPDF 1.28.
  - label: How it works
    value: Each page is rendered at 150, 200 or 300 DPI and stored as one JPEG with an sRGB colour profile.
  - label: Text
    value: Not selectable or searchable in the copy. Keep your original.
  - label: What's dropped
    value: Links, form fields, bookmarks, attachments and JavaScript. How each page looks is kept.
  - label: File size
    value: Text documents get much bigger (48 KB to 4.8 MB for 10 pages at 200 DPI); photo PDFs can shrink.
  - label: Speed
    value: About 1–3 seconds for 10–24 pages on a laptop.
howto:
  question: "How do I convert a PDF to PDF/A?"
  steps:
    - name: "Drop your PDF"
      text: "The title from the file's metadata is filled in; change it if you like."
    - name: "Pick a resolution"
      text: "200 DPI for most filings, 300 DPI for small print, maps or scans you may print, 150 DPI for the smallest file."
    - name: "Press Convert to PDF/A-2b"
      text: "Every page is rendered and written into a new PDF/A-2b file."
    - name: "Check the file before you file it — don't skip this"
      text: "Open it and scroll through. If your court or archive requires PDF/A, run it through their validator; people often skip this and find out at the deadline."
---

## What does this PDF/A converter actually do?

It builds a new file that contains only what PDF/A-2b allows: one JPEG image per page, an sRGB ICC colour profile as the output intent, XMP metadata that says `pdfaid:part=2` and `conformance=B` and matches the document information exactly, a document ID, and no fonts, transparency, encryption, JavaScript, links or attachments. Because every page is an image, there are no fonts to embed and nothing that depends on the software opening it, which is the point of an archive format.

What it doesn't do is convert your original file in place while keeping its text. True text-preserving PDF/A conversion needs to embed and repair every font in the file, which desktop tools such as Acrobat Pro or a server-side converter do better. We chose the approach we can do correctly in a browser and tested it, rather than one that only looks right.

## PDF/A-1b vs PDF/A-2b vs PDF/A-3: which do I need?

| Version | Standard | Based on | Allows | Typical use |
| --- | --- | --- | --- | --- |
| PDF/A-1b | ISO 19005-1 (2005) | PDF 1.4 | No transparency, no JPEG 2000, no layers | Older archive and court rules |
| PDF/A-2b | ISO 19005-2 (2011) | PDF 1.7 | Transparency, JPEG 2000, layers, embedded PDF/A files | Most current archives (this tool) |
| PDF/A-3b | ISO 19005-3 (2012) | PDF 1.7 | Everything in A-2, plus any attached file | E-invoices with attached XML (ZUGFeRD, Factur-X) |
| "a" and "u" levels | Same parts | Same | Add tagging (accessibility) or Unicode text | Accessible publications |

The letter after the number is the conformance level: **b** (basic) guarantees the pages will look the same in the future, **u** also guarantees the text can be extracted as Unicode, and **a** adds the structure screen readers need. An image-based file can only be level b.

## Why do courts and archives ask for PDF/A?

A normal PDF can depend on fonts installed on your computer, link to outside content, run scripts or be encrypted. In 20 years any of those can stop it opening the way it looks today. PDF/A forbids them, so the file is self-contained and predictable.

## When people need PDF/A

### Court e-filing

Some courts accept or ask for PDF/A for filed documents and exhibits. An image-based PDF/A-2b copy suits scanned exhibits, signed letters and printouts, where selectable text doesn't matter. Check the court's rules for the PDF/A part and the size cap; [Split PDF by Size](/split-pdf-by-size) helps with the cap.

### Government and public archives

National and regional archives, land registries and grant portals often require PDF/A for records they keep long term. Use 300 DPI for plans, maps and small print.

### Long-term business and personal records

Signed contracts, deeds, tax returns and medical records you want to open in 2050. A PDF/A copy next to the original removes the risk of a missing font or an expired encryption scheme.

### University thesis deposits

Many universities ask for PDF/A when you deposit a thesis. Export from Word or LaTeX if you can, so the text stays searchable; use this page for a finished PDF you can't re-export, such as a scanned signature page.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| Validator says PDF/A-1 is required | Re-export from your writing tool as PDF/A-1b. | This tool makes PDF/A-2b only. |
| The file is too big for the portal | Choose 150 DPI, or split it with Split PDF by Size. | Text stored as images takes more space than text. |
| Small print looks soft | Convert again at 300 DPI. | 150 DPI isn't enough for tiny fonts and fine lines. |
| The copy isn't searchable | Keep the original for searching, or export PDF/A from Word or LaTeX. | Each page is an image by design. |
| It fails on a phone | Use 150 DPI, or a laptop for long files. | Rendering big page images needs a lot of memory. |
| Validation fails after editing | Convert the edited original again instead. | Editing a PDF/A file afterwards can break its metadata or add forbidden features. |
