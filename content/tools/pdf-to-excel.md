---
title: "PDF to Excel Free — Bank Statements to .xlsx, No Upload"
description: "Turn tables in a PDF into an Excel .xlsx file in your browser. Amounts become real numbers, ISO dates real dates, with a preview before download. No upload."
h1: "PDF to Excel — Convert PDF Tables to a Spreadsheet"
lead: "Drop a PDF with tables, check the preview, download an .xlsx file you can sort and sum."
answer: "To convert a PDF to Excel, drop the file above and press Convert. The tool reads the text positions on each page, finds rows and columns, and writes an .xlsx file where amounts like 3,250.00 or (12.00) are real numbers you can add up. A 2-page bank statement takes about a second. It works on PDFs with real text; scanned pages need OCR first."
keywords: ["pdf to excel", "convert pdf to excel", "pdf to xlsx", "bank statement pdf to excel", "pdf table to excel free"]
updated: 2026-11-12
related: [excel-to-pdf, pdf-to-word, ocr-pdf, pdf-to-text]
faq:
  - q: "Is it safe to convert a bank statement here?"
    a: "Yes. The PDF is read by your own browser and the spreadsheet is built on your device. Nothing is uploaded, so account numbers and balances never reach a server."
  - q: "Will the numbers be real numbers in Excel?"
    a: "Yes, when they look like amounts. Values such as 1,234.56, $3,250.00, (12.00), -5 and 12.5% become numeric cells with a matching number format, so SUM and sorting work straight away."
  - q: "Why does it say no tables were found?"
    a: "The PDF has text but nothing lined up in columns, such as a letter or a report. Tick “Also export text outside tables” to get every line of text in column A instead."
  - q: "Can it convert a scanned PDF to Excel?"
    a: "Not directly. A scan is a picture with no text to read. Run it through [OCR PDF](/ocr-pdf) first to add a text layer, then convert the result here."
  - q: "Does it keep merged cells, colours and borders?"
    a: "No. You get the values in a clean grid with a bold header row and sensible column widths. Formatting from the PDF isn't copied."
  - q: "What happens when a table continues on the next page?"
    a: "With “All pages in one sheet”, a table that carries on with the same columns is joined into one list, the repeated header row is dropped and page footers in between are skipped."
  - q: "Does it work on iPhone and Android?"
    a: "Yes. Open the page in Safari or Chrome, pick the PDF from Files or Downloads, and save the .xlsx. Numbers and Google Sheets open it too."
limits:
  - label: Price
    value: Free. No account, no watermark, no page cap.
  - label: Where it runs
    value: In your browser. The PDF never leaves your device.
  - label: Works best on
    value: PDFs with real text tables, such as bank statements, invoices and reports exported from software.
  - label: Not supported
    value: Scanned or photographed pages (use OCR PDF first), rotated text, and password-protected PDFs.
  - label: Output
    value: One .xlsx file, all pages in one sheet or one sheet per page.
  - label: Cell types
    value: Amounts become numbers, ISO dates (2026-03-15) and dates like 15 Mar 2026 become dates; everything else stays text.
  - label: What's lost
    value: Merged cells, colours, borders, fonts and images. Multi-line cells are joined when the layout makes that clear.
  - label: Speed
    value: About 1 second for a 2-page statement; a 45-page, 2,000-row statement took about 1.6 seconds in our tests.
howto:
  question: "How do I convert a PDF table to Excel?"
  steps:
    - name: "Add your PDF"
      text: "Drop the file on the box above or tap it to choose one. The page count shows once it's loaded."
    - name: "Choose how pages map to sheets"
      text: "Pick “All pages in one sheet” for a statement that runs over several pages, or “One sheet per page” to keep pages apart."
    - name: "Decide about the text around the table — the step people miss"
      text: "By default only tables are exported. Tick the box if you also want titles, account details or notes in the sheet."
    - name: "Convert and check the preview"
      text: "Press Convert to Excel. The first rows appear in a preview; check the columns line up before you rely on them."
    - name: "Download the .xlsx"
      text: "Press the download button and open the file in Excel, Google Sheets, Numbers or LibreOffice."
