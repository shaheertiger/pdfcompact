"use client";

/**
 * OCR helpers shared by OCR PDF and Scan to PDF.
 *
 * How the searchable PDF is made: each page is rendered to a canvas, Tesseract
 * recognises it and writes a *text-only* PDF page (invisible text in a
 * glyphless font, so any script works, Hindi included). That page is embedded
 * with pdf-lib and drawn on top of the original page, scaled to its box. The
 * original page content is never touched, so the file looks exactly the same.
 */

import type { PDFDocument, PDFPage } from "pdf-lib";
import type Tesseract from "tesseract.js";
import { ocrLanguages, tesseractCorePath, tesseractLangPath, tesseractWorkerPath } from "@/lib/vendor";

export type OcrLang = (typeof ocrLanguages)[number]["code"];

/** Download size of each language file (gzipped traineddata, 4.0.0_best_int). */
export const ocrLangSizeMB: Record<OcrLang, number> = {
  eng: 2.9,
  hin: 1.4,
  spa: 2.1,
  fra: 0.7,
  deu: 1.3,
  por: 1.4,
};

export class OcrCancelled extends Error {
  constructor() {
    super("OCR was cancelled.");
    this.name = "OcrCancelled";
  }
}

export type OcrWorkerStatus = { status: string; progress: number };

/** A Tesseract worker plus a way to cancel whatever it is doing right now. */
export type OcrEngine = {
  worker: Tesseract.Worker;
  /** Rejects pending work with OcrCancelled and kills the worker thread. */
  cancel: () => void;
  cancelled: () => boolean;
  /** Race any promise against cancellation. */
  guard: <T>(p: Promise<T>) => Promise<T>;
  terminate: () => Promise<void>;
};

/**
 * Start a Tesseract worker. Every asset (worker, WASM core, language data) is
 * served from our own origin, see lib/vendor.ts. Language files are cached in
 * IndexedDB by tesseract.js after the first download.
 */
export async function createOcrEngine(
  langs: OcrLang[],
  onStatus?: (s: OcrWorkerStatus) => void
): Promise<OcrEngine> {
  const { createWorker, OEM } = await import("tesseract.js");
  let cancelledFlag = false;
  let rejectCancel: (e: Error) => void = () => {};
  const cancelPromise = new Promise<never>((_, reject) => {
    rejectCancel = reject;
  });
  // Avoid unhandled-rejection noise when nobody is awaiting.
  cancelPromise.catch(() => {});

  let worker: Tesseract.Worker | null = null;
  const guard = <T,>(p: Promise<T>) => Promise.race([p, cancelPromise]);

  const engine: OcrEngine = {
    get worker() {
      if (!worker) throw new OcrCancelled();
      return worker;
    },
    cancel: () => {
      if (cancelledFlag) return;
      cancelledFlag = true;
      rejectCancel(new OcrCancelled());
      void worker?.terminate();
    },
    cancelled: () => cancelledFlag,
    guard,
    terminate: async () => {
      await worker?.terminate();
      worker = null;
    },
  };

  const created = createWorker(langs.join("+"), OEM.LSTM_ONLY, {
    workerPath: tesseractWorkerPath,
    corePath: tesseractCorePath,
    langPath: tesseractLangPath,
    workerBlobURL: false,
    gzip: true,
    logger: (m) => onStatus?.({ status: m.status, progress: m.progress }),
    errorHandler: () => {},
  });
  try {
    worker = await guard(created);
  } catch (e) {
    // If cancelled during start-up, still kill the worker once it exists.
    created.then((w) => w.terminate()).catch(() => {});
    if (e instanceof OcrCancelled) throw e;
    throw new Error(
      "Couldn't start the OCR engine. Check your connection for the first run (the language file has to download once), then try again."
    );
  }
  if (cancelledFlag) {
    await worker.terminate();
    throw new OcrCancelled();
  }
  return engine;
}

export type RecognizedPage = {
  /** Plain recognised text. */
  text: string;
  /** Mean word confidence, 0–100. */
  confidence: number;
  /** One-page PDF with only invisible text, sized to the image. */
  textPdf: Uint8Array;
};

