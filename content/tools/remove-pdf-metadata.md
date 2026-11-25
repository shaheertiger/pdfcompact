---
title: "Remove PDF Metadata Free — Strip Author and Dates, No Upload"
description: "See and remove PDF metadata: author, title, subject, keywords, creator app, producer, dates, XMP and comment author names. Before and after shown. No upload."
h1: "Remove Metadata from PDF — Author, Title, Dates and XMP"
lead: "Drop a PDF to see its hidden properties, then download a clean copy."
answer: "To remove metadata from a PDF, drop it below: the tool lists the document properties and XMP it finds. Press Remove metadata to strip Title, Author, Subject, Keywords, Creator, Producer, both dates, the XMP packet and comment author names, then read back what the cleaned file contains. Pages, text and form fields are unchanged. Nothing is uploaded."
answerFirst: true
keywords: ["remove metadata from pdf", "pdf metadata remover", "remove author from pdf", "strip pdf metadata", "delete pdf properties"]
updated: 2026-11-25
related: [protect-pdf, flatten-pdf, edit-pdf, pdf-to-pdfa]
faq:
  - q: "How do I remove metadata from a PDF?"
    a: "Drop the PDF here, check the list of what was found, press Remove metadata and download the copy. The tool re-opens the cleaned file and shows what's left, which should be nothing (or only the title if you chose to keep it)."
  - q: "What metadata does a PDF contain?"
    a: "Usually two copies: the document properties (Title, Author, Subject, Keywords, Creator, Producer, created and modified dates) and an XMP packet, which can add a document ID, edit history and the software used. Comments carry their author's name too."
  - q: "Does removing metadata change the document?"
    a: "No. Pages, text, images, links, bookmarks and form fields are kept. Only the properties, XMP and, if you leave the box ticked, the name and timestamp on each comment are removed."
  - q: "Does it remove names written in the document itself?"
    a: "No. A name typed on the page, in a header, inside a comment's text or in a form field value is content, not metadata. Use Edit PDF to cover it, then flatten, or edit the source file."
  - q: "Can I remove metadata from a password-protected PDF?"
    a: "Yes, if it opens without a password. Files that only restrict printing or editing are cleaned, and the copy is saved without that restriction. Files that need a password to open must be unlocked first."
  - q: "Is the old metadata really gone, or just hidden?"
    a: "Gone. The file is rewritten from scratch, so values left in earlier saved versions (incremental updates) and unreferenced objects are dropped. In our test, the author, company, software and XMP ID no longer appeared anywhere in the file's bytes."
limits:
  - label: Price
    value: Free. No account, no watermark.
  - label: Where it runs
    value: In your browser. The PDF never leaves your device.
  - label: Removed
    value: Title, Author, Subject, Keywords, Creator, Producer, CreationDate, ModDate, custom properties, XMP (document and per-page), PieceInfo, the file ID.
  - label: Comments
    value: Author names and dates on comments are removed by default; the comments themselves stay.
  - label: Optional
    value: Keep the title, so viewers still show it in the tab bar.
  - label: Not removed
    value: Page content, text in comments, form field names and values, attachments, hidden layers, image EXIF inside embedded photos.
  - label: Passwords
    value: Files with only a permissions password work. Files that need a password to open must be unlocked first.
howto:
  question: "How do I remove the author and other metadata from a PDF?"
  steps:
    - name: "Add the PDF"
      text: "The document properties and XMP fields appear as soon as it's read."
    - name: "Choose what to keep"
      text: "Tick Keep the title if you want it shown in viewers. Leave comment author removal on unless reviewers need names."
    - name: "Press Remove metadata and check the after list — the step people skip"
      text: "The tool re-reads the saved file. Anything still listed is really still there."
    - name: "Download the clean copy"
      text: "Send that one; keep your original if you need its history."
---

## What PDF metadata shows, and what this tool removes

Open any PDF's properties (Ctrl+D in Acrobat, Cmd+I in Preview) and you'll see who made it and with what. That information travels with the file when you email it, upload it to a job portal or publish it.

| Field | Example from our test file | After |
| --- | --- | --- |
| Author | Jane Smith (edited) | Removed |
| Title | Q3 Board Report - CONFIDENTIAL | Removed (or kept if you choose) |
| Subject, Keywords | Quarterly results; board, q3, confidential | Removed |
| Creator, Producer | Microsoft Word for Microsoft 365; Adobe PDF Library 23.1 | Removed |
| Created, Modified | 2026-10-02 09:14, 2026-10-20 12:00 | Removed |
| Custom property | Company: Acme Corp | Removed |
| XMP packet (1 KB) | Author, tool, document ID, 2 edit-history entries | Removed |
| PieceInfo | Private Illustrator data on page 1 | Removed |
| Comment authors | Jane Smith, Bob Jones | Removed; comments kept |
| File ID | A fixed ID from the original | Replaced with a random one |

After cleaning, pdfinfo reported no metadata stream and no custom metadata, and a search of the file's bytes found none of the author, company, software or XMP values. The only remaining "Jane" was inside a comment's text, which is content. The same file had an earlier saved revision holding the old author name; it was dropped too. On the IRS Form W-4 (8 properties, 4 KB of XMP), all 54 form fields still worked afterwards.

## Remove the author name from a PDF before you send it

Word, Google Docs and most scanners write your account name into the Author field. Removing it is the main reason people strip metadata: for anonymous peer review, blind job applications, legal disclosure and whistle-blowing. If you sign or edit the PDF later, the app you use may add its own Producer again, so clean the file last.

### For anonymous journal or conference review

Review systems ask for files with author names removed. Remove the metadata, and also check the first page, headers and file name.

### For job applications and public documents

A résumé's metadata can show an old employer's company name or the template author. A published report can leak the internal title and edit history.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| A name is still visible | It's on the page or in a comment's text: cover it with Edit PDF, then flatten. | Content isn't metadata. |
| Producer reappears after editing | Clean the file as the very last step. | Each PDF app stamps its own name when saving. |
| The file got slightly bigger | Nothing to fix; compress it if size matters. | The file is rewritten in a different internal layout. |
| "Needs a password to open" | Remove the open password first. | The file can't be read without it. |
