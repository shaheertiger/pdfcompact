---
title: "Markdown to PDF Free — Convert MD to PDF, No Upload"
description: "Convert a Markdown (.md) file or pasted Markdown to PDF: GitHub tables, task lists, code blocks with colour, links. Letter or A4, selectable text, no upload."
h1: "Markdown to PDF — Convert an MD File to PDF"
lead: "Drop a .md file or paste Markdown, pick Letter or A4, download a clean PDF with selectable text."
answer: "To convert MD to PDF, drop your .md file below (or paste the Markdown) and press Convert to PDF. GitHub-flavoured Markdown is supported: headings, tables, task lists, code blocks with syntax colours, quotes and links. The PDF has selectable text on Letter or A4 pages. Our 18 KB, 40-section file became 11 pages in 0.3 seconds, without uploading anything."
answerFirst: true
keywords: ["convert md to pdf", "markdown to pdf", "md to pdf", "readme to pdf", "github markdown to pdf"]
updated: 2026-11-25
related: [ipynb-to-pdf, word-to-pdf, merge-pdf]
faq:
  - q: "How do I convert an MD file to PDF?"
    a: "Drop the .md file on the box above, or paste its text, then press Convert to PDF and download. It takes under a second for a typical README and nothing is uploaded."
  - q: "Are GitHub tables, task lists and code blocks supported?"
    a: "Yes. Tables keep their column alignment, task lists print as [x] and [ ], strikethrough works, and fenced code blocks get a grey band with colours for Python, JavaScript, TypeScript, Bash, SQL, R, Julia, Java, C, Go and Rust."
  - q: "What happens to images in my Markdown?"
    a: "Images embedded as data URIs are included. Images that point to a web address or a file next to your .md are left out and their alt text is printed, because the tool never fetches anything. Paste the images into a Word or PDF tool afterwards if you need them."
  - q: "Is raw HTML in Markdown safe?"
    a: "Yes. The HTML is never shown in this page: it's parsed into a detached document, scripts are ignored and only text, tables and lists are drawn into the PDF."
  - q: "Can I change the font or add a header?"
    a: "You can pick normal (10.5 pt) or large (12 pt) text and turn page numbers on or off. Fonts are fixed to Helvetica for text and Courier for code, which covers Latin-script languages only."
  - q: "Is YAML front matter printed?"
    a: "No. A block between --- lines at the very top of the file (used by Jekyll, Hugo and Obsidian) is skipped."
limits:
  - label: Price
    value: Free. No account, no watermark.
  - label: Where it runs
    value: In your browser. The file and pasted text never leave your device.
  - label: Input
    value: .md, .markdown or .txt files, or pasted text.
  - label: Markdown
    value: GitHub-flavoured. Headings, lists, task lists, tables, quotes, code blocks with colour, links, strikethrough.
  - label: Not supported
    value: Remote images, math typesetting, Mermaid diagrams, footnotes, custom CSS.
  - label: Output
    value: US Letter or A4, 10.5 or 12 pt text, optional page numbers, clickable links.
  - label: Fonts
    value: Helvetica and Courier. Emoji, Greek and CJK characters are replaced, and you're told which.
howto:
  question: "How do I convert Markdown to PDF?"
  steps:
    - name: "Add the Markdown"
      text: "Drop a .md file, or paste the text and press Use pasted text."
    - name: "Choose page size and text size"
      text: "Letter for the US and Canada, A4 elsewhere."
    - name: "Convert and read the notes — the step people skip"
      text: "The result lists any images left out or characters replaced, so you know before you send it."
    - name: "Download"
      text: "Links stay clickable in the PDF."
---

## Convert MD to PDF without Pandoc or VS Code extensions

The usual routes are a command-line tool (Pandoc, which needs LaTeX for PDF output) or an editor extension (VS Code's Markdown PDF installs a copy of Chromium). This page needs neither: the Markdown is parsed with [marked](https://marked.js.org) in your browser and laid out straight into a PDF with real text, so you can search and copy it.

| Markdown | In the PDF |
| --- | --- |
| `# Heading` to `######` | Bold headings in six sizes, kept with the next paragraph |
| Tables with `:---:` alignment | Bordered table, column alignment kept, fitted to the page |
| `- [x] done` / `- [ ] todo` | [x] done / [ ] todo, without bullets |
| Fenced code with a language | Monospaced on a grey band, keywords, strings and comments in colour |
| `> quote` | Grey text with a bar on the left |
| `[link](https://…)` | Blue, underlined, clickable |
| `![alt](https://…)` | Alt text in brackets (remote images aren't fetched) |
| `~~strike~~`, `**bold**`, `*italic*`, `` `code` `` | As written |

## Measured: README and long documents

| Test file | Size | Pages | PDF size | Time |
| --- | --- | --- | --- | --- |
| Project README: table, task list, 3 code blocks | 1.2 KB | 1 (Letter) | 5 KB | 0.3 s |
| 40 sections with tables and code | 18 KB | 11 (A4) | 23 KB | 0.3 s |

## When people convert Markdown to PDF

### For a README or documentation hand-off

Send a client or reviewer a PDF of your project's README.md or docs folder page, with code samples readable and links still clickable.

### For notes from Obsidian, Typora or Notion exports

Export the note as Markdown, drop it here, and print or share the PDF. Front matter is skipped. If the note has images, export them separately.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| Images are missing | Embed them as data URIs, or add them later with Add Image to PDF. | Images at a web address or on disk aren't fetched. |
| "?" instead of emoji or symbols | Replace them with words, or accept the substitution. | The built-in PDF fonts cover Latin script only. |
| A wide table is cramped | Split it into two tables or shorten the headers. | Tables are fitted to the page width. |
| Mermaid diagram shows as code | Export the diagram as an image first. | Diagrams need a renderer that isn't included. |
