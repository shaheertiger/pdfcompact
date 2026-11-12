"use client";

import { useEffect, useState } from "react";
import { PDFDocument, type PDFFont } from "pdf-lib";
import { LINE_HEIGHT, textFonts, type ImageSource, type Placed, type PlacedImage, type TextFont } from "@/lib/placements";
import type { StageItem } from "./PageStage";

export type Fonts = Record<TextFont, PDFFont>;

/** Standard-font metrics, so on-screen text is laid out exactly like the PDF. */
export function useStandardFonts(): Fonts | null {
  const [fonts, setFonts] = useState<Fonts | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await PDFDocument.create();
      const keys = Object.keys(textFonts) as TextFont[];
      const list = await Promise.all(keys.map((k) => d.embedFont(textFonts[k].std)));
      if (!cancelled) setFonts(Object.fromEntries(keys.map((k, i) => [k, list[i]])) as Fonts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return fonts;
}

export function textBox(p: { text: string; font: TextFont }, size: number, fonts: Fonts) {
  const f = fonts[p.font];
  const lines = (p.text || "Type here").split("\n");
  let w = 0;
  for (const l of lines) {
    try {
      w = Math.max(w, f.widthOfTextAtSize(l, size));
    } catch {
      w = Math.max(w, l.length * size * 0.6); // characters outside the font: estimate
    }
  }
  const ascent = f.heightAtSize(size, { descender: false });
  const descent = f.heightAtSize(size) - ascent;
  return { w: Math.max(w, size * 0.5), h: ascent + (lines.length - 1) * size * LINE_HEIGHT + descent, ascent };
}

export type PlacedStageItem = StageItem & { placed: Placed };

const labels: Record<Placed["kind"], string> = { image: "Image", text: "Text", rect: "Box", ink: "Drawing" };

/** Convert a placed item to stage coordinates (points) on a page of W × H. */
export function toStage(p: Placed, W: number, H: number, fonts: Fonts | null, label?: string): PlacedStageItem {
  const base = { id: p.id, x: p.fx * W, y: p.fy * H, label: label ?? labels[p.kind], placed: p };
  if (p.kind === "image") {
    const w = p.fw * W;
    return { ...base, w, h: w / p.aspect, aspect: p.aspect, resizable: true };
  }
  if (p.kind === "text") {
    if (!fonts) return { ...base, resizable: false };
    const b = textBox(p, p.fsize * W, fonts);
    return { ...base, w: b.w, h: b.h, aspect: b.w / b.h, resizable: true, label: label ?? `Text: ${p.text.slice(0, 30)}` };
  }
  return { ...base, w: p.fw * W, h: p.fh * H, resizable: true, aspect: p.kind === "ink" ? (p.fw * W) / (p.fh * H) : undefined };
}

/** Turn a stage move/resize back into fractions. */
export function fromStage(p: Placed, patch: Partial<StageItem>, W: number, H: number, fonts: Fonts | null): Partial<Placed> {
  const out: Partial<Placed> = {};
  if (patch.x !== undefined) out.fx = patch.x / W;
  if (patch.y !== undefined) out.fy = patch.y / H;
  if (patch.w !== undefined) {
    if (p.kind === "text") {
      if (fonts) {
        const cur = textBox(p, p.fsize * W, fonts);
        (out as Partial<typeof p>).fsize = Math.max(4 / W, Math.min(200 / W, p.fsize * (patch.w / cur.w)));
      }
    } else {
      out.fw = patch.w / W;
    }
  }
  if (patch.h !== undefined && (p.kind === "rect" || p.kind === "ink")) (out as Partial<typeof p>).fh = patch.h / H;
  return out;
}

/** Draw a placed item inside its stage box. */
export function PlacedView({
  p,
  W,
  pxPerPt,
  imageUrls,
  fonts,
}: {
  p: Placed;
  W: number;
  pxPerPt: number;
  imageUrls: Record<string, string>;
  fonts: Fonts | null;
}) {
  if (p.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrls[p.imgKey]} alt="" draggable={false} className="block h-full w-full pointer-events-none" style={{ opacity: p.opacity }} />
    );
  }
  if (p.kind === "text") {
    const size = p.fsize * W;
    const b = fonts ? textBox(p, size, fonts) : { w: 100, h: size * 1.2, ascent: size * 0.72 };
    const f = textFonts[p.font];
    return (
      <svg
        width={b.w * pxPerPt}
        height={b.h * pxPerPt}
        viewBox={`0 0 ${b.w} ${b.h}`}
        overflow="visible"
        className="block pointer-events-none"
        style={{ opacity: p.opacity }}
        aria-hidden="true"
      >
        <text fontFamily={f.css} fontWeight={f.weight} fontSize={size} fill={p.color} fillOpacity={p.text ? 1 : 0.35} style={{ whiteSpace: "pre" }}>
          {(p.text || "Type here").split("\n").map((line, i) => (
            <tspan key={i} x={0} y={b.ascent + i * size * LINE_HEIGHT}>
              {line || " "}
            </tspan>
          ))}
        </text>
      </svg>
    );
  }
  if (p.kind === "rect") {
    if (p.style === "box") {
      return <div className="h-full w-full pointer-events-none" style={{ border: `${Math.max(1, W * 0.002 * pxPerPt)}px solid ${p.color}`, opacity: p.opacity }} />;
    }
    return (
      <div
        className="h-full w-full pointer-events-none"
        style={{ background: p.color, opacity: p.opacity, mixBlendMode: p.style === "highlight" ? "multiply" : undefined }}
      />
    );
  }
  // ink
  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="block h-full w-full pointer-events-none overflow-visible" aria-hidden="true" style={{ opacity: p.opacity }}>
      {p.strokes.map((s, i) => (
        <polyline
          key={i}
          points={s.map((pt) => `${pt.x},${pt.y}`).join(" ")}
          fill="none"
          stroke={p.color}
          strokeWidth={p.fwidth * W * pxPerPt}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/**
 * Text the standard PDF fonts can't encode (Hindi, Chinese, emoji…) becomes a
 * sharp transparent PNG placed exactly where the text was.
 * `aspect` is page width / height of the page the text was placed on.
 */
export async function rasterizeUnsupportedText(items: Placed[], fonts: Fonts | null, aspect: number) {
  const { fontCanDraw, textToPng } = await import("@/lib/pdf-stamp");
  const images: Record<string, ImageSource> = {};
  const out: Placed[] = [];
  for (const p of items) {
    if (p.kind !== "text" || !fonts || fontCanDraw(fonts[p.font], p.text.replace(/\n/g, ""))) {
      out.push(p);
      continue;
    }
    const f = textFonts[p.font];
    const px = 100;
    const r = await textToPng(p.text, f.css, px, p.color, 4, f.weight);
    const key = `raster-${p.id}`;
    images[key] = { bytes: r.bytes, kind: "png" };
    const sizeOverW = p.fsize; // font size as a fraction of page width
    const ascRatio = fonts[p.font].heightAtSize(1, { descender: false });
    const img: PlacedImage = {
      kind: "image",
      id: p.id,
      imgKey: key,
      aspect: r.width / r.height,
      fx: p.fx,
      fy: p.fy - (0.95 - ascRatio) * sizeOverW * aspect,
      fw: (r.width / px) * sizeOverW,
      opacity: p.opacity,
      target: p.target,
    };
    out.push(img);
  }
  return { items: out, images };
}
