"use client";

import { useRef, useState } from "react";
import { Caveat, Dancing_Script, Great_Vibes } from "next/font/google";
import { CalendarDays, PenLine, Plus, Type, Undo2, Upload } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, Field, FileBar, InfoNote, Progress, ResultPanel, SecondaryButton, inputClass } from "@/components/ui/kit";
import { formatBytes } from "@/lib/download";
import { nextId } from "@/lib/id";
import type { PlacedImage, PlacedText } from "@/lib/placements";
import { canvasToSignature, imageFileToCanvas, removeLightBackground, renderTypedSignature, trimCanvas, type SignatureImage } from "@/lib/signature";
import ColorPicker from "./stamp/ColorPicker";
import { PageNav } from "./stamp/PageStage";
import SignaturePad, { type SignaturePadHandle } from "./stamp/SignaturePad";
import TargetPicker from "./stamp/TargetPicker";
import { rasterizeUnsupportedText, useStandardFonts } from "./stamp/placed";
import { PlacementStage, usePlacementEditor } from "./stamp/usePlacementEditor";

const caveat = Caveat({ subsets: ["latin"], weight: "600", display: "swap" });
const dancing = Dancing_Script({ subsets: ["latin"], weight: "600", display: "swap" });
const vibes = Great_Vibes({ subsets: ["latin"], weight: "400", display: "swap" });
const scripts = [
  { id: "caveat", label: "Casual", family: caveat.style.fontFamily, className: caveat.className },
  { id: "dancing", label: "Classic", family: dancing.style.fontFamily, className: dancing.className },
  { id: "vibes", label: "Formal", family: vibes.style.fontFamily, className: vibes.className },
];

const inkColors = [
  { value: "#111827", label: "Black ink" },
  { value: "#1e3a8a", label: "Blue ink" },
];

function formatDate(d: Date, f: string) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mon = d.toLocaleString("en-GB", { month: "short" });
  if (f === "us") return `${mm}/${dd}/${yyyy}`;
  if (f === "eu") return `${dd}/${mm}/${yyyy}`;
  if (f === "iso") return `${yyyy}-${mm}-${dd}`;
  return `${d.getDate()} ${mon} ${yyyy}`;
}

type Mode = "draw" | "type" | "upload";

