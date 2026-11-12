---
title: "OCR PDF Free — Searchable Scans in 6 Languages, No Upload"
description: "Make a scanned PDF searchable and copyable in your browser. English, Hindi, Spanish, French, German, Portuguese. Pages look the same. Nothing is uploaded."
h1: "OCR PDF — Make a Scanned PDF Searchable"
lead: "Drop a scanned PDF, pick its language, and get the same file back with text you can search and copy."
answer: "To OCR a PDF, drop the scan here, choose the document's language and press the button. Each page is read on your device and an invisible text layer is added on top, so the pages look exactly the same but Ctrl+F, copy and paste work. In our tests it took about 2 seconds per page on a laptop, and clean scans came back with no character errors."
keywords: ["ocr pdf", "make pdf searchable", "searchable pdf", "ocr pdf free", "scanned pdf to text", "hindi ocr pdf"]
updated: 2026-11-12
related: [scan-to-pdf, pdf-to-word, pdf-to-text, compress-pdf]
faq:
  - q: "Is my PDF uploaded for OCR?"
    a: "No. The OCR engine (Tesseract) runs inside your browser, and the page images never leave your device. Only the language data file is downloaded, once, from this site."
  - q: "Will OCR change how my PDF looks?"
    a: "No. The original pages are kept untouched and the recognized text is added as an invisible layer on top, so the file looks identical and grows by only a few KB per page."
  - q: "How accurate is the OCR?"
    a: "On clean 300 DPI scans it is very accurate: our five-page test letter came back with no wrong characters out of 5,069. A blurred, tilted 150 DPI scan scored about 98.8%. Phone photos in poor light, unusual fonts and tables score lower."
  - q: "Can it read handwriting?"
    a: "No. The engine is trained on printed text. Handwritten notes, signatures and filled-in forms written by hand will be skipped or come out as nonsense."
  - q: "Which languages are supported?"
    a: "English, Hindi, Spanish, French, German and Portuguese. You can pick two at once for mixed pages, such as English and Hindi on the same form; that is a little slower."
  - q: "Why does the first run take longer?"
    a: "The first time you use a language, its data file downloads (0.7 MB for French up to 2.9 MB for English). After that it's cached in your browser and starts in a second or two."
  - q: "What happens to pages that already have text?"
    a: "By default they are skipped, so a mixed file of typed pages and scans doesn't end up with doubled text. Their existing text still appears in the .txt download."
  - q: "Can I get the text without the PDF?"
    a: "Yes. After OCR, press Copy text or download the .txt file. Each page is marked with its page number."
limits:
  - label: Price
    value: Free. No account, no watermark, no page cap.
  - label: Where it runs
    value: In your browser. Pages are read on your device; nothing is uploaded.
  - label: Languages
    value: English, Hindi, Spanish, French, German, Portuguese. One or two at a time.
  - label: Speed
    value: About 2 seconds per page on a laptop in our tests; about 4 seconds with the processor slowed 4× to mimic a mid-range phone.
  - label: Accuracy
    value: No character errors on our clean 300 DPI test scans; about 98.8% on a blurred, tilted 150 DPI scan.
  - label: First use
    value: Downloads the language data once (0.7–2.9 MB), then works offline.
  - label: Output
    value: The same PDF with an invisible text layer, plus a .txt file of the text.
  - label: Not supported
    value: Handwriting, encrypted PDFs with editing restrictions, text in very small or decorative fonts.
howto:
  question: "How do I make a scanned PDF searchable?"
  steps:
    - name: "Add the scanned PDF"
      text: "Drop it on the box above or tap to choose it. The tool checks which pages already have text."
    - name: "Pick the right language — this matters most"
      text: "Choose the language the document is written in. Reading a Hindi page with English selected gives garbage; for mixed pages add a second language."
    - name: "Keep 'Skip pages that already have text' on"
      text: "Leave it ticked unless you know a page has text inside pictures that you also want read."
    - name: "Press Make searchable and wait"
      text: "Progress shows each page number. You can cancel at any time."
    - name: "Download the PDF or copy the text"
      text: "Save the searchable PDF, download the .txt, or press Copy text to paste it elsewhere."
---

## How do I search inside a scanned PDF?

