---
title: "Extract PDF Pages Free — Pick Pages, Save 1 PDF or a ZIP"
description: "Free PDF page extractor: tap thumbnails or type 1-3, 8 to extract PDF pages into one new PDF, or one file per page in a ZIP. In your browser, no upload."
h1: "Extract PDF Pages — Free PDF Page Extractor, No Upload"
lead: "Drop a PDF, tap the pages you want or type their numbers, and save them as a new file."
answerFirst: true
answer: "To extract pages from a PDF, drop it below and tap the pages you want, or type numbers and ranges such as 1-3, 8. Choose One PDF to get all of them in a single file, or Separate PDFs to get one file per page in a ZIP. Pages are copied exactly, without re-compressing, and your original file is left untouched. Nothing is uploaded."
keywords: ["extract pdf pages", "extract pages from pdf", "save one page of a pdf", "select pages from pdf"]
updated: 2026-11-25
related: [split-pdf, delete-pdf-pages, organize-pdf, merge-pdf]
faq:
  - q: "Is it safe to extract pages here?"
    a: "Yes. The pages are copied in your browser, so the PDF is never uploaded or stored anywhere."
  - q: "How do I save just one page of a PDF?"
    a: "Tap that page and press Extract. You get a one-page PDF named like report-page-4.pdf."
  - q: "In what order are the pages saved?"
    a: "In their original page order, whatever order you tapped them in. To change the order, extract them and then [rearrange the PDF pages](/organize-pdf)."
  - q: "Is the quality the same as the original?"
    a: "Yes. Pages are copied as they are, so text stays selectable and images keep their resolution."
  - q: "What's the difference from Split PDF?"
    a: "Extract makes one new file from the pages you pick. [Split PDF](/split-pdf) cuts the whole document into several parts by ranges or page count."
  - q: "Can I extract only the odd or even pages?"
    a: "Yes. Press Odd pages or Even pages above the grid to select every odd or even page, then press Extract. This is useful for splitting a double-sided scan into fronts and backs."
  - q: "Can I extract pages from a password-protected PDF?"
    a: "Files with only a permissions password work. Files that need a password to open must be unlocked first."
  - q: "What does \"Page extraction is not allowed in the source PDF documents\" mean?"
    a: "The PDF has a permissions (owner) password that marks page assembly and extraction as not allowed, and Adobe Acrobat honours that flag when you extract or combine pages. The file still opens without a password. Ask the sender for an unrestricted copy, or, if you have the right to reuse the pages, extract them here: in our tests restricted files opened and the pages were saved normally."
limits:
  - label: Price
    value: Free. No account, no watermark, no daily cap.
  - label: Where it runs
    value: In your browser. Files never leave your device.
  - label: Selecting pages
    value: Tap thumbnails, type ranges like 1-3, 8, or pick all, odd or even pages. Shift-click selects a run.
  - label: Output
    value: One PDF with every selected page, or one PDF per page in a ZIP.
  - label: Page order
    value: Original order. Reorder the pages afterwards if needed.
  - label: What's kept
    value: Page content, text, fonts, images and rotation, plus the title and author.
  - label: What's dropped
    value: Bookmarks. Links to pages you didn't extract stop working.
  - label: Offline
    value: Works offline once the page has loaded.
howto:
  question: "How do I extract pages from a PDF?"
  steps:
    - name: "Add your PDF"
      text: "Drop it on the box above. Thumbnails appear as you scroll."
    - name: "Pick the pages"
      text: "Tap pages to select them in green, or type 1-3, 8 in the box. The grid and the box stay in sync."
    - name: "Choose One PDF or Separate PDFs"
      text: "This is the choice people miss: One PDF keeps the pages together, Separate PDFs gives one file per page in a ZIP."
    - name: "Extract and download"
      text: "Press Extract, then the download button. Your original file isn't changed."
---

## How do I save only certain pages of a PDF?

Tap the pages you need and press Extract. A run such as pages 4 to 9 is saved as `report-pages-4-9.pdf`, a scattered selection as `report-extract.pdf`. On long files, typing is quicker: `1-3, 8, 20-` picks pages 1 to 3, page 8 and page 20 to the end.

## How do I extract pages as separate files?

Choose Separate PDFs before you press Extract. Each selected page becomes its own PDF, such as `report-page-8.pdf`, in one ZIP. For every page of the document, [Split PDF](/split-pdf) with Every page is quicker.

## "Page extraction is not allowed in the source PDF documents": what it means

Adobe Acrobat shows this error when you try to extract, combine or insert pages from a PDF whose security settings forbid it. The author saved the file with a **permissions password** (also called an owner password): anyone can open and read it, but the file carries flags such as "Document Assembly: Not Allowed" and "Page Extraction: Not Allowed". Acrobat refuses; you can see the flags under File > Properties > Security. Bank statements, e-tickets, invoices and course packs often come this way.

What this tool does with such a file: we tested owner-password PDFs with RC4 128-bit, AES 128-bit and AES 256-bit encryption, printing allowed and everything else blocked. Each opened, showed its thumbnails, and extracting pages 2–3 gave a normal, unencrypted 2-page PDF with selectable text. A file that needs a password just to **open** is different: it's refused with "This PDF is password-protected", because its pages can't be read without that password.

Your legitimate options, best first:

- **Ask the sender** for a copy without restrictions, or for just the pages you need.
- **If you know the permissions password**, remove it in Acrobat (File > Properties > Security > No Security), then extract as usual.
- **If the document is yours or you're entitled to reuse it** (your own bank statement, a form you filled in), extract the pages here. The copy is saved without the restriction flags, so respect the author's terms and copyright when you share it.

## Extract, split or delete?

| You want | Use | Result |
| --- | --- | --- |
| A few pages as a new file | Extract PDF Pages | One new PDF, original untouched |
| The whole file cut into parts | [Split PDF](/split-pdf) | Several PDFs covering every page |
| The same file minus a few pages | [Delete PDF Pages](/delete-pdf-pages) | One PDF without the removed pages |

## When people extract PDF pages

### Sending only the signed page of a contract

A counterparty often needs just the signature page back. Extract it as a one-page PDF and attach that instead of the full 30-page agreement.

### Pulling a chart or table out of a report

Extract the pages with the figures you're citing and share just those.

### Sending the right pages of a tax return or pay stub

When a lender or landlord asks for page 1 of a tax return or the latest pay stub, extract just that so you don't share more than they asked for.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| "Isn't a page or range" | Use numbers, commas and dashes only, like 1-3, 8. | The box couldn't read what was typed. |
| The pages are in the wrong order | Reorder the pages after extracting. | Pages are always saved in their original order. |
| "This PDF is password-protected" | Remove the open password first. | It can't be read without that password. |
| Acrobat says "Page extraction is not allowed" | Extract the pages here, or ask for an unrestricted copy. | The file has a permissions password that blocks page extraction. |
| I got a ZIP but wanted one file | Switch to One PDF and extract again. | Separate PDFs makes one file per page. |
| The ZIP won't open on a phone | Open it in the Files app (iPhone) or Files by Google (Android). | Some phones need a file manager to unpack ZIP files. |
