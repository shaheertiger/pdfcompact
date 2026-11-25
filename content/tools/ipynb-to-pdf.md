---
title: "IPYNB to PDF Free — Jupyter Notebook to PDF, No Upload"
description: "Convert a Jupyter notebook (.ipynb) to PDF with code, Markdown, charts, tables and tracebacks, or hide the code. Selectable text. No Python, LaTeX or upload."
h1: "IPYNB to PDF — Convert a Jupyter Notebook to PDF"
lead: "Drop an .ipynb file, choose whether to show the code, download a PDF with selectable text."
answer: "To convert an IPYNB file to PDF, drop the notebook below and press Convert to PDF. Markdown, highlighted code, printed output, charts (PNG, JPEG, SVG), DataFrame tables and error tracebacks are laid out on Letter or A4 pages with selectable text. Tick Hide code for a report. No Python, LaTeX or upload needed; our 20-chart notebook took 2.2 seconds."
answerFirst: true
keywords: ["ipynb to pdf", "jupyter notebook to pdf", "convert ipynb to pdf", "jupyter to pdf without latex", "export jupyter notebook as pdf"]
updated: 2026-11-25
related: [markdown-to-pdf, word-to-pdf, compress-pdf, merge-pdf]
faq:
  - q: "How do I convert a Jupyter notebook to PDF without LaTeX?"
    a: "Use this page: it lays the notebook out in your browser, so you need neither LaTeX nor Python. Jupyter's own File > Save and Export Notebook As > PDF calls nbconvert, which needs a TeX installation; the WebPDF option needs a headless Chromium instead."
  - q: "Does it run my notebook?"
    a: "No. It prints the outputs already saved in the .ipynb file. If a chart or result is missing, run all cells in Jupyter, save, then convert again. Nothing in the notebook is executed here, including HTML output, whose scripts are removed."
  - q: "Can I hide the code and keep only the charts and text?"
    a: "Yes. Tick Hide code (inputs). Markdown, charts, tables and printed results stay; code cells and their In [n] labels go. Our sales notebook went from 3 pages to 2."
  - q: "Is the text in the PDF selectable and searchable?"
    a: "Yes. Text is drawn with real PDF fonts (Helvetica for prose, Courier for code), so you can search, copy and paste it. Charts are embedded as images at their saved resolution."
  - q: "Are LaTeX formulas rendered?"
    a: "No. Math such as $\\sum x_i^2$ is printed as its LaTeX source, so it stays readable but isn't typeset. If you need typeset equations, use nbconvert with a TeX installation."
  - q: "Why are some characters shown as a question mark?"
    a: "The built-in PDF fonts cover Latin-script text only. Emoji, Greek letters, CJK and most math symbols are replaced, and the tool tells you how many and which ones before you download."
  - q: "Does it work for Google Colab, VS Code and JupyterLab notebooks?"
    a: "Yes. They all save the same .ipynb format (nbformat 4). In Colab use File > Download > Download .ipynb, then drop that file here. Older nbformat 3 notebooks are read too."
  - q: "Is my notebook uploaded?"
    a: "No. The file is read and converted by JavaScript in this tab and never leaves your device. That matters for notebooks with credentials, customer data or unpublished results in their outputs."
limits:
  - label: Price
    value: Free. No account, no watermark.
  - label: Where it runs
    value: In your browser. The notebook never leaves your device.
  - label: Input
    value: Jupyter .ipynb (nbformat 4; nbformat 3 is read too) from Jupyter, JupyterLab, Colab or VS Code.
  - label: Printed outputs
    value: Text, stdout and stderr, error tracebacks (colour codes removed), PNG, JPEG and SVG charts, HTML tables such as pandas DataFrames.
  - label: Not printed
    value: Interactive outputs that need JavaScript (Plotly, Bokeh, ipywidgets) get a note instead. Remote images aren't fetched.
  - label: Math and fonts
    value: LaTeX is printed as source, not typeset. Helvetica and Courier, Latin script only; emoji and CJK are replaced.
  - label: Options
    value: US Letter or A4, hide code, In/Out labels on or off, page numbers.
  - label: Speed
    value: 0.4 s for a 9-cell notebook, 2.2 s for one with 20 retina charts (desktop Chrome).
howto:
  question: "How do I convert an IPYNB file to PDF?"
  steps:
    - name: "Run all cells and save the notebook — the step people skip"
      text: "The PDF shows the outputs stored in the file. In Jupyter use Run > Run All Cells, then save; in Colab, download the .ipynb after running."
    - name: "Drop the .ipynb file above"
      text: "It's read in your browser. Nothing is uploaded."
    - name: "Choose page size and whether to show code"
      text: "Tick Hide code (inputs) for a report that shows only Markdown, charts and results."
    - name: "Press Convert to PDF and check the notes"
      text: "The result lists pages, figures and tracebacks, and warns about replaced characters or interactive outputs."
    - name: "Download"
      text: "Open the PDF and check a page or two before you submit or share it."