export default function SignPdfClient() {
  const ed = usePlacementEditor();
  const fonts = useStandardFonts();
  const [marks, setMarks] = useState<Record<string, SignatureImage>>({});
  const [mode, setMode] = useState<Mode>("draw");
  const [creating, setCreating] = useState(true);
  const [ink, setInk] = useState("#111827");
  const [thickness, setThickness] = useState(2.6);
  const [padEmpty, setPadEmpty] = useState(true);
  const [typed, setTyped] = useState("");
  const [script, setScript] = useState(scripts[0].id);
  const [upload, setUpload] = useState<HTMLCanvasElement | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [sigError, setSigError] = useState<string | null>(null);
  const [dateFmt, setDateFmt] = useState("long");
  const padRef = useRef<SignaturePadHandle | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  // On phones the page sits below the signature panel: bring it into view after placing.
  const showStage = () => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setTimeout(() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
  };

  const imageUrls = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v.url]));

  const placeMark = (key: string, sig: { width: number; height: number }) => {
    const r = ed.render;
    if (!r) return;
    const aspect = sig.width / sig.height;
    let fw = Math.min(0.3, (0.09 * r.ptHeight * aspect) / r.ptWidth);
    fw = Math.max(fw, 0.08);
    const item: PlacedImage = {
      kind: "image",
      id: nextId("sig"),
      imgKey: key,
      aspect,
      fx: 0.5 - fw / 2,
      fy: 0.62,
      fw,
      opacity: 1,
      target: { mode: "one", page: ed.page - 1 },
    };
    ed.add(item);
    showStage();
  };

  const buildPreviewUpload = (src: HTMLCanvasElement, strip: boolean) => {
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    c.getContext("2d")?.drawImage(src, 0, 0);
    if (strip) removeLightBackground(c);
    return c;
  };

  const createSignature = async () => {
    setSigError(null);
    let canvas: HTMLCanvasElement | null = null;
    if (mode === "draw") {
      const raw = padRef.current?.toCanvas(3) ?? null;
      canvas = raw ? trimCanvas(raw, 6) : null;
      if (!canvas) return setSigError("Draw your signature in the box first.");
    } else if (mode === "type") {
      const fam = scripts.find((s) => s.id === script)?.family ?? "cursive";
      if (!typed.trim()) return setSigError("Type your name first.");
      canvas = await renderTypedSignature(typed.trim(), fam, ink, 120);
      if (!canvas) return setSigError("Couldn't draw that text.");
    } else {
      if (!upload) return setSigError("Choose a photo or scan of your signature first.");
      const c = buildPreviewUpload(upload, removeBg);
      canvas = trimCanvas(c, 4) ?? c;
    }
    const sig = await canvasToSignature(canvas);
    const key = nextId("mark");
    setMarks((m) => ({ ...m, [key]: sig }));
    placeMark(key, sig);
    setCreating(false);
    padRef.current?.clear();
  };

  const onUpload = async (files: File[]) => {
    setSigError(null);
    try {
      const c = await imageFileToCanvas(files[0], 1600);
      setUpload(c);
      setUploadPreview(buildPreviewUpload(c, removeBg).toDataURL("image/png"));
    } catch (e) {
      setSigError(e instanceof Error ? e.message : String(e));
    }
  };

  const addDate = () => {
    const r = ed.render;
    if (!r) return;
    const item: PlacedText = {
      kind: "text",
      id: nextId("date"),
      text: formatDate(new Date(), dateFmt),
      fsize: 11 / r.ptWidth,
      color: "#111827",
      font: "helvetica",
      fx: 0.55,
      fy: 0.75,
      fw: 0,
      opacity: 1,
      target: { mode: "one", page: ed.page - 1 },
    };
    ed.add(item);
    showStage();
  };

  const reset = () => {
    for (const v of Object.values(marks)) URL.revokeObjectURL(v.url);
    setMarks({});
    setCreating(true);
    ed.reset();
  };

  if (!ed.file) {
    return (
      <div>
        <Dropzone onFiles={ed.onFiles} label="Drop the PDF you need to sign" />
        <ErrorNote>{ed.loadError}</ErrorNote>
      </div>
    );
  }

  const sel = ed.selected;
  const count = ed.items.length;
  const tab = (m: Mode, label: string, Icon: typeof PenLine) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => {
        setMode(m);
        setSigError(null);
      }}
      className={`flex-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-full text-sm font-medium ${
        mode === m ? "bg-white dark:bg-zinc-700 shadow text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-300"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <div>
      <FileBar name={ed.file.name} detail={`${ed.numPages || "…"} pages · ${formatBytes(ed.file.size)}`} onReset={reset} />
      <ErrorNote>{ed.pdfError}</ErrorNote>

      {ed.result ? (
        <ResultPanel
          title="Signed"
          files={[ed.result]}
          note={
            <>
              Added {count} item{count === 1 ? "" : "s"}. This is a visual signature (an image on the page), not a certificate-based
              digital signature. Open the file and check each page before you send it.
            </>
          }
          onReset={() => ed.setResult(null)}
          resetLabel="Keep editing"
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start">
          <div ref={stageRef} className="order-2 md:order-1 scroll-mt-4">
            {Object.keys(marks).length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {Object.entries(marks).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => placeMark(k, v)}
                    aria-label={`Place this signature on page ${ed.page} again`}
                    title="Place again on this page"
                    className="h-10 rounded-lg border border-black/10 dark:border-white/15 bg-white px-1.5 hover:border-red-400 flex items-center gap-1"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.url} alt="" className="h-7 max-w-24 object-contain" />
                    <Plus className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                  </button>
                ))}
                {ed.canUndo && (
                  <button type="button" onClick={ed.undo} className="ml-auto inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm text-zinc-600 dark:text-zinc-300 hover:text-red-600">
                    <Undo2 className="h-4 w-4" aria-hidden="true" /> Undo
                  </button>
                )}
              </div>
            )}
            <PlacementStage ed={ed} imageUrls={imageUrls} fonts={fonts} labelFor={(p) => (p.kind === "image" ? "Signature" : p.kind === "text" ? `Date ${p.text}` : undefined)} />
            <PageNav page={ed.page} count={ed.numPages} onChange={ed.setPage} />
          </div>

          <div className="order-1 md:order-2 grid gap-5">
            {creating ? (
              <div className="rounded-xl border border-black/10 dark:border-white/15 p-3 sm:p-4 grid gap-3">
                <div className="flex gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 p-1" role="tablist" aria-label="How to make your signature">
                  {tab("draw", "Draw", PenLine)}
                  {tab("type", "Type", Type)}
                  {tab("upload", "Upload", Upload)}
                </div>

                {mode === "draw" && (
                  <>
                    <SignaturePad ref={padRef} color={ink} thickness={thickness} onChange={setPadEmpty} />
                    <div className="flex flex-wrap items-center gap-2">
                      <ColorPicker value={ink} onChange={setInk} swatches={inkColors} label="Ink" />
                      <Field label="Pen">
                        <select value={thickness} onChange={(e) => setThickness(parseFloat(e.target.value))} className={`${inputClass} h-10`}>
                          <option value={1.8}>Fine</option>
                          <option value={2.6}>Medium</option>
                          <option value={3.8}>Bold</option>
                        </select>
                      </Field>
                      <SecondaryButton onClick={() => padRef.current?.clear()} disabled={padEmpty}>
                        Clear
                      </SecondaryButton>
                    </div>
                  </>
                )}

                {mode === "type" && (
                  <>
                    <Field label="Your name">
                      <input value={typed} maxLength={60} onChange={(e) => setTyped(e.target.value)} placeholder="Jane Doe" autoComplete="name" className={`${inputClass} h-11`} />
                    </Field>
                    <div className="grid gap-2" role="radiogroup" aria-label="Signature style">
                      {scripts.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={script === s.id}
                          onClick={() => setScript(s.id)}
                          className={`flex items-center justify-between rounded-lg border px-3 min-h-14 text-left ${
                            script === s.id ? "border-red-500 bg-red-50/60 dark:bg-red-500/10" : "border-black/10 dark:border-white/15 hover:border-red-300"
                          }`}
                        >
                          <span className={`${s.className} text-3xl truncate`} style={{ color: ink }}>
                            {typed.trim() || "Jane Doe"}
                          </span>
                          <span className="text-xs text-zinc-500 ml-2 shrink-0">{s.label}</span>
                        </button>
                      ))}
                    </div>
                    <ColorPicker value={ink} onChange={setInk} swatches={inkColors} label="Ink" />
                  </>
                )}

                {mode === "upload" && (
                  <>
                    {uploadPreview ? (
                      <div className="rounded-lg border border-black/10 dark:border-white/15 bg-[repeating-conic-gradient(#e4e4e7_0_25%,white_0_50%)] bg-[length:14px_14px] p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={uploadPreview} alt="Your uploaded signature" className="max-h-36 mx-auto object-contain" />
                      </div>
                    ) : (
                      <Dropzone onFiles={onUpload} accept="image/png,image/jpeg,image/webp" label="Photo or scan of your signature" hint="Sign white paper in dark ink, photograph it close up" />
                    )}
                    <label className="flex items-center gap-3 text-sm min-h-10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={removeBg}
                        onChange={(e) => {
                          setRemoveBg(e.target.checked);
                          if (upload) setUploadPreview(buildPreviewUpload(upload, e.target.checked).toDataURL("image/png"));
                        }}
                        className="h-5 w-5 accent-red-600"
                      />
                      Remove the white background
                    </label>
                    {uploadPreview && (
                      <SecondaryButton
                        onClick={() => {
                          setUpload(null);
                          setUploadPreview(null);
                        }}
                      >
                        Choose another image
                      </SecondaryButton>
                    )}
                  </>
                )}

                <ErrorNote>{sigError}</ErrorNote>
                <ActionButton onClick={createSignature} disabled={!ed.render}>
                  Place on page {ed.page}
                </ActionButton>
                {Object.keys(marks).length > 0 && (
                  <button type="button" onClick={() => setCreating(false)} className="text-sm text-zinc-500 hover:text-red-600 h-10">
                    Cancel
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> New signature or initials
                </SecondaryButton>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-2">
              <Field label="Date format">
                <select value={dateFmt} onChange={(e) => setDateFmt(e.target.value)} className={`${inputClass} h-10`}>
                  <option value="long">{formatDate(new Date(), "long")}</option>
                  <option value="us">{formatDate(new Date(), "us")} (US)</option>
                  <option value="eu">{formatDate(new Date(), "eu")} (UK, India, EU)</option>
                  <option value="iso">{formatDate(new Date(), "iso")} (ISO)</option>
                </select>
              </Field>
              <SecondaryButton onClick={addDate} disabled={!ed.render}>
                <CalendarDays className="h-4 w-4" aria-hidden="true" /> Add date
              </SecondaryButton>
            </div>

            {sel && (
              <div className="rounded-xl border border-black/10 dark:border-white/15 p-4 grid gap-4">
                <p className="text-sm font-medium">{sel.kind === "text" ? "Selected date" : "Selected signature"}</p>
                {sel.kind === "text" && (
                  <>
                    <Field label="Text">
                      <input
                        value={sel.text}
                        maxLength={80}
                        onFocus={ed.snapshot}
                        onChange={(e) => ed.update(sel.id, { text: e.target.value })}
                        className={`${inputClass} h-11`}
                      />
                    </Field>
                    <ColorPicker value={sel.color} onChange={(c) => ed.update(sel.id, { color: c })} swatches={inkColors} label="Color" />
                  </>
                )}
                <TargetPicker
                  key={sel.id}
                  target={sel.target}
                  current={ed.page - 1}
                  count={ed.numPages}
                  onChange={(t) => {
                    ed.snapshot();
                    ed.update(sel.id, { target: t });
                  }}
                />
                <SecondaryButton onClick={() => ed.remove(sel.id)}>Remove</SecondaryButton>
              </div>
            )}

            {count > 0 && !sel && (
              <InfoNote>Drag to move. Drag the red corner dot to resize. Tap an item to put it on other pages (for initials on every page).</InfoNote>
            )}

            <ActionButton
              onClick={() =>
                ed.save(marks, "signed", (items) =>
                  rasterizeUnsupportedText(items, fonts, ed.render ? ed.render.ptWidth / ed.render.ptHeight : 0.75)
                )
              }
              busy={ed.busy}
              disabled={!count || !ed.pdf}
            >
              Save signed PDF
            </ActionButton>
            {ed.busy && <Progress value={ed.progress} label="Saving…" />}
            <ErrorNote>{ed.error}</ErrorNote>
          </div>
        </div>
      )}
    </div>
  );
}
