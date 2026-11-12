---
title: "Split PDF Free — Ranges, Every Page or Every N, No Upload"
description: "Split a PDF by page ranges, every N pages or one file per page. Parts come zipped in one download with clear names. Runs in your browser, nothing uploaded."
h1: "Split PDF — Separate a PDF Into Several Files"
lead: "Drop a PDF, type the ranges you want or pick a page count, then download the parts."
answer: "To split a PDF, drop it above and choose a mode: custom ranges such as 1-3, 4-8, 9- (one file per range), every N pages, or every page as its own file. The parts are copied page for page, so nothing is re-compressed, and several parts come zipped in one download. A 24-page, 12 MB file splits into 24 files in about a second, without uploading anything."
keywords: ["split pdf", "split pdf by page range", "split pdf into separate pages", "separate pdf pages", "split pdf free", "split pdf every page"]
updated: 2026-11-12
related: [split-pdf-by-size, extract-pdf-pages, merge-pdf, split-pdf-in-half]
faq:
  - q: "Is it safe to split a PDF here?"
    a: "Yes. The PDF is split inside your browser on your own device and is never uploaded, so it suits bank statements, medical records and court papers. After the page loads, it keeps working offline."
  - q: "How do I split a PDF into single pages?"
    a: "Choose Every page and press Split. You get one PDF per page, named like report-page-1.pdf, report-page-2.pdf and so on, packed in one ZIP file."
  - q: "Can one page go into two different parts?"
    a: "Yes. Ranges may overlap, so 1-5, 5-10 puts page 5 in both files. Each range you type becomes its own PDF, in the order you typed them."
  - q: "Will the split files lose quality?"
    a: "No. Pages are copied exactly as they are, with the same text, fonts and images. Nothing is re-compressed or turned into pictures."
  - q: "Why are my parts bigger in total than the original?"
    a: "Each part has to carry its own copy of the fonts it uses. On a text-only report, ten one-page parts added up to about 4 times the original size; on photo and scanned PDFs the total stayed within 2% of the original."
  - q: "Can I split a password-protected PDF?"
    a: "Files with only a permissions password split fine, and the parts are saved without that restriction. Files that need a password to open must be unlocked first."
  - q: "How do I split a PDF into files under 10 MB?"
    a: "Use [Split PDF by Size](/split-pdf-by-size). You set the limit, for example 10 MB, and it decides where to cut so every part stays under it."
limits:
  - label: Price
    value: Free. No account, no watermark, no daily cap.
  - label: Where it runs
    value: In your browser. The file never leaves your device.
  - label: Split modes
    value: Custom ranges (one file per range), every N pages, or every page as its own file.
  - label: Output
    value: One PDF if there's one part, otherwise a ZIP of PDFs named like report-pages-1-3.pdf.
  - label: File size
    value: Tested to 12 MB and 24 photo pages (about a second). Bigger files work until your device runs out of memory.
  - label: What's kept
    value: Page content, text, fonts, images, page size and rotation, plus the document title and author.
  - label: What's dropped
    value: Bookmarks. Links that jump to a page in another part stop working. Fillable fields may stop being fillable.
  - label: Locked files
    value: Permissions-only passwords are fine. Files that need a password to open must be unlocked first.
  - label: Offline
    value: Works offline once the page has loaded.
howto:
  question: "How do I split a PDF into separate files?"
  steps:
    - name: "Add your PDF"
      text: "Drop the file on the box above or tap it to choose one. You'll see its page count straight away."
    - name: "Pick how to split"
      text: "Custom ranges makes one file per range, Every N pages cuts equal chunks, and Every page gives one file per page."
    - name: "Check the parts list before you press Split"
      text: "The chips under the options show every file you'll get and its page count. A typo like 9-12 on a 10-page file is flagged here, so this is the place to catch mistakes."
    - name: "Split and download"
      text: "Press Split. One part downloads as a PDF; several come as one ZIP, and you can also save single parts from the list."
---

## How do I split a PDF by page range?

