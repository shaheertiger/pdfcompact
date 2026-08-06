"use client";

import { useRef, useState } from "react";
import { Caveat } from "next/font/google";
import { PDFDocument } from "pdf-lib";
import Dropzone from "@/components/Dropzone";
import { downloadBlob, bytesToBlob, baseName } from "@/lib/download";
import { nextId } from "@/lib/id";
import { loadPdfjs, renderPageThumbnail } from "@/lib/pdfjs";

const caveat = Caveat({ subsets: ["latin"], weight: "600" });

type Placement = {
  id: string;
  xPct: number;
  yPct: number;
  wPct: number;
};

export default function SignClient() {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Record<number, Placement[]>>({});
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signatureAspect, setSignatureAspect] = useState(3);
  const [signatureMode, setSignatureMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("");
  const [placing, setPlacing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pdfRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

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
      setPlacements({});
      await loadPage(1);
    } catch (e) {
      console.error(e);
      setError("Couldn't read this PDF. It may be corrupted or password protected.");
    } finally {
      setIsLoading(false);
    }
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const endDraw = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const useDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSignatureDataUrl(canvas.toDataURL("image/png"));
    setSignatureAspect(canvas.width / canvas.height);
  };

  const useTypedSignature = () => {
    if (!typedName.trim()) return;
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111827";
    ctx.font = `90px ${caveat.style.fontFamily}, cursive`;
    ctx.textBaseline = "middle";
    ctx.fillText(typedName, 20, canvas.height / 2);
    setSignatureDataUrl(canvas.toDataURL("image/png"));
    setSignatureAspect(canvas.width / canvas.height);
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

  const onPageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!placing || !signatureDataUrl) return;
    const { x, y } = getRelativePos(e.clientX, e.clientY);
    const wPct = 0.25;
    setPlacements((prev) => ({
      ...prev,
      [currentPage]: [
        ...(prev[currentPage] ?? []),
        { id: nextId("s"), xPct: x - wPct / 2, yPct: y - wPct / signatureAspect / 2, wPct },
      ],
    }));
    setPlacing(false);
  };

  const dragPlacement = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const { x, y } = getRelativePos(ev.clientX, ev.clientY);
      setPlacements((prev) => ({
        ...prev,
        [currentPage]: (prev[currentPage] ?? []).map((p) =>
          p.id === id ? { ...p, xPct: x - p.wPct / 2, yPct: y - p.wPct / signatureAspect / 2 } : p
        ),
      }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const resizePlacement = (id: string, delta: number) => {
    setPlacements((prev) => ({
      ...prev,
      [currentPage]: (prev[currentPage] ?? []).map((p) =>
        p.id === id ? { ...p, wPct: Math.min(0.8, Math.max(0.08, p.wPct + delta)) } : p
      ),
    }));
  };

  const removePlacement = (id: string) => {
    setPlacements((prev) => ({
      ...prev,
      [currentPage]: (prev[currentPage] ?? []).filter((p) => p.id !== id),
    }));
  };

  const handleSave = async () => {
    if (!file || !signatureDataUrl) return;
    setIsSaving(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pngBytes = await (await fetch(signatureDataUrl)).arrayBuffer();
      const image = await doc.embedPng(pngBytes);

      for (const [pageNumStr, pagePlacements] of Object.entries(placements)) {
        const pageIndex = parseInt(pageNumStr, 10) - 1;
        const page = doc.getPage(pageIndex);
        const { width, height } = page.getSize();
        for (const p of pagePlacements) {
          const w = p.wPct * width;
          const h = w / signatureAspect;
          page.drawImage(image, {
            x: p.xPct * width,
            y: height - p.yPct * height - h,
            width: w,
            height: h,
          });
        }
      }

      const outBytes = await doc.save();
      downloadBlob(bytesToBlob(outBytes, "application/pdf"), `${baseName(file.name)}-signed.pdf`);
    } catch (e) {
      console.error(e);
      setError("Something went wrong while saving your signed PDF.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentPlacements = placements[currentPage] ?? [];

  return (
    <div>
      {!file && <Dropzone onFiles={onFiles} label="Drop a PDF here" hint="or click to browse" />}

      {isLoading && <p className="mt-4 text-sm text-zinc-500">Loading PDF…</p>}

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {file && pageImage && (
        <div>
          {!signatureDataUrl && (
            <div className="mb-6 rounded-xl border border-black/10 dark:border-white/10 p-4">
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setSignatureMode("draw")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium border ${
                    signatureMode === "draw"
                      ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                      : "border-black/10 dark:border-white/10"
                  }`}
                >
                  Draw
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMode("type")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium border ${
                    signatureMode === "type"
                      ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                      : "border-black/10 dark:border-white/10"
                  }`}
                >
                  Type
                </button>
              </div>

              {signatureMode === "draw" ? (
                <div>
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={160}
                    onPointerDown={startDraw}
                    onPointerMove={draw}
                    onPointerUp={endDraw}
                    className="w-full max-w-md rounded-lg border border-dashed border-black/20 dark:border-white/20 bg-white touch-none"
                    style={{ height: 160 }}
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={clearCanvas} className="text-sm text-zinc-500 hover:text-red-600">
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={useDrawnSignature}
                      className="rounded-full bg-red-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-red-700"
                    >
                      Use this signature
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Type your name"
                    className={`${caveat.className} w-full max-w-md rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-4 py-3 text-3xl`}
                  />
                  <button
                    type="button"
                    onClick={useTypedSignature}
                    disabled={!typedName.trim()}
                    className="mt-2 rounded-full bg-red-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-40"
                  >
                    Use this signature
                  </button>
                </div>
              )}
            </div>
          )}

          {signatureDataUrl && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signatureDataUrl} alt="Your signature" className="h-10 border border-black/10 dark:border-white/10 rounded bg-white" />
              <button
                type="button"
                onClick={() => setPlacing(true)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium border ${
                  placing
                    ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
                {placing ? "Click the page to place…" : "Place signature"}
              </button>
              <button
                type="button"
                onClick={() => setSignatureDataUrl(null)}
                className="text-sm text-zinc-500 hover:text-red-600"
              >
                Change signature
              </button>

              {numPages > 1 && (
                <div className="ml-auto flex items-center gap-2 text-sm">
                  <button type="button" disabled={currentPage <= 1} onClick={() => loadPage(currentPage - 1)} className="disabled:opacity-30">
                    ← Prev
                  </button>
                  <span>
                    Page {currentPage} / {numPages}
                  </span>
                  <button type="button" disabled={currentPage >= numPages} onClick={() => loadPage(currentPage + 1)} className="disabled:opacity-30">
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}

          <div
            ref={containerRef}
            onClick={onPageClick}
            className="relative mx-auto select-none"
            style={{ cursor: placing ? "crosshair" : "default", maxWidth: 900 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pageImage} alt={`Page ${currentPage}`} className="w-full block rounded-lg border border-black/10 dark:border-white/10" draggable={false} />

            {currentPlacements.map((p) => (
              <div
                key={p.id}
                onPointerDown={(e) => dragPlacement(p.id, e)}
                className="absolute group cursor-move"
                style={{ left: `${p.xPct * 100}%`, top: `${p.yPct * 100}%`, width: `${p.wPct * 100}%` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signatureDataUrl ?? ""} alt="Signature" className="w-full pointer-events-none" />
                <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1">
                  <button
                    type="button"
                    onClick={() => resizePlacement(p.id, -0.03)}
                    className="h-5 w-5 flex items-center justify-center rounded-full bg-black/70 text-white text-xs"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => resizePlacement(p.id, 0.03)}
                    className="h-5 w-5 flex items-center justify-center rounded-full bg-black/70 text-white text-xs"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removePlacement(p.id)}
                    className="h-5 w-5 flex items-center justify-center rounded-full bg-black/70 text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !signatureDataUrl || Object.values(placements).every((p) => p.length === 0)}
            className="mt-6 rounded-full bg-red-600 text-white px-6 py-2.5 font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {isSaving ? "Saving…" : "Save signed PDF"}
          </button>
        </div>
      )}
    </div>
  );
}