---

## How do I convert a bank statement PDF to Excel?

Download the statement from your bank's website as a PDF (not a photo or a scan), drop it here and keep “All pages in one sheet” selected. The tool finds the transaction table on each page, joins the pages into one list and drops the header row your bank repeats at the top of every page. Dates in ISO form become real Excel dates and every amount becomes a number, so you can sort by amount, filter by description and total each category.

On our 2-page test statement (45 transactions, five columns: date, description, debit, credit, balance) the result was exactly 45 rows under one bold header, with all 45 balances as numeric cells. Compare the closing balance with the PDF before you trust the totals; a misread column shows up there first.

## How does the PDF to Excel converter find the columns?

A digital PDF stores each piece of text with its position on the page. The converter groups text that sits on the same line into rows, then looks for the vertical gaps that stay empty down most of those rows: those gaps are the column boundaries. A header that's centred over a column is matched to the nearest real column, and a description that wraps onto a second line is folded back into its row when the spacing makes that clear.

This works well on tables produced by software (banking systems, accounting packages, spreadsheets saved as PDF). It struggles when columns aren't lined up, when one cell spans several columns, or when text is rotated.

## Can I convert a PDF to Excel without software?

Yes. You don't need Adobe Acrobat, Excel's import wizard or an online converter that uploads your file. This page runs in the browser you already have and builds the .xlsx on your device. That matters for documents you'd rather not hand to a third party: payslips, tax forms and statements.

## PDF to Excel compared with other ways

| Method | Uploads your file? | Amounts as numbers | Handles scans | Cost |
| --- | --- | --- | --- | --- |
| This page | No | Yes | No, run OCR first | Free |
| Copy and paste from a PDF viewer | No | Often pasted as text in one column | No | Free |
| Excel "Get Data from PDF" (Windows) | No | Yes | No | Microsoft 365 subscription |
| Adobe Acrobat export | Depends on the version | Yes | Yes, with OCR | Paid subscription |
| Typical online converters | Yes, to their server | Usually | Some | Free with limits |

## When people convert PDF tables to Excel

### Bank statements into a budget spreadsheet

Most banks only offer older statements as PDFs. Convert a year of statements, paste the rows into your budget template in Google Sheets or Excel, and categorise spending with a filter instead of retyping each line.

### Statements and receipts for your accountant at tax season

Accountants usually want transactions in a spreadsheet, not twelve PDFs. Convert each statement, combine the sheets, and send one .xlsx with deductible items marked in a spare column.

### Supplier invoices into bookkeeping

Line items on a PDF invoice (item, quantity, unit price, total) come out as a small table you can paste into QuickBooks, Xero or Wave import templates, or into your own purchase log.

### Reports with figures you need to chart

Annual reports, price lists and government statistics are often published only as PDF. Pull the tables out, then chart or compare them in a spreadsheet.

## Troubleshooting

| Problem | Fix | Why it happens |
| --- | --- | --- |
| "No selectable text" message | Run the PDF through OCR PDF, then convert the OCR'd file here. | The page is an image (a scan or photo), so there's no text to place in cells. |
| "No tables found" | Tick “Also export text outside tables” to export every line. | The text isn't arranged in aligned columns. |
| Two columns merged into one | Try “One sheet per page”, or split the column in Excel with Text to Columns. | The gap between the columns is very narrow or crossed by long text on many rows. |
| Numbers stayed as text | Check for unusual symbols or spaces; Excel's VALUE() can fix the rest. | Only clear amount formats are converted, so codes like 00123 keep their leading zeros. |
| Dates came through as text | Use Excel's DATEVALUE or Text to Columns with your date order. | 03/04/2026 could be March or April, so only unambiguous dates are converted. |
| A row is split in two | Merge the two cells by hand; it's usually a wrapped description. | The wrapped line was spaced like a separate row. |
| "Password-protected" error | Open it with the password and save an unprotected copy, then try again. | Files locked with an open password can't be read without it. |
