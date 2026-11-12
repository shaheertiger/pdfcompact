"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Crop as CropIcon,
  ImagePlus,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import {
  ActionButton,
  ErrorNote,
  Field,
  InfoNote,
  Progress,
  ResultPanel,
  SecondaryButton,
  Segmented,
  inputClass,
  type ResultFile,
} from "@/components/ui/kit";
import { formatBytes, pdfBlob } from "@/lib/download";
import { ocrLanguages } from "@/lib/vendor";
import type { OcrEngine, OcrLang } from "@/lib/ocr";
import {
  FULL_CROP,
  importImage,
  renderScan,
  rotateCropCW,
  toBlob,
  type Crop,
  type PageSize,
  type Rotation,
  type ScanFilter,
} from "@/lib/scan";

type ScanPage = {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  rotation: Rotation;
  crop: Crop;
  /** null = follow the filter chosen for all pages. */
  filter: ScanFilter | null;
  thumb?: string;
  thumbKey?: string;
};

const FILTERS: { value: ScanFilter; label: string; hint: string }[] = [
  { value: "document", label: "Document", hint: "White paper, dark text" },
  { value: "original", label: "Original", hint: "Colours as photographed" },
  { value: "bw", label: "Black & white", hint: "Smallest, crisp text" },
];
const FILTER_SHORT: Record<ScanFilter, string> = { document: "Document", original: "Original", bw: "B&W" };

let idCounter = 0;
const newId = () => `scan-${++idCounter}`;
const keyOf = (p: ScanPage, f: ScanFilter) => `${p.rotation}|${f}|${p.crop.x},${p.crop.y},${p.crop.w},${p.crop.h}`;

