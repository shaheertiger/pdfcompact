"use client";

import { useCallback, useState } from "react";
import { PDFDocument } from "pdf-lib";
import Dropzone from "@/components/Dropzone";
import { downloadBlob, bytesToBlob } from "@/lib/download";
import { nextId } from "@/lib/id";

type ImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

async function toPngBytes(file: File): Promise<Uint8Array> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, 0, 0);
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
    );
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ImageToPdfClient() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const addFiles = useCallback((files: File[]) => {
    setError(null);
    const imgFiles = files.filter((f) => f.type.startsWith("image/"));
    setImages((prev) => [
      ...prev,
      ...imgFiles.map((file) => ({
        id: nextId("img"),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }, []);

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  const move = (from: number, to: number) => {
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleConvert = async () => {
    if (images.length === 0) return;
    setIsConverting(true);
    setError(null);
    try {
      const doc = await PDFDocument.create();
      for (const { file } of images) {
        let embedded;
        if (file.type === "image/jpeg" || file.type === "image/jpg") {
          embedded = await doc.embedJpg(await file.arrayBuffer());
        } else if (file.type === "image/png") {
          embedded = await doc.embedPng(await file.arrayBuffer());
        } else {
          embedded = await doc.embedPng(await toPngBytes(file));
        }
        const page = doc.addPage([embedded.width, embedded.height]);
        page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
      }
      const bytes = await doc.save();
      downloadBlob(bytesToBlob(bytes, "application/pdf"), "images.pdf");
    } catch (e) {
      console.error(e);
      setError("Couldn't convert these images. Try a different file format (JPG, PNG, or WebP).");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div>
      <Dropzone
        accept="image/*"
        multiple
        onFiles={addFiles}
        label="Drop images here"
        hint="or click to browse (JPG, PNG, WebP)"
      />

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {images.length > 0 && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {images.map((img, i) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== i) move(dragIndex, i);
                setDragIndex(null);
              }}
              className="relative rounded-lg border border-black/10 dark:border-white/10 overflow-hidden cursor-move bg-white dark:bg-zinc-800 shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.previewUrl} alt={img.file.name} className="w-full h-32 object-cover block" />
              <span className="absolute bottom-1 left-1 bg-black/70 text-white text-xs rounded px-1.5 py-0.5">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center hover:bg-red-600"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleConvert}
          disabled={images.length === 0 || isConverting}
          className="rounded-full bg-red-600 text-white px-6 py-2.5 font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors"
        >
          {isConverting ? "Converting…" : `Convert ${images.length || ""} image${images.length === 1 ? "" : "s"} to PDF`}
        </button>
        {images.length > 0 && (
          <button
            type="button"
            onClick={() => setImages([])}
            className="text-sm text-zinc-500 hover:text-red-600"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
