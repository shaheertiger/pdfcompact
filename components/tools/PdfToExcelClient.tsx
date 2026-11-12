"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, InfoNote, Progress, ResultPanel, Segmented, type ResultFile } from "@/components/ui/kit";
import { baseName, bytesToBlob, formatBytes, isPdf } from "@/lib/download";
import { openPdf } from "@/lib/pdfjs";
import { useLocale, useStrings } from "@/lib/i18n";
import {
  buildSheets,
  chunksFromItems,
  detectBlocks,
  parseCell,
  rowsFromChunks,
  writeXlsx,
  type PageResult,
  type Sheet,
  type SheetMode,
} from "@/lib/pdf-table";

const strings = {
  en: {
    drop: "Drop a PDF with tables here",
    notPdf: "That isn't a PDF. Choose a .pdf file.",
    pages: (n: number) => `${n} ${n === 1 ? "page" : "pages"}`,
    sheets: "Sheets",
    single: "All pages in one sheet",
    singleHint: "Tables that run over several pages are joined",
    perPage: "One sheet per page",
    perPageHint: "Page 1, Page 2… as separate tabs",
    includeText: "Also export text outside tables (titles, account details)",
    convert: "Convert to Excel",
    reading: (p: number, n: number) => `Reading page ${p} of ${n}…`,
    writing: "Writing the spreadsheet…",
    scanned:
      "This PDF has no selectable text, so it's probably a scan or a photo. Run it through OCR PDF first to add a text layer, then convert it here.",
    ocrLink: "Open OCR PDF",
    noTables:
      "No tables with aligned columns were found. Tick “Also export text outside tables” to export every line of text instead.",
    done: "Spreadsheet ready",
    summary: (rows: number, sheets: number, num: number) =>
      `${rows} rows on ${sheets} ${sheets === 1 ? "sheet" : "sheets"}, ${num} cells converted to real numbers or dates.`,
    preview: (shown: number, name: string) => `Preview: first ${shown} rows of “${name}”`,
    check: "Check totals against the PDF before you rely on the numbers.",
    another: "Convert another PDF",
    failed: "Couldn't convert this PDF.",
  },
  es: {
    drop: "Suelta aquí un PDF con tablas",
    notPdf: "Ese archivo no es un PDF. Elige un archivo .pdf.",
    pages: (n: number) => `${n} ${n === 1 ? "página" : "páginas"}`,
    sheets: "Hojas",
    single: "Todas las páginas en una hoja",
    singleHint: "Las tablas que siguen en otra página se unen",
    perPage: "Una hoja por página",
    perPageHint: "Página 1, Página 2… en pestañas separadas",
    includeText: "Exportar también el texto fuera de las tablas (títulos, datos de la cuenta)",
    convert: "Convertir a Excel",
    reading: (p: number, n: number) => `Leyendo la página ${p} de ${n}…`,
    writing: "Creando la hoja de cálculo…",
    scanned:
      "Este PDF no tiene texto seleccionable, así que probablemente es un escaneo o una foto. Pásalo primero por OCR PDF para añadirle una capa de texto y luego conviértelo aquí.",
    ocrLink: "Abrir OCR PDF",
    noTables:
      "No se encontraron tablas con columnas alineadas. Marca “Exportar también el texto fuera de las tablas” para exportar todas las líneas de texto.",
    done: "Hoja de cálculo lista",
    summary: (rows: number, sheets: number, num: number) =>
      `${rows} filas en ${sheets} ${sheets === 1 ? "hoja" : "hojas"}; ${num} celdas convertidas en números o fechas reales.`,
    preview: (shown: number, name: string) => `Vista previa: primeras ${shown} filas de “${name}”`,
    check: "Compara los totales con el PDF antes de usar las cifras.",
    another: "Convertir otro PDF",
    failed: "No se pudo convertir este PDF.",
  },
};

const PREVIEW_ROWS = 12;

