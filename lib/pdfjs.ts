"use client";

import type * as PdfJsLib from "pdfjs-dist";

let pdfjsPromise: Promise<typeof PdfJsLib> | null = null;

export function loadPdfjs(): Promise<typeof PdfJsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return pdfjs;
    });
  }
  return pdfjsPromise;
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