---

## Convert a Jupyter notebook to PDF without nbconvert or LaTeX

Jupyter's built-in PDF export runs `jupyter nbconvert --to pdf`, which typesets the notebook through LaTeX. On a laptop without TeX Live or MiKTeX it stops with "xelatex not found", and on a locked-down work or school computer you often can't install it. This page skips that: it reads the notebook's JSON in your browser and lays out each cell as PDF text and images.

| Method | What you need | Text in PDF | Math | Best for |
| --- | --- | --- | --- | --- |
| This page | A browser | Selectable | LaTeX source | Quick hand-ins, reports, any computer |
| nbconvert `--to pdf` | Python, nbconvert, TeX Live or MiKTeX | Selectable | Typeset | Math-heavy papers |
| nbconvert `--to webpdf` | Python, nbconvert, headless Chromium | Selectable | Typeset (MathJax) | Looks like the notebook screen |
| Browser Print to PDF | A running Jupyter or Colab tab | Selectable | As on screen | One-off, but page breaks cut charts |

## What a notebook looks like as a PDF

Each cell becomes a block on the page, in order:

- **Markdown cells**: headings, lists, tables, links, bold and italic. Images pasted into a cell (attachments) are included.
- **Code cells**: monospaced on a grey band, with Python keywords, strings, comments and numbers in colour, and the In [n] label. Indentation is kept; long lines wrap.
- **Printed output and logs**: as plain text. Warnings on stderr get a pale orange band, and progress bars that redraw themselves show only their final line.
- **Charts**: matplotlib, seaborn and other PNG, JPEG or SVG figures, scaled to the page width.
- **DataFrames**: the HTML table pandas shows, with borders. Scripts and styles inside HTML output are removed.
- **Errors**: the full traceback on a pale red band, without the terminal colour codes that otherwise print as `[0;31m`.

We measured these test notebooks in desktop Chrome:

| Test notebook | File size | Cells | PDF (Letter) | Code hidden | Time |
| --- | --- | --- | --- | --- | --- |
| Sales analysis: DataFrame, 2 charts, SVG, traceback | 14 KB | 9 | 3 pages, 17 KB | 2 pages, 14 KB | 0.4 s |
| Training log: 30 code cells, 6 charts | 48 KB | 31 | 7 pages, 34 KB | 6 pages, 25 KB | 0.5 s |
| Model report: 20 retina (1200 px) charts | 627 KB | 21 | 14 pages, 466 KB | 10 pages, 453 KB | 2.2 s |

## How to hide code when converting a notebook to PDF

Tick **Hide code (inputs)** before converting. Code cells and their In [n] labels are left out; their outputs, and every Markdown cell, stay. This is the browser equivalent of `jupyter nbconvert --no-input`, and it's what most managers and clients want: the story and the charts, not the pandas calls.

## Turning in a notebook as a PDF

### For Gradescope and Canvas assignments

Many data science courses ask for a PDF of the executed notebook so graders can annotate it. Run all cells, save, convert, and check every question's output is on a page before uploading. If the PDF is over the course's size limit, run it through [Compress PDF](/compress-pdf).

### For a report to a manager or client

Tick Hide code, keep page numbers on, and choose A4 or Letter to match the reader's printer. Merge it with a cover page using [Merge PDF](/merge-pdf).

### For a Kaggle or Colab notebook

Download the .ipynb from Colab (File > Download) or Kaggle (File > Download notebook) and drop it here. Outputs saved in the file are printed.

### For archiving an analysis

A PDF keeps the results as they were on the day you ran them, readable without Python. Keep the .ipynb too if you might need to re-run it.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| Charts or results are missing | Run all cells, save, download the .ipynb again, convert. | Only outputs saved in the file can be printed. |
| A box says "Interactive output can't be printed" | Save the chart as an image (for Plotly: `fig.show("png")`), re-run, convert. | Plotly, Bokeh and widgets need JavaScript to draw. |
| Characters appear as "?" | Rename emoji or symbols in Markdown, or accept the substitution. | The built-in PDF fonts cover Latin script only. |
| Equations show as `$...$` | Use nbconvert with LaTeX for typeset math. | Math is printed as its source. |
| "This file isn't valid notebook JSON" | Download the notebook again from Jupyter or Colab. | The file is cut off, or it's a .py script, not an .ipynb. |
| A wide DataFrame is squeezed | Show fewer columns (`df.iloc[:, :8]`) before saving. | Tables are fitted to the page width. |
