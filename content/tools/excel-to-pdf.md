---
title: "Excel to PDF Free — Fit Every Column on the Page, No Upload"
description: "Convert .xlsx sheets or CSV files to PDF in your browser. Fit columns to the page, repeat the header row, choose sheets and orientation. Nothing uploaded."
h1: "Excel to PDF — Turn a Spreadsheet Into a Printable PDF"
lead: "Drop an .xlsx or .csv file, pick the sheets, download a clean PDF table."
answer: "To convert Excel to PDF, drop an .xlsx or .csv file above, choose the sheets and press Convert. Cells print with the values Excel shows (formatted numbers, dates, formula results), numbers right-aligned and the header row repeated on every page. Wide sheets switch to landscape and shrink to fit. A 2,000-row sheet became a 45-page PDF in about 1.3 seconds."
keywords: ["excel to pdf", "xlsx to pdf", "convert excel to pdf", "csv to pdf", "excel to pdf fit to page"]
updated: 2026-11-12
related: [pdf-to-excel, word-to-pdf, merge-pdf, compress-pdf]
faq:
  - q: "Is my spreadsheet uploaded anywhere?"
    a: "No. The workbook is read and the PDF is drawn in your browser, on your device. Salaries, budgets and client lists never reach a server."
  - q: "Will formulas show their results?"
    a: "Yes. Each formula cell prints the result saved in the file, with the cell's number format, the same value you see in Excel. Formulas aren't recalculated, so save the file in Excel first if it's out of date."
  - q: "How do I fit all columns on one page?"
    a: "Leave “Fit all columns to the page width” ticked and orientation on Auto. Wide sheets turn landscape and the text shrinks down to 6 pt; beyond that, columns continue on extra pages with the first column repeated."
  - q: "Are charts and images included?"
    a: "No. Only cell contents are printed, with bold, italics, fill colours, borders and alignment. Charts, pictures, shapes and conditional formatting are left out."
  - q: "Can I convert only one sheet of a workbook?"
    a: "Yes. When a workbook has several sheets, untick the ones you don't need. Hidden sheets start unticked, and hidden rows and columns aren't printed."
  - q: "Does it work with CSV files?"
    a: "Yes. Comma, semicolon, tab and pipe separated files work, including quoted values with commas or line breaks inside them."
  - q: "Can I convert old .xls files?"
    a: "No. Open an .xls file in Excel, Google Sheets or LibreOffice, save it as .xlsx, then convert it here."
limits:
  - label: Price
    value: Free. No account, no watermark.
  - label: Where it runs
    value: In your browser. The file never leaves your device.
  - label: Input
    value: .xlsx (Excel 2007 and later), .xlsm and .csv. Not old .xls, .ods or Numbers files.
  - label: Output
    value: One PDF, A4 or US Letter, each sheet starting on a new page, with a sheet name and page number in the footer.
  - label: What's printed
    value: Displayed values, bold and italic, fill colours, borders, alignment, merged cells across columns.
  - label: What's left out
    value: Charts, images, shapes, comments, conditional formatting and Excel's own print settings.
  - label: Characters
    value: Latin-script text only. Other characters (Chinese, Arabic, emoji) print as “?” and you're warned when that happens.
  - label: Speed
    value: About 0.3 seconds for a 3-sheet budget; 2,000 rows × 6 columns took about 1.3 seconds (45 pages).
howto:
  question: "How do I convert an Excel file to PDF?"
  steps:
    - name: "Add your spreadsheet"
      text: "Drop an .xlsx or .csv file on the box above, or tap it to choose one."
    - name: "Choose the sheets"
      text: "Untick any sheets you don't want. Empty sheets can't be selected."
    - name: "Set page size and orientation"
      text: "A4 for most of the world, US Letter for the US and Canada. Auto turns wide sheets landscape."
    - name: "Check the fit options — the step that decides how it looks"
      text: "Fit to width shrinks text so every column fits; untick it to keep 9 pt text and let extra columns go to extra pages. Choose wrap or cut-off for long cells."
    - name: "Convert and download"
      text: "Press Convert to PDF, then the download button. Open the PDF and check it before you send it."
---

## How do I convert Excel to PDF and fit it on one page?

Keep “Fit all columns to the page width” ticked and orientation on Auto. The converter measures every column, and if the table is wider than a portrait page it turns the page landscape. If it's still too wide it shrinks the text, down to a minimum of 6 pt so it stays readable. Our 18-column test sheet fitted on landscape A4 this way.

When a sheet has too many columns even for that, the columns are split into groups that print one after another, the way Excel does it, with the first column (usually the row labels) repeated on each group. You'll see a note when this happens.

## Does Excel to PDF keep the numbers exactly as shown?

Yes, for the common formats. The converter reads each cell's number format and prints what Excel displays: 1234.5 with a currency format prints as $1,234.50, 0.125 with a percent format as 12.5%, and a date as 15 Dec 2026 or 2026-12-15 depending on its format. Formula cells print their saved results. Very unusual custom formats may print slightly differently, so check totals on the first page.

## How do I convert a CSV file to PDF?

Drop the .csv file the same way. The converter detects the separator (comma, semicolon, tab or pipe), handles quoted values and line breaks inside cells, and right-aligns anything that looks like a number. CSV files have no formatting, so the first row is treated as the header and repeated on each page if that option is on.

## Excel to PDF compared with other ways

| Method | Uploads your file? | Fit to width | Header on every page | Cost |
| --- | --- | --- | --- | --- |
| This page | No | Yes, automatic | Yes | Free |
| Excel "Save as PDF" | No | Yes, with Page Setup | Yes, with Print Titles | Microsoft 365 or Office licence |
| Google Sheets "Download as PDF" | Yes, to Google Drive | Yes | Yes | Free with a Google account |
| Print to PDF from a browser | No | Rarely right first time | No | Free |
| Typical online converters | Yes, to their server | Varies | Varies | Free with limits |

## When people convert spreadsheets to PDF

### Invoices and quotes for clients

A PDF can't be edited by accident and opens the same on every device. Convert the invoice sheet only, with gridlines off, and attach it to your email.

### Timesheets and expense reports for HR

Many HR portals accept only PDF uploads. Convert the month's timesheet with the header row repeated, so every page shows which column is which.

### Price lists and inventory to print

Long lists print better with Letter or A4 pages that each start with the header row. Turn on “Cut off with …” to keep every product on a single line.

### CSV exports from your bank or shop platform

Exports from Shopify, Stripe, PayPal or your bank arrive as CSV. Turn one into a PDF to file with your records or send to your accountant.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| Text is tiny | Untick “Fit all columns to the page width”, or hide columns you don't need in Excel. | Many columns had to shrink to fit one page width. |
| Columns continue on extra pages | Use landscape or Letter, hide unneeded columns, or accept the split. | The sheet is wider than a page even at 6 pt. |
| “?” instead of some characters | Use Excel's own Save as PDF for non-Latin text. | The standard PDF fonts only cover Latin-script characters. |
| A formula shows an old value | Open the file in Excel, let it recalculate, save, and convert again. | The PDF uses the result saved in the file; nothing is recalculated. |
| “Couldn't read this spreadsheet” | Re-save the file as .xlsx; remove any open password. | The file is damaged, encrypted or not really an .xlsx file. |
| A chart or logo is missing | Export the chart as an image and add it with Add Image to PDF. | Only cell contents are drawn. |
