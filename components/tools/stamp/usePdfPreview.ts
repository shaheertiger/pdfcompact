"use client";

import { useEffect, useState } from "react";
import { openPdf, type PdfDoc } from "@/lib/pdfjs";

/** Open a PDF with pdf.js for on-screen previews. */
export function usePdfDoc(bytes: Uint8Array | null) {
  const [state, setState] = useState<{ pdf: PdfDoc | null; error: string | null; forBytes: Uint8Array | null }>({
    pdf: null,
    error: null,
    forBytes: null,
  });

  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    let opened: PdfDoc | null = null;
    openPdf(bytes)
      .then((pdf) => {
        opened = pdf;
        if (cancelled) pdf.destroy();
        else setState({ pdf, error: null, forBytes: bytes });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ pdf: null, error: e instanceof Error ? e.message : String(e), forBytes: bytes });
      });
    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [bytes]);

  const current = bytes && state.forBytes === bytes;
  return {
    pdf: current ? state.pdf : null,
    error: current ? state.error : null,
    loading: Boolean(bytes) && !current,
  };
}

export type PageRender = {
  url: string;
  /** Page size as displayed (after rotation and cropping), in PDF points. */
  ptWidth: number;
  ptHeight: number;
};

/**
 * Render one page to an image URL at about `cssWidth` CSS pixels wide
 * (times the device pixel ratio, capped so phones don't run out of memory).
 */
export function usePageRender(pdf: PdfDoc | null, pageNumber: number, cssWidth = 900) {
  const [render, setRender] = useState<(PageRender & { key: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = pdf ? `${pdf.fingerprints[0]}:${pageNumber}:${cssWidth}` : "";

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        const scale = Math.min((cssWidth * dpr) / base.width, 4000 / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Your browser blocked the canvas this tool needs.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        page.cleanup();
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
        canvas.width = 0;
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        setRender({ url, ptWidth: base.width, ptHeight: base.height, key });
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't draw this page.");
      }
    })();
    return () => {
      cancelled = true;
      if (url) {
        const u = url;
        setTimeout(() => URL.revokeObjectURL(u), 0);
      }
    };
  }, [pdf, pageNumber, cssWidth, key]);

  return { render: render && render.key === key ? render : null, error };
}

/** Display sizes (points) of every page, for "apply to all pages" previews. */
export function usePageSizes(pdf: PdfDoc | null) {
  const [sizes, setSizes] = useState<{ w: number; h: number }[] | null>(null);
  const [forPdf, setForPdf] = useState<PdfDoc | null>(null);
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      const out: { w: number; h: number }[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const p = await pdf.getPage(i);
        const v = p.getViewport({ scale: 1 });
        out.push({ w: v.width, h: v.height });
      }
      if (!cancelled) {
        setSizes(out);
        setForPdf(pdf);
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pdf]);
  return forPdf === pdf ? sizes : null;
}