export default function ScanToPdfClient() {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [globalFilter, setGlobalFilter] = useState<ScanFilter>("document");
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [ocr, setOcr] = useState(false);
  const [ocrLang, setOcrLang] = useState<OcrLang>("eng");
  const [camera, setCamera] = useState(false);
  const [cropping, setCropping] = useState<{ id: string; preview: ImageBitmap } | null>(null);
  const [importing, setImporting] = useState(0);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<{ value: number; label: string } | null>(null);
  const [result, setResult] = useState<{ files: ResultFile[]; pages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previews = useRef(new Map<string, ImageBitmap>());
  const engineRef = useRef<OcrEngine | null>(null);
  const cancelRef = useRef(false);

  // Free decoded previews and thumbnail URLs when leaving the page.
  useEffect(() => {
    const map = previews.current;
    return () => {
      map.forEach((b) => b.close());
      map.clear();
    };
  }, []);

  const effFilter = (p: ScanPage) => p.filter ?? globalFilter;

  /** Re-render a page's thumbnail if its settings changed. */
  const refreshThumb = async (p: ScanPage, gf: ScanFilter) => {
    const f = p.filter ?? gf;
    const key = keyOf(p, f);
    if (p.thumbKey === key) return;
    const bmp = previews.current.get(p.id);
    if (!bmp) return;
    const c = renderScan(bmp, { rotation: p.rotation, crop: p.crop, filter: f }, 360);
    const blob = await toBlob(c, "image/jpeg", 0.8);
    const url = URL.createObjectURL(blob);
    setPages((prev) =>
      prev.map((q) => {
        if (q.id !== p.id) return q;
        if (keyOf(q, q.filter ?? gf) !== key) {
          URL.revokeObjectURL(url);
          return q;
        }
        if (q.thumb) URL.revokeObjectURL(q.thumb);
        return { ...q, thumb: url, thumbKey: key };
      })
    );
  };

  const updatePage = (id: string, fn: (p: ScanPage) => ScanPage) => {
    setResult(null);
    setPages((prev) => {
      const next = prev.map((p) => (p.id === id ? fn(p) : p));
      const changed = next.find((p) => p.id === id);
      if (changed) void refreshThumb(changed, globalFilter);
      return next;
    });
  };

  const addBlobs = async (blobs: Blob[], names: string[] = []) => {
    setError(null);
    setResult(null);
    const bad: string[] = [];
    setImporting((n) => n + blobs.length);
    for (let i = 0; i < blobs.length; i++) {
      try {
        const img = await importImage(blobs[i]);
        const page: ScanPage = {
          id: newId(),
          blob: img.blob,
          width: img.width,
          height: img.height,
          rotation: 0,
          crop: FULL_CROP,
          filter: null,
        };
        previews.current.set(page.id, img.preview);
        setPages((prev) => [...prev, page]);
        void refreshThumb(page, globalFilter);
      } catch {
        bad.push(names[i] || `image ${i + 1}`);
      } finally {
        setImporting((n) => n - 1);
      }
      await new Promise((r) => setTimeout(r));
    }
    if (bad.length) {
      setError(
        `Couldn't open ${bad.join(", ")}. If ${bad.length === 1 ? "it's" : "they're"} iPhone HEIC photos, use HEIC to PDF, or pick JPG/PNG images.`
      );
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    void addBlobs(list, list.map((f) => f.name));
  };

  const setGlobal = (f: ScanFilter) => {
    setGlobalFilter(f);
    setResult(null);
    pages.forEach((p) => {
      if (!p.filter) void refreshThumb(p, f);
    });
  };

  const move = (i: number, dir: -1 | 1) => {
    setResult(null);
    setPages((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const remove = (id: string) => {
    setResult(null);
    setPages((prev) => {
      const p = prev.find((q) => q.id === id);
      if (p?.thumb) URL.revokeObjectURL(p.thumb);
      return prev.filter((q) => q.id !== id);
    });
    previews.current.get(id)?.close();
    previews.current.delete(id);
  };

  const startOver = () => {
    pages.forEach((p) => p.thumb && URL.revokeObjectURL(p.thumb));
    previews.current.forEach((b) => b.close());
    previews.current.clear();
    setPages([]);
    setResult(null);
    setError(null);
  };

  const build = async () => {
    if (pages.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    cancelRef.current = false;
    const total = pages.length;
    try {
      const { PDFDocument } = await import("pdf-lib");
      const { layoutPage, WORKING_MAX } = await import("@/lib/scan");
      const doc = await PDFDocument.create();
      doc.setTitle("Scanned document");
      doc.setCreator("PDFCompact Scan to PDF");
      let engine: OcrEngine | null = null;
      if (ocr) {
        setProg({ value: 0, label: "Starting the OCR engine…" });
        const { createOcrEngine } = await import("@/lib/ocr");
        engine = await createOcrEngine([ocrLang]);
        engineRef.current = engine;
        if (cancelRef.current) engine.cancel();
      }
      const ocrMod = ocr ? await import("@/lib/ocr") : null;
      try {
        for (let i = 0; i < total; i++) {
          if (cancelRef.current) throw new Error("cancelled");
          const p = pages[i];
          setProg({ value: i / total, label: `Page ${i + 1} of ${total} · Preparing image` });
          await new Promise((r) => setTimeout(r));
          const bmp = await createImageBitmap(p.blob);
          const canvas = renderScan(bmp, { rotation: p.rotation, crop: p.crop, filter: effFilter(p) }, WORKING_MAX);
          bmp.close();
          let bytes: Uint8Array;
          let isPng = false;
          const jpg = await toBlob(canvas, "image/jpeg", 0.85);
          bytes = new Uint8Array(await jpg.arrayBuffer());
          if (effFilter(p) === "bw") {
            // Pure black-and-white pages are often smaller as PNG.
            const png = await toBlob(canvas, "image/png");
            if (png.size < jpg.size) {
              bytes = new Uint8Array(await png.arrayBuffer());
              isPng = true;
            }
          }
          const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          const L = layoutPage(canvas.width, canvas.height, pageSize);
          const pg = doc.addPage([L.pageW, L.pageH]);
          pg.drawImage(img, { x: L.x, y: L.y, width: L.w, height: L.h });
          if (engine && ocrMod) {
            setProg({ value: (i + 0.3) / total, label: `Page ${i + 1} of ${total} · Reading text (OCR)` });
            const dpi = canvas.width / (L.w / 72);
            const rec = await ocrMod.recognizeCanvas(engine, canvas, dpi);
            if (rec.text.trim()) await ocrMod.overlayTextLayer(doc, pg, rec.textPdf, { x: L.x, y: L.y, width: L.w, height: L.h });
          }
          canvas.width = canvas.height = 0;
        }
      } finally {
        await engine?.terminate();
        engineRef.current = null;
      }
      setProg({ value: 1, label: "Saving PDF…" });
      const out = await doc.save();
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      setResult({ files: [{ blob: pdfBlob(out), name: `scan-${stamp}.pdf` }], pages: total });
    } catch (e) {
      const cancelled = cancelRef.current || (e instanceof Error && e.name === "OcrCancelled");
      if (!cancelled) {
        console.error(e);
        setError(
          e instanceof Error && e.message.startsWith("Couldn't")
            ? e.message
            : "Couldn't build the PDF. Try fewer pages at a time, or close other tabs to free memory."
        );
      }
    } finally {
      setBusy(false);
      setProg(null);
    }
  };

  const cancel = () => {
    cancelRef.current = true;
    engineRef.current?.cancel();
  };

  const croppingPage = cropping ? pages.find((p) => p.id === cropping.id) : undefined;

  return (
    <div>
      {camera && (
        <CameraPanel
          count={pages.length}
          onCapture={(b) => addBlobs([b], ["camera photo"])}
          onClose={() => setCamera(false)}
          onError={(msg) => {
            setCamera(false);
            setError(msg);
          }}
        />
      )}

      {!camera && (
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setCamera(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white px-4 py-4 font-semibold hover:bg-red-700 min-h-12"
          >
            <Camera className="h-5 w-5" aria-hidden="true" /> Scan with camera
          </button>
          <label className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/20 dark:border-white/20 px-4 py-4 font-medium hover:border-red-400 cursor-pointer min-h-12">
            <Camera className="h-5 w-5 text-zinc-500" aria-hidden="true" /> Take a photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              data-testid="capture-input"
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/20 dark:border-white/20 px-4 py-4 font-medium hover:border-red-400 cursor-pointer min-h-12"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFiles(e.dataTransfer.files);
            }}
          >
            <ImagePlus className="h-5 w-5 text-zinc-500" aria-hidden="true" /> Choose images
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              data-testid="images-input"
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}
      {pages.length === 0 && !camera && (
        <InfoNote>
          Lay the page flat in good light, fill the frame, and hold the phone straight above it. You can crop, rotate
          and reorder pages after capturing.
        </InfoNote>
      )}

      {importing > 0 && <Progress value={0.5} label={`Adding ${importing} image${importing === 1 ? "" : "s"}…`} />}

      {pages.length > 0 && (
        <div className="mt-5 grid gap-5">
          <Segmented label="Clean-up filter (all pages)" value={globalFilter} onChange={setGlobal} options={FILTERS} />

          <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" aria-label="Scanned pages">
            {pages.map((p, i) => (
              <li
                key={p.id}
                className="rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/50 p-2 flex flex-col gap-2"
              >
                <div className="relative aspect-[3/4] flex items-center justify-center bg-zinc-200/60 dark:bg-zinc-900 rounded overflow-hidden">
                  {p.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumb} alt={`Page ${i + 1} preview`} className="max-h-full max-w-full object-contain shadow" />
                  ) : (
                    <span className="text-xs text-zinc-500">Loading…</span>
                  )}
                  <span className="absolute top-1 left-1 rounded bg-black/70 text-white text-xs px-1.5 py-0.5">{i + 1}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <IconBtn label={`Move page ${i + 1} earlier`} onClick={() => move(i, -1)} disabled={i === 0 || busy}>
                    <ArrowLeft className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    label={`Rotate page ${i + 1} clockwise`}
                    disabled={busy}
                    onClick={() =>
                      updatePage(p.id, (q) => ({ ...q, rotation: ((q.rotation + 90) % 360) as Rotation, crop: rotateCropCW(q.crop) }))
                    }
                  >
                    <RotateCw className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label={`Move page ${i + 1} later`} onClick={() => move(i, 1)} disabled={i === pages.length - 1 || busy}>
                    <ArrowRight className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    label={`Crop page ${i + 1}`}
                    onClick={() => {
                      const preview = previews.current.get(p.id);
                      if (preview) setCropping({ id: p.id, preview });
                    }}
                    disabled={busy}
                  >
                    <CropIcon className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label={`Delete page ${i + 1}`} onClick={() => remove(p.id)} disabled={busy} danger>
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
                  <select
                    aria-label={`Filter for page ${i + 1}`}
                    value={p.filter ?? ""}
                    disabled={busy}
                    onChange={(e) => updatePage(p.id, (q) => ({ ...q, filter: (e.target.value || null) as ScanFilter | null }))}
                    className="w-full h-10 rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-zinc-900 text-xs px-1 min-w-0"
                  >
                    <option value="">{FILTER_SHORT[globalFilter]} (all)</option>
                    {FILTERS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {FILTER_SHORT[f.value]}
                      </option>
                    ))}
                  </select>
              </li>
            ))}
          </ol>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Page size">
              <select
                className={`${inputClass} min-h-10`}
                value={pageSize}
                disabled={busy}
                onChange={(e) => {
                  setPageSize(e.target.value as PageSize);
                  setResult(null);
                }}
              >
                <option value="a4">A4 (210 × 297 mm)</option>
                <option value="letter">US Letter (8.5 × 11 in)</option>
                <option value="fit">Fit to image (no white border)</option>
              </select>
            </Field>
            <div className="grid gap-2">
              <label className="flex items-start gap-3 text-sm min-h-10 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 accent-red-600"
                  checked={ocr}
                  disabled={busy}
                  onChange={(e) => {
                    setOcr(e.target.checked);
                    setResult(null);
                  }}
                />
                <span>
                  <span className="font-medium">Make searchable (OCR)</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    Adds invisible text so you can search and copy. A few seconds per page.
                  </span>
                </span>
              </label>
              {ocr && (
                <select
                  aria-label="OCR language"
                  className={`${inputClass} min-h-10`}
                  value={ocrLang}
                  disabled={busy}
                  onChange={(e) => setOcrLang(e.target.value as OcrLang)}
                >
                  {ocrLanguages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {!result && (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <ActionButton onClick={build} busy={busy} disabled={importing > 0}>
                {busy ? "Building PDF…" : `Create PDF (${pages.length} page${pages.length === 1 ? "" : "s"})`}
              </ActionButton>
              {busy ? (
                <SecondaryButton onClick={cancel}>
                  <X className="h-4 w-4" aria-hidden="true" /> Cancel
                </SecondaryButton>
              ) : (
                <SecondaryButton onClick={startOver}>Clear all pages</SecondaryButton>
              )}
            </div>
          )}
          {prog && <Progress value={prog.value} label={prog.label} />}
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      {result && (
        <ResultPanel
          title="Your scan is ready"
          files={result.files}
          note={
            <>
              {result.pages} page{result.pages === 1 ? "" : "s"}, {formatBytes(result.files[0].blob.size)}
              {ocr ? ", searchable" : ""}. Change anything above and press Create PDF again to update it.
            </>
          }
          onReset={startOver}
          resetLabel="Start a new scan"
        />
      )}
      {result && (
        <div className="mt-3">
          <SecondaryButton onClick={() => setResult(null)}>Keep editing these pages</SecondaryButton>
        </div>
      )}

      {croppingPage && cropping && (
        <CropEditor
          page={croppingPage}
          preview={cropping.preview}
          onCancel={() => setCropping(null)}
          onApply={(crop) => {
            updatePage(croppingPage.id, (q) => ({ ...q, crop }));
            setCropping(null);
          }}
        />
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`h-10 inline-flex items-center justify-center rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-zinc-900 disabled:opacity-30 ${
        danger ? "hover:text-red-600 hover:border-red-300" : "hover:border-red-300"
      }`}
    >
      {children}
    </button>
  );
}

/** Live camera with a "Capture page" button. */
function CameraPanel({
  count,
  onCapture,
  onClose,
  onError,
}: {
  count: number;
  onCapture: (b: Blob) => void;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [captured, setCaptured] = useState(0);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      onErrorRef.current(
        "This browser can't open the camera from a web page. Use “Take a photo” instead; it opens your camera app."
      );
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: false,
      })
      .then(async (s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = s;
        await v.play().catch(() => {});
        setReady(true);
      })
      .catch((e: unknown) => {
        const name = e && typeof e === "object" && "name" in e ? String(e.name) : "";
        onErrorRef.current(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera access was blocked. Allow the camera for this site in your browser settings, or use “Take a photo” instead."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera was found. Use “Choose images” to add photos you already have."
              : "Couldn't start the camera. Use “Take a photo” instead; it works on every phone."
        );
      });
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(
      (b) => {
        if (b) onCapture(b);
        c.width = c.height = 0;
      },
      "image/jpeg",
      0.92
    );
    setCaptured((n) => n + 1);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black">
      <div className="relative">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label="Camera preview"
          className="w-full max-h-[60vh] object-contain bg-black"
        />
        {!ready && <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-300">Starting camera…</p>}
        {flash && <div className="absolute inset-0 bg-white/70" aria-hidden="true" />}
      </div>
      <div className="flex items-center gap-2 p-3 bg-zinc-900 text-white">
        <button
          type="button"
          onClick={capture}
          disabled={!ready}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 font-semibold hover:bg-red-700 disabled:opacity-40 min-h-12"
        >
          <Camera className="h-5 w-5" aria-hidden="true" /> Capture page
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/30 px-5 py-3 text-sm font-medium hover:border-white min-h-12"
        >
          Done{count > 0 ? ` (${count})` : ""}
        </button>
      </div>
      <p className="px-3 pb-3 bg-zinc-900 text-xs text-zinc-400" aria-live="polite">
        {captured === 0 ? "Fill the frame with the page, then tap Capture page." : `${captured} captured this session. Capture the next page or tap Done.`}
      </p>
    </div>
  );
}

/** Rectangular crop: drag the corners (or the whole box). */
function CropEditor({
  page,
  preview,
  onCancel,
  onApply,
}: {
  page: ScanPage;
  preview: ImageBitmap;
  onCancel: () => void;
  onApply: (c: Crop) => void;
}) {
  const [crop, setCrop] = useState<Crop>(page.crop);
  const [src] = useState(() => {
    const c = renderScan(preview, { rotation: page.rotation, crop: FULL_CROP, filter: "original" }, 900);
    return c.toDataURL("image/jpeg", 0.85);
  });
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "nw" | "ne" | "sw" | "se" | "move"; sx: number; sy: number; start: Crop } | null>(null);

  const onDown = (mode: "nw" | "ne" | "sw" | "se" | "move", e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: crop };
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.sx) / box.width;
    const dy = (e.clientY - d.sy) / box.height;
    const s = d.start;
    const MIN = 0.08;
    let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
    if (d.mode === "move") {
      const mx = Math.min(1 - s.w, Math.max(0, s.x + dx));
      const my = Math.min(1 - s.h, Math.max(0, s.y + dy));
      setCrop({ x: mx, y: my, w: s.w, h: s.h });
      return;
    }
    if (d.mode.includes("w")) x0 = Math.min(x1 - MIN, Math.max(0, s.x + dx));
    if (d.mode.includes("e")) x1 = Math.max(x0 + MIN, Math.min(1, s.x + s.w + dx));
    if (d.mode.includes("n")) y0 = Math.min(y1 - MIN, Math.max(0, s.y + dy));
    if (d.mode.includes("s")) y1 = Math.max(y0 + MIN, Math.min(1, s.y + s.h + dy));
    setCrop({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  };
  const onUp = () => {
    drag.current = null;
  };

  const pct = (v: number) => `${v * 100}%`;
  const handle = (mode: "nw" | "ne" | "sw" | "se", left: number, top: number) => (
    <div
      role="presentation"
      onPointerDown={(e) => onDown(mode, e)}
      className="absolute h-10 w-10 -ml-5 -mt-5 flex items-center justify-center touch-none cursor-pointer"
      style={{ left: pct(left), top: pct(top) }}
    >
      <span className="h-5 w-5 rounded-full bg-white border-2 border-red-600 shadow" />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crop page"
    >
      <div className="w-full max-w-lg flex flex-col gap-3">
        <p className="text-white text-sm">Drag the corners to the edges of the paper.</p>
        <div
          ref={boxRef}
          className="relative mx-auto select-none touch-none"
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Page to crop" className="block max-h-[65vh] max-w-full" draggable={false} />
          <div
            className="absolute border-2 border-red-500 touch-none cursor-move"
            style={{
              left: pct(crop.x),
              top: pct(crop.y),
              width: pct(crop.w),
              height: pct(crop.h),
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            }}
            onPointerDown={(e) => onDown("move", e)}
          />
          {handle("nw", crop.x, crop.y)}
          {handle("ne", crop.x + crop.w, crop.y)}
          {handle("sw", crop.x, crop.y + crop.h)}
          {handle("se", crop.x + crop.w, crop.y + crop.h)}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={() => setCrop(FULL_CROP)}
            className="rounded-full border border-white/40 text-white px-4 py-2 text-sm min-h-10"
          >
            Reset
          </button>
          <button type="button" onClick={onCancel} className="rounded-full border border-white/40 text-white px-4 py-2 text-sm min-h-10">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(crop)}
            className="rounded-full bg-red-600 text-white px-5 py-2 text-sm font-semibold min-h-10"
          >
            Apply crop
          </button>
        </div>
      </div>
    </div>
  );
}