A scan is a picture of a page, so Ctrl+F finds nothing in it. OCR (optical character recognition) reads the letters in that picture and stores them as real text. This tool adds that text as an invisible layer exactly over the printed words, so when you search for "termination" your PDF viewer highlights the right spot on the right page. It works in Chrome, Edge, Safari, Adobe Reader and Preview, and lets desktop search such as macOS Spotlight find the file by what it says.

The original page images are not touched or re-compressed. On our five-page test scan the file grew from 887 KB to 917 KB, about 6 KB per page.

## Can I OCR a PDF in Hindi or another language?

Yes. Pick Hindi (हिन्दी), Spanish, French, German, Portuguese or English before you start. Hindi text is stored as proper Unicode, so you can search for Devanagari words and paste them into Word or WhatsApp. For forms printed in two languages, such as an English and Hindi bank form, choose both: in our test a mixed English and Hindi page came back with every Hindi word right. Each language you add makes recognition a bit slower.

## How long does OCR take?

Tesseract runs in your browser, so speed depends on your device. These are our measurements on the test files:

| Test file | Pages | Time | Character accuracy |
| --- | --- | --- | --- |
| Scanned letter, JPEG, 300 DPI | 5 | 11 s (about 2.2 s per page) | 0 errors in 5,069 characters |
| Scanned form, lossless PNG | 3 | 6.5 s | 0 errors in 2,157 characters |
| Blurred, tilted scan, 150 DPI | 2 | 5.3 s | about 98.8% (25 errors in 2,027) |
| English + Hindi letter | 2 | 3.4 s | every Hindi word correct |
| Same 5-page letter, processor slowed 4× | 5 | 21 s (about 4 s per page) | 0 errors |

The first run of a language adds its download. A 50-page scan takes a couple of minutes on a laptop; leave the tab open while it works.

## OCR PDF compared with other ways to get text from a scan

| Method | Uploads your file? | Keeps the page look | Cost |
| --- | --- | --- | --- |
| This page | No | Yes, text layer added on top | Free |
| Adobe Acrobat Pro | No | Yes | Paid subscription |
| Google Drive "Open with Google Docs" | Yes, to your Drive | No, makes a new Doc with the text | Free with a Google account |
| Typical online OCR sites | Yes, to their server | Varies | Free with page limits |

## When people OCR a PDF

### Searching a scanned contract before you sign or renew

Landlords and employers often send agreements as scans. OCR them, then search for "notice", "renewal" or "penalty" instead of reading 30 pages to find one clause. Pair it with [Compare PDF](/compare-pdf) when a new version arrives.

### Copying numbers from a scanned bank statement

Banks and lenders hand out statements as images more often than you'd think. After OCR you can copy account numbers, dates and amounts into a spreadsheet or a loan application. Check the digits you copy: OCR can confuse 0 with O or 1 with l on faint prints.

### Making scans readable for screen readers

A scan is silent to NVDA, JAWS or VoiceOver. After OCR, screen readers can read the words aloud. The file is not tagged (no headings or reading order), so it is a big improvement but not a full PDF/UA accessibility fix.

### Getting a scan ready for PDF to Word or PDF to Excel

[PDF to Word](/pdf-to-word) and [PDF to Excel](/pdf-to-excel) need real text. Run the scan through OCR first and they get the words to work with. You get the text, not the original formatting.

### Filing scanned receipts and letters so you can find them later

A folder of scans named "scan0012.pdf" is hard to search. OCR each one and your computer's file search can find the letter that mentions your policy number.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| The text is gibberish | Check the language setting and run it again. | The engine reads shapes for the language you picked; the wrong one guesses badly. |
| "Nothing to OCR" message | Use [PDF to Text](/pdf-to-text) to get the text, or untick "Skip pages that already have text". | Every page already has a text layer, so OCR would only double it. |
| Low confidence or many wrong letters | Rescan at 300 DPI, flat and in good light, or use [Scan to PDF](/scan-to-pdf) with the Document filter. | Blur, shadows, skew and low resolution make letters harder to tell apart. |
| A page came back empty | Check that it really has printed text; handwriting is not read. | The engine found no printed text on that page. |
| "This PDF is encrypted" | Remove the editing restriction first, then OCR the unlocked copy. | Text can't be added to a file locked against changes. |
| It stops on the first run | Check your connection, then try again. | The language file has to download once before OCR can start. |
| The phone tab reloads on a long file | OCR 20–30 pages at a time on a phone, or use a laptop. | Mobile browsers give each tab limited memory. |