export default function PdfToExcelClient() {
  const t = useStrings(strings);
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [mode, setMode] = useState<SheetMode>("single");
  const [includeText, setIncludeText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<{ file: ResultFile; sheets: Sheet[]; numeric: number } | null>(null);
  const cache = useRef<{ file: File; pages: PageResult[] } | null>(null);

  const reset = () => {
    setFile(null);
    setPageCount(0);
    setResult(null);
    setError(null);
    setScanned(false);
    setProgress(null);
    cache.current = null;
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    reset();
    if (!isPdf(f)) {
      setError(t.notPdf);
      return;
    }
    setFile(f);
    try {
      const pdf = await openPdf(await f.arrayBuffer());
      setPageCount(pdf.numPages);
      await pdf.destroy();
    } catch (e) {
      setFile(null);
      setError(e instanceof Error ? e.message : t.failed);
    }
  };

  const readPages = async (f: File): Promise<PageResult[]> => {
    if (cache.current?.file === f) return cache.current.pages;
    const pdf = await openPdf(await f.arrayBuffer());
    const pages: PageResult[] = [];
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        setProgress({ value: (i - 1) / pdf.numPages, label: t.reading(i, pdf.numPages) });
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const chunks = chunksFromItems(content.items);
        pages.push({
          page: i,
          blocks: detectBlocks(rowsFromChunks(chunks)),
          textChars: chunks.reduce((n, c) => n + c.str.replace(/\s/g, "").length, 0),
        });
        page.cleanup();
        await new Promise((r) => setTimeout(r));
      }
    } finally {
      await pdf.destroy();
    }
    cache.current = { file: f, pages };
    return pages;
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setScanned(false);
    setResult(null);
    try {
      const pages = await readPages(file);
      const chars = pages.reduce((n, p) => n + p.textChars, 0);
      if (chars < 10 * pages.length) {
        setScanned(true);
        return;
      }
      const sheets = buildSheets(pages, mode, includeText);
      if (locale === "es") sheets.forEach((s) => (s.name = s.name.replace(/^Page /, "Página ").replace(/^Tables$/, "Tablas")));
      if (!sheets.length) {
        setError(t.noTables);
        return;
      }
      setProgress({ value: 0.95, label: t.writing });
      const bytes = await writeXlsx(sheets, () => import("exceljs"));
      const numeric = sheets
        .flatMap((s) => s.rows.filter((r) => !r.header).flatMap((r) => r.cells))
        .filter((c) => c && parseCell(c).kind !== "text").length;
      setResult({
        file: {
          blob: bytesToBlob(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
          name: `${baseName(file.name)}.xlsx`,
        },
        sheets,
        numeric,
      });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && e.message ? e.message : t.failed);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const changeOption = (fn: () => void) => {
    fn();
    setResult(null);
    setError(null);
  };

  if (!file) {
    return (
      <div>
        <Dropzone onFiles={onFiles} label={t.drop} />
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }

  const preview = result?.sheets[0];
  const previewRows = preview?.rows.slice(0, PREVIEW_ROWS) ?? [];
  const previewCols = Math.max(1, ...previewRows.map((r) => r.cells.length));
  const totalRows = result?.sheets.reduce((n, s) => n + s.rows.filter((r) => r.cells.some(Boolean)).length, 0) ?? 0;

  return (
    <div>
      <FileBar
        name={file.name}
        detail={`${formatBytes(file.size)}${pageCount ? ` · ${t.pages(pageCount)}` : ""}`}
        onReset={reset}
      />

      {!result && (
        <div className="grid gap-4">
          <Segmented
            label={t.sheets}
            value={mode}
            onChange={(v) => changeOption(() => setMode(v))}
            options={[
              { value: "single", label: t.single, hint: t.singleHint },
              { value: "per-page", label: t.perPage, hint: t.perPageHint },
            ]}
          />
          <label className="flex items-start gap-3 text-sm min-h-10 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-red-600 shrink-0"
              checked={includeText}
              onChange={(e) => changeOption(() => setIncludeText(e.target.checked))}
            />
            <span>{t.includeText}</span>
          </label>
          <div>
            <ActionButton onClick={convert} busy={busy} disabled={!pageCount}>
              {t.convert}
            </ActionButton>
          </div>
        </div>
      )}

      {progress && <Progress value={progress.value} label={progress.label} />}

      {scanned && (
        <ErrorNote>
          {t.scanned}{" "}
          <Link href="/ocr-pdf" className="underline font-medium">
            {t.ocrLink}
          </Link>
        </ErrorNote>
      )}
      <ErrorNote>{error}</ErrorNote>

      {result && preview && (
        <>
          <ResultPanel
            title={t.done}
            files={[result.file]}
            note={t.summary(totalRows, result.sheets.length, result.numeric)}
            onReset={reset}
            resetLabel={t.another}
          />
          <div className="mt-5">
            <p className="text-sm font-medium mb-2">{t.preview(previewRows.length, preview.name)}</p>
            <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10 max-w-full">
              <table className="text-xs sm:text-sm border-collapse min-w-full">
                <tbody>
                  {previewRows.map((r, ri) => (
                    <tr key={ri} className={r.header ? "bg-zinc-100 dark:bg-zinc-800 font-semibold" : ""}>
                      {Array.from({ length: previewCols }, (_, ci) => {
                        const raw = r.cells[ci] ?? "";
                        const kind = raw && !r.header ? parseCell(raw).kind : "text";
                        return (
                          <td
                            key={ci}
                            className={`border-t border-black/5 dark:border-white/10 px-2 py-1.5 whitespace-nowrap max-w-[14rem] truncate ${
                              kind === "number" ? "text-right tabular-nums" : ""
                            }`}
                          >
                            {raw}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <InfoNote>{t.check}</InfoNote>
          </div>
        </>
      )}
    </div>
  );
}
