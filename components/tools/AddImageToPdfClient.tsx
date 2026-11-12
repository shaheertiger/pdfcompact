"use client";

import { useState } from "react";
import { ImagePlus, Undo2 } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, Field, FileBar, InfoNote, Progress, ResultPanel, SecondaryButton } from "@/components/ui/kit";
import { formatBytes } from "@/lib/download";
import { nextId } from "@/lib/id";
import { loadImageFile, type LoadedImage } from "@/lib/pdf-stamp";
import type { PlacedImage } from "@/lib/placements";
import { PageNav } from "./stamp/PageStage";
import TargetPicker from "./stamp/TargetPicker";
import { PlacementStage, usePlacementEditor } from "./stamp/usePlacementEditor";

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif";

export default function AddImageToPdfClient() {
  const ed = usePlacementEditor();
  const [images, setImages] = useState<Record<string, LoadedImage>>({});
  const [imgError, setImgError] = useState<string | null>(null);

  const imageUrls = Object.fromEntries(Object.entries(images).map(([k, v]) => [k, v.url]));

  const place = (key: string, img: { width: number; height: number }) => {
    const r = ed.render;
    if (!r) return;
    const aspect = img.width / img.height;
    // Start at its natural size (96 dpi) but no wider than 35% of the page or taller than 40%.
    let fw = Math.min(0.35, (img.width * 0.75) / r.ptWidth, (0.4 * r.ptHeight * aspect) / r.ptWidth);
    fw = Math.max(fw, 0.06);
    const fh = (fw * r.ptWidth) / aspect / r.ptHeight;
    const item: PlacedImage = {
      kind: "image",
      id: nextId("img"),
      imgKey: key,
      aspect,
      fx: (1 - fw) / 2,
      fy: Math.max(0, (1 - fh) / 2),
      fw,
      opacity: 1,
      target: { mode: "one", page: ed.page - 1 },
    };
    ed.add(item);
  };

  const onImages = async (files: File[]) => {
    setImgError(null);
    for (const f of files) {
      try {
        const img = await loadImageFile(f);
        const key = nextId("src");
        setImages((prev) => ({ ...prev, [key]: img }));
        place(key, img);
      } catch (e) {
        setImgError(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };

  const reset = () => {
    for (const v of Object.values(images)) URL.revokeObjectURL(v.url);
    setImages({});
    ed.reset();
  };

  if (!ed.file) {
    return (
      <div>
        <Dropzone onFiles={ed.onFiles} label="Drop the PDF you want to add an image to" />
        <ErrorNote>{ed.loadError}</ErrorNote>
      </div>
    );
  }

  const sel = ed.selected?.kind === "image" ? ed.selected : null;
  const count = ed.items.length;

  return (
    <div>
      <FileBar name={ed.file.name} detail={`${ed.numPages || "…"} pages · ${formatBytes(ed.file.size)}`} onReset={reset} />
      <ErrorNote>{ed.pdfError}</ErrorNote>

      {ed.result ? (
        <ResultPanel
          files={[ed.result]}
          originalSize={ed.file.size}
          note={<>Added {count} image{count === 1 ? "" : "s"}. Images are embedded at their full resolution.</>}
          onReset={() => ed.setResult(null)}
          resetLabel="Keep editing"
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start">
          <div>
            {Object.keys(images).length === 0 ? (
              <div className="mb-4">
                <Dropzone
                  onFiles={onImages}
                  multiple
                  accept={IMAGE_ACCEPT}
                  label="Now add your image"
                  hint="PNG, JPG or WebP: a logo, stamp, photo or signature"
                />
              </div>
            ) : (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-black/15 dark:border-white/20 px-4 text-sm font-medium hover:border-red-400 hover:text-red-600">
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  Add image
                  <input
                    type="file"
                    accept={IMAGE_ACCEPT}
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      const fl = e.target.files;
                      if (fl?.length) onImages(Array.from(fl));
                      e.target.value = "";
                    }}
                  />
                </label>
                {Object.entries(images).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => place(k, v)}
                    aria-label={`Add another copy of ${v.name} to page ${ed.page}`}
                    title={`Add another copy to page ${ed.page}`}
                    className="h-10 w-10 rounded-lg border border-black/10 dark:border-white/15 bg-[repeating-conic-gradient(#e4e4e7_0_25%,white_0_50%)] bg-[length:10px_10px] p-0.5 hover:border-red-400"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.url} alt="" className="h-full w-full object-contain" />
                  </button>
                ))}
                {ed.canUndo && (
                  <button
                    type="button"
                    onClick={ed.undo}
                    className="ml-auto inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm text-zinc-600 dark:text-zinc-300 hover:text-red-600"
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" /> Undo
                  </button>
                )}
              </div>
            )}
            <ErrorNote>{imgError}</ErrorNote>
            <PlacementStage ed={ed} imageUrls={imageUrls} fonts={null} labelFor={(p) => (p.kind === "image" ? `Image ${images[p.imgKey]?.name ?? ""}` : undefined)} />
            <PageNav page={ed.page} count={ed.numPages} onChange={ed.setPage} />
          </div>

          <div className="grid gap-5">
            {sel ? (
              <div className="rounded-xl border border-black/10 dark:border-white/15 p-4 grid gap-4">
                <p className="text-sm font-medium">Selected image</p>
                <Field label={`Opacity: ${Math.round(sel.opacity * 100)}%`}>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round(sel.opacity * 100)}
                    onPointerDown={ed.snapshot}
                    onChange={(e) => ed.update(sel.id, { opacity: parseInt(e.target.value, 10) / 100 })}
                    className="h-10 accent-red-600"
                  />
                </Field>
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
                <SecondaryButton onClick={() => ed.remove(sel.id)}>Remove this image</SecondaryButton>
              </div>
            ) : count > 0 ? (
              <InfoNote>Tap an image on the page to select it. Drag to move it; drag the red corner dot to resize (the shape is kept).</InfoNote>
            ) : (
              <InfoNote>Pick the page first with the arrows under the preview, then add your image. You can move it to other pages or every page afterwards.</InfoNote>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <ActionButton onClick={() => ed.save(images, "with-image")} busy={ed.busy} disabled={!count || !ed.pdf}>
                Save PDF{count ? ` (${count} image${count === 1 ? "" : "s"})` : ""}
              </ActionButton>
            </div>
            {ed.busy && <Progress value={ed.progress} label="Adding images…" />}
            <ErrorNote>{ed.error}</ErrorNote>
          </div>
        </div>
      )}
    </div>
  );
}
