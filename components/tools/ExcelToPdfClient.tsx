"use client";

import { useState } from "react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, Progress, ResultPanel, Segmented, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, pdfBlob } from "@/lib/download";
import { csvToSheet, decodeText, readXlsx, sheetHasContent, sheetsToPdf, type PdfOptions, type SheetData } from "@/lib/sheet-pdf";
import { CheckOption, WarnNote } from "./convert-kit";

type Loaded = { file: File; sheets: SheetData[] };

export default function ExcelToPdfClient() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pageSize, setPageSize] = useState<PdfOptions["pageSize"]>("a4");
  const [orientation, setOrientation] = useState<PdfOptions["orientation"]>("auto");
  const [fitWidth, setFitWidth] = useState(true);
  const [gridlines, setGridlines] = useState(true);
  const [repeatHeader, setRepeatHeader] = useState(true);
  const [overflow, setOverflow] = useState<PdfOptions["overflow"]>("wrap");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; pages: number; warnings: string[] } | null>(null);

  const reset = () => {
    setLoaded(null);
    setSelected(new Set());
    setResult(null);
    setError(null);
    setProgress(null);
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    reset();
    const name = f.name.toLowerCase();
    try {
      let sheets: SheetData[];
      if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt") || f.type === "text/csv") {
        sheets = [csvToSheet(baseName(f.name).slice(0, 31) || "CSV", decodeText(new Uint8Array(await f.arrayBuffer())))];
      } else if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
        setBusy(true);
        sheets = await readXlsx(await f.arrayBuffer(), () => import("exceljs"));
      } else if (name.endsWith(".xls")) {
        throw new Error(
          "Old .xls files (Excel 97–2003) aren't supported. Open the file in Excel, Google Sheets or LibreOffice, save it as .xlsx, then try again."
        );
      } else if (name.endsWith(".ods") || name.endsWith(".numbers")) {
        throw new Error("This format isn't supported. Export the spreadsheet as .xlsx or .csv first, then try again.");
      } else {
        throw new Error("Choose an .xlsx or .csv file.");
      }
      const withContent = sheets.map((s, i) => (sheetHasContent(s) && !s.hidden ? i : -1)).filter((i) => i >= 0);
      if (!sheets.some(sheetHasContent)) throw new Error("This spreadsheet is empty, so there's nothing to convert.");
      setLoaded({ file: f, sheets });
      setSelected(new Set(withContent.length ? withContent : sheets.map((_, i) => i).filter((i) => sheetHasContent(sheets[i]))));
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "";
      setError(
        /supported|empty|Choose/.test(msg)
          ? msg
          : "Couldn't read this spreadsheet. It may be damaged, password-protected or not a real .xlsx file."
      );
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const sheets = loaded.sheets.filter((_, i) => selected.has(i));
      const out = await sheetsToPdf(sheets, {
        pageSize,
        orientation,
        fitWidth,
        gridlines,
        repeatHeader,
        overflow,
        onProgress: (v) => setProgress(v),
      });
      const warnings: string[] = [];
      if (out.replaced) {
        warnings.push(
          `${out.replaced} character${out.replaced === 1 ? " was" : "s were"} replaced with “?” (${out.samples.join(" ")}). The built-in PDF fonts only cover Latin-script text.`
        );
      }
      if (out.splitColumns) {
        warnings.push("Some sheets have more columns than fit across one page, so their columns continue on extra pages.");
      }
      setResult({ file: { blob: pdfBlob(out.bytes), name: `${baseName(loaded.file.name)}.pdf` }, pages: out.pages, warnings });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message ? e.message : "Couldn't create the PDF.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setResult(null);
  };

  if (!loaded) {
    return (
      <div>
        <Dropzone
          accept=".xlsx,.xlsm,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onFiles={onFiles}
          label="Drop an Excel (.xlsx) or CSV file here"
          hint="or tap to choose a file"
        />
        {busy && <Progress value={0.3} label="Reading the workbook…" />}
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  const { sheets, file } = loaded;

  return (
    <div>
      <FileBar
        name={file.name}
        detail={`${formatBytes(file.size)} · ${sheets.length} ${sheets.length === 1 ? "sheet" : "sheets"}`}
        onReset={reset}
      />

      {!result && (
        <div className="grid gap-5">
          {sheets.length > 1 && (
            <fieldset>
              <legend className="text-sm font-medium mb-1">Sheets to include</legend>
              <div className="grid sm:grid-cols-2 gap-x-4">
                {sheets.map((s, i) => {
                  const empty = !sheetHasContent(s);
                  return (
                    <CheckOption
                      key={i}
                      checked={selected.has(i)}
                      disabled={empty}
                      onChange={(v) => {
                        const next = new Set(selected);
                        if (v) next.add(i);
                        else next.delete(i);
                        setSelected(next);
                        setResult(null);
                      }}
                    >
                      {s.name}
                      {empty ? " (empty)" : s.hidden ? " (hidden)" : ""}
                    </CheckOption>
                  );
                })}
              </div>
            </fieldset>
          )}
          <Segmented
            label="Page size"
            value={pageSize}
            onChange={touch(setPageSize)}
            options={[
              { value: "a4", label: "A4", hint: "210 × 297 mm" },
              { value: "letter", label: "US Letter", hint: "8.5 × 11 in" },
            ]}
          />
          <Segmented
            label="Orientation"
            value={orientation}
            onChange={touch(setOrientation)}
            options={[
              { value: "auto", label: "Auto", hint: "Landscape for wide sheets" },
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
          <Segmented
            label="Long text in a cell"
            value={overflow}
            onChange={touch(setOverflow)}
            options={[
              { value: "wrap", label: "Wrap onto more lines" },
              { value: "truncate", label: "Cut off with …", hint: "Keeps every row one line high" },
            ]}
          />
          <div className="grid gap-0.5">
            <CheckOption checked={fitWidth} onChange={touch(setFitWidth)} hint="Shrinks text down to 6 pt before splitting columns onto extra pages">
              Fit all columns to the page width
            </CheckOption>
            <CheckOption checked={gridlines} onChange={touch(setGridlines)}>
              Print gridlines
            </CheckOption>
            <CheckOption checked={repeatHeader} onChange={touch(setRepeatHeader)} hint="The header row (the first row, or the first full row under a title) is printed bold at the top of every page">
              Repeat the header row on each page
            </CheckOption>
          </div>
          <div>
            <ActionButton onClick={convert} busy={busy} disabled={!selected.size}>
              Convert to PDF
            </ActionButton>
          </div>
        </div>
      )}

      {progress !== null && <Progress value={progress} label="Laying out the table…" />}
      <ErrorNote>{error}</ErrorNote>

      {result && (
        <>
          <ResultPanel
            title="PDF ready"
            files={[result.file]}
            note={`${result.pages} ${result.pages === 1 ? "page" : "pages"} from ${selected.size} ${selected.size === 1 ? "sheet" : "sheets"}.`}
            onReset={reset}
            resetLabel="Convert another file"
          />
          {result.warnings.map((w) => (
            <WarnNote key={w}>{w}</WarnNote>
          ))}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-sm text-zinc-500 hover:text-red-600 underline min-h-10"
            >
              Change options and convert again
            </button>
          </div>
        </>
      )}
    </div>
  );
}
