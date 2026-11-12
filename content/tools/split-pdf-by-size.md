---
title: "Split PDF by Size Free — Parts Under 2, 5, 10 or 25 MB"
description: "Split a large PDF into parts that each stay under a size you choose (2 to 25 MB or custom). Pages stay unchanged, ZIP download, nothing uploaded."
h1: "Split PDF by Size — Cut a Big PDF Into Parts Under a Limit"
lead: "Pick a maximum size per part, get a ZIP of PDFs that each fit under it."
answer: "To split a PDF by size, drop the file, pick a limit such as 5 MB or 10 MB (or type your own) and press Split. The tool packs whole pages into each part, saves it and checks the real size, so every part ends up under the limit. A 12 MB, 24-page photo PDF split into seven parts of 1.6–1.9 MB in under a second, in your browser."
keywords: ["split pdf by size", "split pdf into smaller files", "split pdf by file size", "split pdf under 10mb", "split large pdf for email"]
updated: 2026-11-12
related: [split-pdf, compress-pdf, merge-pdf, extract-pdf-pages]
faq:
  - q: "Will every part really be under the limit?"
    a: "Yes, except a single page that is bigger than the limit on its own. It goes into a part by itself, marked as over, and you can shrink it with Compress PDF."
  - q: "Does splitting reduce quality?"
    a: "No. Pages are copied exactly as they are, without re-compressing images."
  - q: "How is a megabyte counted?"
    a: "As 1,000,000 bytes, the stricter of the two common definitions, so parts pass forms that count either way."
  - q: "Why are the parts different sizes?"
    a: "Pages are kept whole and in order, so a part ends when the next page wouldn't fit."
  - q: "Is there a limit on the file I split?"
    a: "There's no fixed cap; your device's memory is the limit, so phones may struggle with very large files."
  - q: "Do links and bookmarks survive?"
    a: "Page content and web links are kept. Bookmarks and links that jump to another page are removed, because that page may be in another part."
limits:
  - label: Price
    value: Free. No account, no watermark, no daily cap.
  - label: Where it runs
    value: In your browser. Your file is never uploaded.
  - label: Size limits
    value: 2, 5, 10, 20 or 25 MB presets, or any custom limit from 0.1 MB.
  - label: Accuracy
    value: Every part is saved and measured; parts over the limit are rebuilt smaller.
  - label: Oversized pages
    value: A page bigger than the limit on its own goes in its own part and is flagged.
  - label: Quality
    value: Unchanged. Pages are copied, not re-compressed.
  - label: Output
    value: A ZIP of numbered parts, or download each part on its own.
  - label: What's dropped
    value: Bookmarks and internal page-to-page links.
howto:
  question: "How do I split a PDF into smaller files by size?"
  steps:
    - name: "Drop your PDF"
      text: "You'll see its page count and size."
    - name: "Choose the size per part — leave headroom for email"
      text: "Email services count the encoded message, about a third bigger than the file, so pick about 18 MB for Gmail and 14 MB for Outlook. Picking the exact advertised limit is the most common mistake."
    - name: "Press Split"
      text: "Pages are packed into parts, and each part is saved and checked against your limit."
    - name: "Download the ZIP or single parts"
      text: "The table shows each part's page range and size."
---

## How do I split a PDF to email it through Gmail or Outlook?

Gmail allows 25 MB of attachments per email and Outlook.com 20 MB, but both count the encoded message, roughly a third bigger than the files. Split at 18 MB for Gmail or 14 MB for Outlook, send one part per email and number them ("part 2 of 3").

## How many parts will I get?

Roughly the file size divided by your limit, plus one. Our tests on the 12.3 MB, 24-page photo file:

| Limit per part | Parts | Part sizes | Time |
| --- | --- | --- | --- |
| 2 MB | 7 | 1.56–1.93 MB | under 0.5 s |
| 5 MB | 3 | 2.87–4.74 MB | under 0.5 s |
| 1 MB (mixed file, 3.2 MB) | 4 | 0.64–0.66 MB, plus one 1.31 MB page flagged as over | under 0.5 s |

## What if one page is bigger than the limit?

A single page can't be split, so it goes into a part on its own and the tool tells you which page it is. Run that part through [Compress PDF](/compress-pdf), which shrinks the photos inside it, and it will usually drop well under the limit.

## When people split PDFs by size

### Court e-filing and government portals

E-filing systems and government portals cap each uploaded PDF, and the cap varies by court and agency. Choose a limit just below the number on the upload page. If each exhibit must be its own file, split at exhibit boundaries with [Split PDF](/split-pdf) instead.

### Immigration and visa uploads

IRCC and other immigration portals limit each uploaded document. Split a long bank statement into parts under the stated limit and upload them in the same section.

### Job portals

Many applicant tracking systems cap uploads at a few MB. Compress a portfolio first and split only if it's still too big.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| One part is over the limit | Compress that part with Compress PDF. | It's a single page that is bigger than the limit on its own. |
| The email still bounces | Pick a smaller limit, such as 18 MB for Gmail. | Email encoding adds about a third to the attachment size. |
| "Needs a password to open" | Remove the open password first. | The file can't be read without it. |
