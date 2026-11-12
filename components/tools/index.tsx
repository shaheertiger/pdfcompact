import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * Maps each tool slug to its interactive client component. next/dynamic keeps
 * every tool in its own chunk, so a tool page only ships its own code.
 */
export const toolClients: Record<string, ComponentType> = {
  "merge-pdf": dynamic(() => import("./MergeClient")),
  "split-pdf": dynamic(() => import("./SplitClient")),
  "organize-pdf": dynamic(() => import("./OrganizeClient")),
  "delete-pdf-pages": dynamic(() => import("./DeletePagesClient")),
  "extract-pdf-pages": dynamic(() => import("./ExtractPagesClient")),
  "rotate-pdf": dynamic(() => import("./RotatePdfClient")),
  "split-pdf-by-size": dynamic(() => import("./SplitPdfBySizeClient")),
  "split-pdf-in-half": dynamic(() => import("./SplitPdfInHalfClient")),
  "crop-pdf": dynamic(() => import("./CropPdfClient")),
  "compress-pdf": dynamic(() => import("./CompressPdfClient")),
  "flatten-pdf": dynamic(() => import("./FlattenPdfClient")),
  "compare-pdf": dynamic(() => import("./ComparePdfClient")),
  "pdf-to-pdfa": dynamic(() => import("./PdfToPdfaClient")),
  "pdf-to-word": dynamic(() => import("./PdfToWordClient")),
  "pdf-to-text": dynamic(() => import("./PdfToTextClient")),
  "pdf-to-jpg": dynamic(() => import("./PdfToJpgClient")),
  "pdf-to-png": dynamic(() => import("./PdfToPngClient")),
  "pdf-to-excel": dynamic(() => import("./PdfToExcelClient")),
  "extract-images": dynamic(() => import("./ExtractImagesClient")),
  "jpg-to-pdf": dynamic(() => import("./JpgToPdfClient")),
  "word-to-pdf": dynamic(() => import("./WordToPdfClient")),
  "excel-to-pdf": dynamic(() => import("./ExcelToPdfClient")),
  "heic-to-pdf": dynamic(() => import("./HeicToPdfClient")),
  "epub-to-pdf": dynamic(() => import("./EpubToPdfClient")),
  "edit-pdf": dynamic(() => import("./EditPdfClient")),
  "sign-pdf": dynamic(() => import("./SignPdfClient")),
  "add-page-numbers": dynamic(() => import("./AddPageNumbersClient")),
  "watermark-pdf": dynamic(() => import("./WatermarkPdfClient")),
  "add-image-to-pdf": dynamic(() => import("./AddImageToPdfClient")),
  "protect-pdf": dynamic(() => import("./ProtectPdfClient")),
  "ocr-pdf": dynamic(() => import("./OcrPdfClient")),
  "scan-to-pdf": dynamic(() => import("./ScanToPdfClient")),
  "compress-image": dynamic(() => import("./CompressImageClient")),
  "resize-image": dynamic(() => import("./ResizeImageClient")),
  "edit-text-in-image": dynamic(() => import("./EditTextInImageClient")),
  "heic-to-jpg": dynamic(() => import("./HeicToJpgClient")),
};
