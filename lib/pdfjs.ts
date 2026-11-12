"use client";

import type * as PdfJsLib from "pdfjs-dist";
import { pdfWorkerSrc } from "@/lib/vendor";

let pdfjsPromise: Promise<typeof PdfJsLib> | null = null;

export function loadPdfjs(): Promise<typeof PdfJsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export type PdfDoc = PdfJsLib.PDFDocumentProxy;

/** Open a PDF with pdf.js. Throws a friendly error for password-protected files. */
export async function openPdf(data: ArrayBuffer | Uint8Array, password?: string): Promise<PdfDoc> {
  const pdfjs = await loadPdfjs();
  // pdf.js transfers the buffer to its worker, so hand it a copy.
  const copy = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0));
  try {
    return await pdfjs.getDocument({ data: copy, password, isEvalSupported: false }).promise;
  } catch (e) {
    if (e && typeof e === "object" && "name" in e && e.name === "PasswordException") {
      throw new Error("This PDF is password-protected. Remove the password first, then try again.");
    }
    throw new Error("Couldn't read this PDF. It may be damaged or not a real PDF.");
  }
}

/** Render a page to a canvas at the given scale. */
export async function renderPageToCanvas(
  pdf: PdfDoc,
  pageNumber: number,
  scale: number,
  background: string | null = "#ffffff"
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser blocked the canvas this tool needs.");
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  await page.render({ canvas, canvasContext: context, viewport, background: background ?? "rgba(0,0,0,0)" }).promise;
  page.cleanup();
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the image."))), type, quality)
  );
}

export async function renderPageThumbnail(
  pdf: PdfJsLib.PDFDocumentProxy,
  pageNumber: number,
  maxWidth = 220
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(scaledViewport.width);
  canvas.height = Math.ceil(scaledViewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas not supported");

  await page.render({ canvas, canvasContext: context, viewport: scaledViewport })
    .promise;
  return canvas.toDataURL("image/png");
}

export async function renderPageToJpegBlob(
  pdf: PdfJsLib.PDFDocumentProxy,
  pageNumber: number,
  scale = 2,
  quality = 0.9
): Promise<Blob> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas not supported");

  // JPEG has no alpha channel; paint a white background first.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvas, canvasContext: context, viewport }).promise;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality
    );
  });
}

export async function extractPageText(
  pdf: PdfJsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const lines: string[] = [];
  let currentLine = "";
  let lastY: number | null = null;

  for (const item of content.items) {
    if (!("str" in item)) continue;
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2) {
      lines.push(currentLine);
      currentLine = "";
    }
    currentLine += item.str;
    lastY = y;
  }
  if (currentLine) lines.push(currentLine);
  return lines.join("\n");
}
