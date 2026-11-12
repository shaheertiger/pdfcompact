"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Eraser, Highlighter, MousePointer2, Pen, Square, Type, Undo2 } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, Field, FileBar, InfoNote, Progress, ResultPanel, SecondaryButton, inputClass } from "@/components/ui/kit";
import { formatBytes } from "@/lib/download";
import { nextId } from "@/lib/id";
import { textFonts, type Placed, type PlacedInk, type PlacedRect, type PlacedText, type TextFont } from "@/lib/placements";
import ColorPicker from "./stamp/ColorPicker";
import { PageNav, type StagePoint } from "./stamp/PageStage";
import { rasterizeUnsupportedText, useStandardFonts } from "./stamp/placed";
import { PlacementStage, usePlacementEditor } from "./stamp/usePlacementEditor";

type Tool = "select" | "text" | "highlight" | "whiteout" | "box" | "pen";

const tools: { id: Tool; label: string; Icon: typeof Type; hint: string }[] = [
  { id: "select", label: "Select", Icon: MousePointer2, hint: "Tap an item to change, move or delete it." },
  { id: "text", label: "Text", Icon: Type, hint: "Tap the page where the text should start." },
  { id: "highlight", label: "Highlight", Icon: Highlighter, hint: "Drag across the words to highlight." },
  { id: "whiteout", label: "White-out", Icon: Eraser, hint: "Drag over something to cover it with white. Then add new text on top." },
  { id: "box", label: "Box", Icon: Square, hint: "Drag to draw a rectangle outline." },
  { id: "pen", label: "Pen", Icon: Pen, hint: "Draw freehand. Tap Select when you're done." },
];

const highlightColors = [
  { value: "#fde047", label: "Yellow" },
  { value: "#86efac", label: "Green" },
  { value: "#f9a8d4", label: "Pink" },
  { value: "#7dd3fc", label: "Blue" },
];