/** Recognise one canvas and get its text plus a text-only PDF page. */
export async function recognizeCanvas(
  engine: OcrEngine,
  canvas: HTMLCanvasElement,
  dpi: number
): Promise<RecognizedPage> {
  const res = await engine.guard(
    engine.worker.recognize(
      canvas,
      { pdfTextOnly: true, pdfTitle: "OCR", user_defined_dpi: String(Math.round(Math.min(2400, Math.max(70, dpi)))) } as Partial<Tesseract.RecognizeOptions>,
      { text: true, pdf: true }
    )
  );
  const pdf = res.data.pdf as unknown as number[] | Uint8Array | null;
  if (!pdf) throw new Error("The OCR engine returned no text layer for this page.");
  return {
    text: (res.data.text ?? "").replace(/\s+$/g, ""),
    confidence: res.data.confidence ?? 0,
    textPdf: pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf),
  };
}

/**
 * Draw a Tesseract text-only page over `page`, scaled to the page's visible
 * box and turned to match its /Rotate value. The text is invisible (render
 * mode 3), so the page looks unchanged but becomes searchable and copyable.
 */
export async function overlayTextLayer(
  doc: PDFDocument,
  page: PDFPage,
  textPdf: Uint8Array,
  /** Draw into this rectangle instead of the whole page (for a new, unrotated page holding one image). */
  target?: { x: number; y: number; width: number; height: number }
): Promise<void> {
  const { pushGraphicsState, popGraphicsState, concatTransformationMatrix } = await import("pdf-lib");
  const [embedded] = await doc.embedPdf(textPdf, [0]);
  if (target) {
    page.drawPage(embedded, {
      x: target.x,
      y: target.y,
      xScale: target.width / embedded.width,
      yScale: target.height / embedded.height,
    });
    return;
  }
  // Make sure the existing content is wrapped in q/Q so our drawing starts
  // from a clean graphics state.
  page.node.normalize();
  const box = page.getCropBox();
  const { x: x0, y: y0, width: W, height: H } = box;
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  const turned = rot === 90 || rot === 270;
  // Size of the page as it is displayed (what pdf.js rendered).
  const dw = turned ? H : W;
  const dh = turned ? W : H;
  const sx = dw / embedded.width;
  const sy = dh / embedded.height;
  // Map displayed coordinates (u, v) to unrotated page space (x, y).
  let m: [number, number, number, number, number, number];
  switch (rot) {
    case 90:
      m = [0, 1, -1, 0, x0 + W, y0];
      break;
    case 180:
      m = [-1, 0, 0, -1, x0 + W, y0 + H];
      break;
    case 270:
      m = [0, -1, 1, 0, x0, y0 + H];
      break;
    default:
      m = [1, 0, 0, 1, x0, y0];
  }
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m));
  page.drawPage(embedded, { x: 0, y: 0, xScale: sx, yScale: sy });
  page.pushOperators(popGraphicsState());
}

/** Largest canvas side we render for OCR. Phones get a smaller cap. */
export function maxOcrSide(): number {
  if (typeof navigator === "undefined") return 4000;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const touch = navigator.maxTouchPoints > 0 && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (touch || (mem !== undefined && mem <= 4)) return 3000;
  return 4000;
}

export type OcrPdfOptions = {
  langs: OcrLang[];
  /** Leave pages that already have a text layer alone (their text is still included in the .txt). */
  skipTextPages: boolean;
  /** Target resolution for recognition. */
  dpi?: number;
  onProgress?: (p: { page: number; index: number; total: number; stage: string; fraction: number }) => void;
  onEngine?: (engine: OcrEngine) => void;
};

export type OcrPageResult = {
  page: number;
  status: "ocr" | "skipped" | "empty";
  text: string;
  confidence?: number;
  ms?: number;
};

export type OcrPdfResult = {
  pdf: Uint8Array;
  pages: OcrPageResult[];
  text: string;
  ocrCount: number;
  skippedCount: number;
  dpiUsed: number[];
};

/** Count visible characters in a page's existing text layer. */
async function existingText(pdf: import("@/lib/pdfjs").PdfDoc, n: number): Promise<string> {
  const { extractPageText } = await import("@/lib/pdfjs");
  try {
    return await extractPageText(pdf, n);
  } catch {
    return "";
  }
}

export function hasRealText(s: string): boolean {
  return s.replace(/\s/g, "").length >= 20;
}

