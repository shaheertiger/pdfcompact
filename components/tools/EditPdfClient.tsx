"use client";

import { useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Type, Highlighter, X, ChevronLeft, ChevronRight } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { downloadBlob, bytesToBlob, baseName } from "@/lib/download";
import { nextId } from "@/lib/id";
import { loadPdfjs, renderPageThumbnail } from "@/lib/pdfjs";

type TextAnnotation = {
  id: string;
  type: "text";
  xPct: number;
  yPct: number;
  text: string;
  fontSize: number;
};

type HighlightAnnotation = {
  id: string;
  type: "highlight";
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
};

type Annotation = TextAnnotation | HighlightAnnotation;

type Tool = "select" | "text" | "highlight";

export default function EditPdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Record<number, Annotation[]>>({});
  const [tool, setTool] = useState<Tool>("select");
  const [fontSize, setFontSize] = useState(16);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number; drawing: boolean } | null>(null);
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const loadPage = async (pageNumber: number) => {
    if (!pdfRef.current) return;
    setPageImage(await renderPageThumbnail(pdfRef.current, pageNumber, 900));
    setCurrentPage(pageNumber);
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    setError(null);
    setIsLoading(true);
    try {
      const bytes = await f.arrayBuffer();
      const pdfjs = await loadPdfjs();
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      pdfRef.current = pdf;
      setFile(f);
      setNumPages(pdf.numPages);
      setAnnotations({});
      await loadPage(1);
    } catch (e) {
      console.error(e);
      setError("Couldn't read this PDF. It may be corrupted or password protected.");
    } finally {
      setIsLoading(false);
    }
  };

  const getRelativePos = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  };

  const addAnnotation = (a: Annotation) => {
    setAnnotations((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] ?? []), a],
    }));
  };

  const updateAnnotation = (id: string, patch: Partial<Annotation>) => {
    setAnnotations((prev) => ({
      ...prev,
      [currentPage]: (prev[currentPage] ?? []).map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)),
    }));
  };

  const removeAnnotation = (id: string) => {
    setAnnotations((prev) => ({
      ...prev,
      [currentPage]: (prev[currentPage] ?? []).filter((a) => a.id !== id),
    }));
  };

  const onContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tool !== "text") return;
    const { x, y } = getRelativePos(e.clientX, e.clientY);
    addAnnotation({
      id: nextId("t"),
      type: "text",
      xPct: x,
      yPct: y,
      text: "Double-click to edit",
      fontSize,
    });
    setTool("select");
  };

  const onContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tool !== "highlight") return;
    const { x, y } = getRelativePos(e.clientX, e.clientY);
    dragState.current = { startX: x, startY: y, drawing: true };
    setDrawPreview({ x, y, w: 0, h: 0 });
  };

  const onContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState.current?.drawing) return;
    const { x, y } = getRelativePos(e.clientX, e.clientY);
    const { startX, startY } = dragState.current;
    setDrawPreview({
      x: Math.min(startX, x),
      y: Math.min(startY, y),
      w: Math.abs(x - startX),
      h: Math.abs(y - startY),
    });
  };

  const onContainerMouseUp = () => {
    if (!dragState.current?.drawing) return;
    dragState.current.drawing = false;
    if (drawPreview && drawPreview.w > 0.01 && drawPreview.h > 0.01) {
      addAnnotation({
        id: nextId("h"),
        type: "highlight",
        xPct: drawPreview.x,
        yPct: drawPreview.y,
        wPct: drawPreview.w,
        hPct: drawPreview.h,
      });
    }
    setDrawPreview(null);
    setTool("select");
  };

  const dragText = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== "select") return;
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const { x, y } = getRelativePos(ev.clientX, ev.clientY);
      updateAnnotation(id, { xPct: x, yPct: y });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleSave = async () => {
    if (!file) return;
    setIsSaving(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);

      for (const [pageNumStr, pageAnnotations] of Object.entries(annotations)) {
        const pageIndex = parseInt(pageNumStr, 10) - 1;
        const page = doc.getPage(pageIndex);
        const { width, height } = page.getSize();
        for (const a of pageAnnotations) {
          if (a.type === "text") {
            page.drawText(a.text, {
              x: a.xPct * width,
              y: height - a.yPct * height - a.fontSize,
              size: a.fontSize,
              font,
              color: rgb(0.1, 0.1, 0.1),
            });
          } else {
            page.drawRectangle({
              x: a.xPct * width,
              y: height - (a.yPct + a.hPct) * height,
              width: a.wPct * width,
              height: a.hPct * height,
              color: rgb(1, 0.92, 0.23),
              opacity: 0.4,
            });
          }
        }
      }

      const outBytes = await doc.save();
      downloadBlob(bytesToBlob(outBytes, "application/pdf"), `${baseName(file.name)}-edited.pdf`);
    } catch (e) {
      console.error(e);
      setError("Something went wrong while saving your edits.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentAnnotations = annotations[currentPage] ?? [];

  return (
    <div>
      {!file && (
        <Dropzone onFiles={onFiles} label="Drop a PDF here" hint="or click to browse" />
      )}

      {isLoading && <p className="mt-4 text-sm text-zinc-500">Loading PDF…</p>}

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {file && pageImage && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setTool(tool === "text" ? "select" : "text")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border ${
                tool === "text"
                  ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              <Type className="inline h-4 w-4 mr-1 -mt-0.5" aria-hidden="true" />
              Add text
            </button>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              className="rounded-full border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm"
            >
              <option value={12}>Small</option>
              <option value={16}>Medium</option>
              <option value={24}>Large</option>
            </select>
            <button
              type="button"
              onClick={() => setTool(tool === "highlight" ? "select" : "highlight")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border ${
                tool === "highlight"
                  ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              <Highlighter className="inline h-4 w-4 mr-1 -mt-0.5" aria-hidden="true" />
              Highlight
            </button>

            <div className="flex-1" />

            {numPages > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => loadPage(currentPage - 1)}
                  className="flex items-center disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Prev
                </button>
                <span>
                  Page {currentPage} / {numPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= numPages}
                  onClick={() => loadPage(currentPage + 1)}
                  className="flex items-center disabled:opacity-30"
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPageImage(null);
                setAnnotations({});
              }}
              className="text-sm text-zinc-500 hover:text-red-600"
            >
              Change file
            </button>
          </div>

          <div
            ref={containerRef}
            onClick={onContainerClick}
            onMouseDown={onContainerMouseDown}
            onMouseMove={onContainerMouseMove}
            onMouseUp={onContainerMouseUp}
            className="relative mx-auto select-none"
            style={{ cursor: tool === "select" ? "default" : "crosshair", maxWidth: 900 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pageImage} alt={`Page ${currentPage}`} className="w-full block rounded-lg border border-black/10 dark:border-white/10" draggable={false} />

            {drawPreview && (
              <div
                className="absolute bg-yellow-300/40 border border-yellow-500 pointer-events-none"
                style={{
                  left: `${drawPreview.x * 100}%`,
                  top: `${drawPreview.y * 100}%`,
                  width: `${drawPreview.w * 100}%`,
                  height: `${drawPreview.h * 100}%`,
                }}
              />
            )}

            {currentAnnotations.map((a) =>
              a.type === "highlight" ? (
                <div
                  key={a.id}
                  className="absolute bg-yellow-300/40 border border-yellow-500 group"
                  style={{
                    left: `${a.xPct * 100}%`,
                    top: `${a.yPct * 100}%`,
                    width: `${a.wPct * 100}%`,
                    height: `${a.hPct * 100}%`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => removeAnnotation(a.id)}
                    className="absolute -top-2 -right-2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div
                  key={a.id}
                  onPointerDown={(e) => dragText(a.id, e)}
                  className="absolute group cursor-move"
                  style={{ left: `${a.xPct * 100}%`, top: `${a.yPct * 100}%` }}
                >
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateAnnotation(a.id, { text: e.currentTarget.textContent ?? "" })}
                    style={{ fontSize: a.fontSize }}
                    className="text-zinc-900 bg-white/70 px-1 outline-none border border-transparent group-hover:border-red-400 whitespace-pre"
                  >
                    {a.text}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAnnotation(a.id)}
                    className="absolute -top-2 -right-2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              )
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="mt-6 rounded-full bg-red-600 text-white px-6 py-2.5 font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {isSaving ? "Saving…" : "Save edited PDF"}
          </button>
        </div>
      )}
    </div>
  );
}