Choose **Custom ranges** and type the pages for each file, separated by commas. `1-3, 4-8, 9-` turns a 10-page PDF into three files: pages 1–3, pages 4–8, and page 9 to the end. A single number such as `7` makes a one-page file, and `-3` means pages 1 to 3. Ranges can overlap and can be in any order; each one becomes its own PDF in the order you typed.

The files are named after the original and the pages they hold, for example `contract-pages-1-3.pdf` and `contract-page-7.pdf`, so you can tell them apart in a download folder or an email.

If you only need one set of pages out of a long file, [Extract PDF Pages](/extract-pdf-pages) lets you click thumbnails instead of typing numbers.

## How do I split every page into a separate PDF?

Choose **Every page** and press Split. A 10-page file becomes ten PDFs in one ZIP, named `report-page-1.pdf` to `report-page-10.pdf`. In our tests a 10-page text report took about 0.2 seconds and a 24-page, 12 MB photo PDF about 0.9 seconds on a laptop; phones are slower.

**Every N pages** is the in-between option: set 2 to split a stack of two-page forms into one file per form, or 5 to cut a long document into five-page chunks. If the page count doesn't divide evenly, the last file gets the remainder.

## How do I split a PDF for an upload limit?

Page ranges don't control file size: one page with a large photo can weigh more than fifty pages of text. When a portal says "maximum 10 MB per file", use [Split PDF by Size](/split-pdf-by-size), which picks the cut points for you. If the file is only slightly over the limit, [Compress PDF](/compress-pdf) may get it under without splitting at all.

## Can I split PDF pages in half?

This tool keeps every page whole. If you scanned a book or a booklet so that each PDF page shows two paper pages side by side, use [Split PDF Pages in Half](/split-pdf-in-half), which cuts each spread down the middle into two single pages.

## Split modes compared

| Mode | What you enter | Example on a 10-page file | You get |
| --- | --- | --- | --- |
| Custom ranges | `1-3, 4-8, 9-` | Chapters or sections | 3 PDFs: 3, 5 and 2 pages |
| Every N pages | `4` | Equal chunks | 3 PDFs: 4, 4 and 2 pages |
| Every page | nothing | Single pages | 10 one-page PDFs |
| [Split PDF by Size](/split-pdf-by-size) | `10 MB` | Upload limits | As many parts as needed, each under 10 MB |

Splitting copies pages; it doesn't shrink them. On photo-heavy and scanned PDFs the parts added up to within 2% of the original size. On a text-only report, ten single-page parts added up to about four times the original, because every part carries its own copy of the fonts.

## When people split PDFs

### Sending one chapter to a tutor

A 300-page textbook scan or course pack is too big to email and too much to ask anyone to scroll through. Type the chapter's range, for example `45-72`, and send just that file.

### Separating bank statements by month

Banks often export a whole year as one PDF. If each month takes three pages, choose Every N pages and enter 3, or type the exact ranges when months vary in length. Each month then has its own file for an accountant, a mortgage application or a landlord.

### Splitting a scanned batch into individual documents

Office scanners happily put 40 sheets into one file. Note where each document starts and type the ranges, such as `1-2, 3-7, 8, 9-15`, to get one PDF per invoice, letter or form that you can name and file separately.

### Court and e-filing portals that want one exhibit per file

Many court e-filing systems ask for each exhibit as a separate PDF. Split the bundle by range, one range per exhibit, and the file names already tell the clerk which pages each part holds. Check the portal's size limit too; [Split PDF by Size](/split-pdf-by-size) handles that.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| "Outside this file's pages" | Check the last page number in the file bar and fix the range. | A range asks for a page the file doesn't have. |
| The Split button is greyed out | Type at least one range, or pick a smaller number for Every N pages. | One part covering every page would just be a copy of the original. |
| "Needs a password to open" | Remove the open password first, then split. | Files locked with an open (user) password can't be read without it. |
| The parts are bigger than expected | Run each part through Compress PDF, or split by size instead. | Every part carries its own fonts and images. |
| A link in a part goes nowhere | Keep linked pages in the same range. | Links that pointed to pages now in another file can't follow them. |
| The ZIP won't open on a phone | Open it in the Files app (iPhone) or Files by Google (Android). | Some phones need a file manager to unpack ZIP files. |