/** Find which pages already have a text layer (for the "skip" option). */
export async function detectTextPages(bytes: Uint8Array): Promise<{ pageCount: number; textPages: number[] }> {
  const { openPdf } = await import("@/lib/pdfjs");
  const pdf = await openPdf(bytes);
  const textPages: number[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    if (hasRealText(await existingText(pdf, i))) textPages.push(i);
  }
  const pageCount = pdf.numPages;
  await pdf.destroy();
  return { pageCount, textPages };
}

/** Make a whole PDF searchable. */
export async function ocrPdf(bytes: Uint8Array, opts: OcrPdfOptions): Promise<OcrPdfResult> {
  const { PDFDocument } = await import("pdf-lib");
  const { openPdf, renderPageToCanvas } = await import("@/lib/pdfjs");
  const dpi = opts.dpi ?? 300;

  const pdf = await openPdf(bytes);
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    await pdf.destroy();
    throw new Error("Couldn't read this PDF. It may be damaged or not a real PDF.");
  }
  if (doc.isEncrypted) {
    await pdf.destroy();
    throw new Error(
      "This PDF is encrypted (it has editing restrictions), so a text layer can't be added to it. Remove the restrictions first, then try again."
    );
  }
  const total = pdf.numPages;
  const pages: OcrPageResult[] = [];
  const dpiUsed: number[] = [];
  const report = (index: number, stage: string, fraction: number) =>
    opts.onProgress?.({ page: index + 1, index, total, stage, fraction });

  // Decide which pages need OCR before starting the engine.
  const existing: string[] = [];
  for (let i = 1; i <= total; i++) existing.push(await existingText(pdf, i));
  const todo = existing.flatMap((t, i) => (opts.skipTextPages && hasRealText(t) ? [] : [i]));

  let engine: OcrEngine | null = null;
  let current = todo[0] ?? 0;
  try {
    if (todo.length > 0) {
      engine = await createOcrEngine(opts.langs, (s) => {
        if (s.status.includes("loading language")) report(current, "Loading language data", 0);
        else if (s.status === "recognizing text") report(current, "Reading text", 0.3 + 0.7 * s.progress);
      });
      opts.onEngine?.(engine);
    }
    const cap = maxOcrSide();
    for (let i = 0; i < total; i++) {
      const pageNo = i + 1;
      if (!todo.includes(i)) {
        pages.push({ page: pageNo, status: "skipped", text: existing[i] });
        continue;
      }
      const eng = engine!;
      if (eng.cancelled()) throw new OcrCancelled();
      current = i;
      const started = performance.now();
      report(i, "Rendering", 0);
      const p = await pdf.getPage(pageNo);
      const vp = p.getViewport({ scale: 1 });
      let scale = dpi / 72;
      const longSide = Math.max(vp.width, vp.height) * scale;
      if (longSide > cap) scale *= cap / longSide;
      dpiUsed.push(Math.round(scale * 72));
      const canvas = await renderPageToCanvas(pdf, pageNo, scale);
      await new Promise((r) => setTimeout(r));
      report(i, "Reading text", 0.3);
      const rec = await recognizeCanvas(eng, canvas, scale * 72);
      canvas.width = canvas.height = 0;
      if (rec.text.trim().length === 0) {
        pages.push({ page: pageNo, status: "empty", text: "", confidence: rec.confidence, ms: performance.now() - started });
      } else {
        await overlayTextLayer(doc, doc.getPage(i), rec.textPdf);
        pages.push({ page: pageNo, status: "ocr", text: rec.text, confidence: rec.confidence, ms: performance.now() - started });
      }
      report(i, "Done", 1);
      await new Promise((r) => setTimeout(r));
    }
  } finally {
    await engine?.terminate();
    await pdf.destroy();
  }

  const out = await doc.save();
  return {
    pdf: out,
    pages,
    text: pagesToText(pages),
    ocrCount: pages.filter((p) => p.status === "ocr").length,
    skippedCount: pages.filter((p) => p.status === "skipped").length,
    dpiUsed,
  };
}

export function pagesToText(pages: { page: number; text: string }[]): string {
  if (pages.length === 1) return pages[0].text.trim() + "\n";
  return pages.map((p) => `--- Page ${p.page} ---\n${p.text.trim()}\n`).join("\n");
}