export default function EditPdfClient() {
  const ed = usePlacementEditor();
  const fonts = useStandardFonts();
  const [tool, setTool] = useState<Tool>("select");
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [inkDraft, setInkDraft] = useState<StagePoint[] | null>(null);
  const [textFont, setTextFont] = useState<TextFont>("helvetica");
  const [textSize, setTextSize] = useState(12);
  const [textColor, setTextColor] = useState("#111827");
  const [penColor, setPenColor] = useState("#1d4ed8");
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const target = () => ({ mode: "one" as const, page: ed.page - 1 });

  const onDown = (p: StagePoint, W: number, H: number) => {
    if (tool === "text") {
      const item: PlacedText = {
        kind: "text",
        id: nextId("txt"),
        text: "",
        fsize: textSize / W,
        color: textColor,
        font: textFont,
        fx: p.x / W,
        fy: Math.max(0, p.y - textSize * 0.6) / H,
        fw: 0,
        opacity: 1,
        target: target(),
      };
      ed.add(item);
      setTool("select");
      setTimeout(() => textRef.current?.focus(), 50);
    } else if (tool === "pen") {
      setInkDraft([p]);
    } else if (tool !== "select") {
      setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    }
  };

  const onMove = (p: StagePoint) => {
    if (tool === "pen") setInkDraft((d) => (d ? [...d, p] : d));
    else setDraft((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
  };

  const onUp = (p: StagePoint, W: number, H: number) => {
    if (tool === "pen" && inkDraft) {
      const pts = [...inkDraft, p];
      setInkDraft(null);
      const xs = pts.map((q) => q.x);
      const ys = pts.map((q) => q.y);
      const pad = 2;
      const x0 = Math.min(...xs) - pad;
      const y0 = Math.min(...ys) - pad;
      const w = Math.max(4, Math.max(...xs) - x0 + pad);
      const h = Math.max(4, Math.max(...ys) - y0 + pad);
      const item: PlacedInk = {
        kind: "ink",
        id: nextId("ink"),
        fx: x0 / W,
        fy: y0 / H,
        fw: w / W,
        fh: h / H,
        strokes: [pts.map((q) => ({ x: (q.x - x0) / w, y: (q.y - y0) / h }))],
        color: penColor,
        fwidth: 1.6 / W,
        opacity: 1,
        target: target(),
      };
      ed.add(item);
      ed.setSelectedId(null);
      return;
    }
    if (!draft) return;
    const d = { ...draft, x1: p.x, y1: p.y };
    setDraft(null);
    let x = Math.min(d.x0, d.x1);
    let y = Math.min(d.y0, d.y1);
    let w = Math.abs(d.x1 - d.x0);
    let h = Math.abs(d.y1 - d.y0);
    if (w < 4 || h < 4) {
      // A tap: drop a default-sized shape there.
      w = tool === "highlight" ? 120 : 100;
      h = tool === "highlight" ? 14 : 40;
      x = Math.min(W - w, Math.max(0, d.x0 - w / 2));
      y = Math.min(H - h, Math.max(0, d.y0 - h / 2));
    }
    const style = tool as PlacedRect["style"];
    const item: PlacedRect = {
      kind: "rect",
      id: nextId("rect"),
      style,
      fx: x / W,
      fy: y / H,
      fw: w / W,
      fh: h / H,
      color: style === "highlight" ? "#fde047" : style === "whiteout" ? "#ffffff" : "#dc2626",
      opacity: style === "highlight" ? 0.5 : 1,
      target: target(),
    };
    ed.add(item);
    setTool("select");
  };

  if (!ed.file) {
    return (
      <div>
        <Dropzone onFiles={ed.onFiles} label="Drop the PDF you want to edit" />
        <ErrorNote>{ed.loadError}</ErrorNote>
      </div>
    );
  }

  const sel = ed.selected;
  const count = ed.items.length;
  const W = ed.render?.ptWidth ?? 612;
  const active = tools.find((t) => t.id === tool)!;

  const overlay = (k: number) => {
    if (draft) {
      const x = Math.min(draft.x0, draft.x1);
      const y = Math.min(draft.y0, draft.y1);
      return (
        <div
          className="absolute pointer-events-none border border-dashed border-red-500"
          style={{
            left: x * k,
            top: y * k,
            width: Math.abs(draft.x1 - draft.x0) * k,
            height: Math.abs(draft.y1 - draft.y0) * k,
            background: tool === "highlight" ? "rgba(253,224,71,.5)" : tool === "whiteout" ? "#fff" : "transparent",
          }}
        />
      );
    }
    if (inkDraft && ed.render) {
      return (
        <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox={`0 0 ${ed.render.ptWidth} ${ed.render.ptHeight}`}>
          <polyline points={inkDraft.map((q) => `${q.x},${q.y}`).join(" ")} fill="none" stroke={penColor} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return null;
  };

  const save = () =>
    ed.save({}, "edited", async (items: Placed[]) => {
      // Empty text boxes are dropped; text outside the standard fonts becomes an image.
      const kept = items.filter((i) => i.kind !== "text" || i.text.trim());
      return rasterizeUnsupportedText(kept, fonts, ed.render ? ed.render.ptWidth / ed.render.ptHeight : 0.75);
    });

  return (
    <div>
      <FileBar name={ed.file.name} detail={`${ed.numPages || "…"} pages · ${formatBytes(ed.file.size)}`} onReset={ed.reset} />
      <ErrorNote>{ed.pdfError}</ErrorNote>

      {ed.result ? (
        <ResultPanel
          files={[ed.result]}
          originalSize={ed.file.size}
          note={<>Saved {count} edit{count === 1 ? "" : "s"}. Your additions are part of the page now; the original file is untouched.</>}
          onReset={() => ed.setResult(null)}
          resetLabel="Keep editing"
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Edit tools">
              {tools.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tool === t.id}
                  onClick={() => {
                    setTool(t.id);
                    ed.setSelectedId(null);
                  }}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${
                    tool === t.id
                      ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300"
                      : "border-black/10 dark:border-white/15 hover:border-red-300"
                  }`}
                >
                  <t.Icon className="h-4 w-4" aria-hidden="true" />
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-500" aria-live="polite">
                {active.hint}
              </p>
              <button
                type="button"
                onClick={ed.undo}
                disabled={!ed.canUndo}
                className="shrink-0 inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm text-zinc-600 dark:text-zinc-300 hover:text-red-600 disabled:opacity-30"
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" /> Undo
              </button>
            </div>
            <PlacementStage
              ed={ed}
              imageUrls={{}}
              fonts={fonts}
              captureStage={tool !== "select"}
              onStageDown={onDown}
              onStageMove={(p) => onMove(p)}
              onStageUp={onUp}
              overlay={overlay}
              labelFor={(p) =>
                p.kind === "text" ? `Text ${p.text.slice(0, 30) || "(empty)"}` : p.kind === "rect" ? (p.style === "whiteout" ? "White-out" : p.style === "highlight" ? "Highlight" : "Box") : undefined
              }
            />
            <PageNav page={ed.page} count={ed.numPages} onChange={ed.setPage} />
          </div>

          <div className="grid gap-5">
            {sel?.kind === "text" && (
              <div className="rounded-xl border border-black/10 dark:border-white/15 p-4 grid gap-4">
                <Field label="Text">
                  <textarea
                    ref={textRef}
                    value={sel.text}
                    rows={3}
                    placeholder="Type here"
                    onFocus={ed.snapshot}
                    onChange={(e) => ed.update(sel.id, { text: e.target.value })}
                    className={`${inputClass} min-h-20`}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Font">
                    <select
                      value={sel.font}
                      onChange={(e) => {
                        ed.snapshot();
                        ed.update(sel.id, { font: e.target.value as TextFont });
                        setTextFont(e.target.value as TextFont);
                      }}
                      className={`${inputClass} h-10`}
                    >
                      {(Object.keys(textFonts) as TextFont[]).map((k) => (
                        <option key={k} value={k}>
                          {textFonts[k].label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Size: ${Math.round(sel.fsize * W)} pt`}>
                    <input
                      type="range"
                      min={6}
                      max={48}
                      value={Math.round(sel.fsize * W)}
                      onPointerDown={ed.snapshot}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        ed.update(sel.id, { fsize: v / W });
                        setTextSize(v);
                      }}
                      className="h-10 accent-red-600"
                    />
                  </Field>
                </div>
                <ColorPicker
                  value={sel.color}
                  onChange={(c) => {
                    ed.update(sel.id, { color: c });
                    setTextColor(c);
                  }}
                />
                <SecondaryButton onClick={() => ed.remove(sel.id)}>Delete text</SecondaryButton>
              </div>
            )}

            {sel?.kind === "rect" && (
              <div className="rounded-xl border border-black/10 dark:border-white/15 p-4 grid gap-4">
                <p className="text-sm font-medium">{sel.style === "whiteout" ? "White-out" : sel.style === "highlight" ? "Highlight" : "Box"}</p>
                {sel.style !== "whiteout" && (
                  <ColorPicker
                    value={sel.color}
                    onChange={(c) => ed.update(sel.id, { color: c })}
                    swatches={sel.style === "highlight" ? highlightColors : undefined}
                  />
                )}
                {sel.style === "whiteout" && (
                  <InfoNote>
                    White-out hides what&apos;s underneath visually, but the original text is still in the file and can be copied. To truly remove
                    sensitive text, also run <Link className="underline" href="/flatten-pdf">Flatten PDF</Link> and choose Flatten everything.
                  </InfoNote>
                )}
                <SecondaryButton onClick={() => ed.remove(sel.id)}>Delete</SecondaryButton>
              </div>
            )}

            {sel?.kind === "ink" && (
              <div className="rounded-xl border border-black/10 dark:border-white/15 p-4 grid gap-4">
                <ColorPicker
                  value={sel.color}
                  onChange={(c) => {
                    ed.update(sel.id, { color: c });
                    setPenColor(c);
                  }}
                />
                <SecondaryButton onClick={() => ed.remove(sel.id)}>Delete drawing</SecondaryButton>
              </div>
            )}

            {!sel && tool === "pen" && <ColorPicker value={penColor} onChange={setPenColor} label="Pen color" />}
            {!sel && tool === "text" && <ColorPicker value={textColor} onChange={setTextColor} label="Text color" />}
            {!sel && tool === "select" && count === 0 && (
              <InfoNote>Pick a tool above, then tap or drag on the page. You can move and resize everything afterwards.</InfoNote>
            )}

            <ActionButton onClick={save} busy={ed.busy} disabled={!count || !ed.pdf}>
              Save edited PDF
            </ActionButton>
            {ed.busy && <Progress value={ed.progress} label="Saving…" />}
            <ErrorNote>{ed.error}</ErrorNote>
            <InfoNote>
              This adds new text, highlights, white-out and drawings on top of the page. It can&apos;t change the PDF&apos;s existing text in
              place; cover it with white-out and type over it instead.
            </InfoNote>
          </div>
        </div>
      )}
    </div>
  );
}
