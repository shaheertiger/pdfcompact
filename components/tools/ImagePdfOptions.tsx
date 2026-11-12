"use client";

import type { ImageQuality, PageMargin, PageOrientation, PageSize, PdfPageOptions } from "@/lib/images-to-pdf";

type Opt<T extends string> = { value: T; label: string };

function Pills<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: Opt<T>[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className={disabled ? "opacity-50" : undefined}>
      <legend className="text-sm font-medium mb-1.5">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-10 rounded-full border px-4 text-sm transition-colors ${
              value === o.value
                ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 font-medium"
                : "border-black/15 dark:border-white/15 hover:border-red-300"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const QUALITY_HINT: Record<ImageQuality, string> = {
  original: "Photos are placed exactly as they are. Best quality; the PDF is about the size of your images.",
  balanced: "Large photos are scaled to 2480 px (A4 at 300 dpi) and saved as JPEG at 82%. Usually far smaller, still sharp in print.",
  small: "Scaled to 1600 px, JPEG at 70%. Smallest file for email and upload portals; fine on screen.",
};

/** Page size, orientation, margin and image quality for the image → PDF tools. */
export default function ImagePdfOptions({
  value,
  onChange,
}: {
  value: PdfPageOptions;
  onChange: (v: PdfPageOptions) => void;
}) {
  const set = <K extends keyof PdfPageOptions>(k: K, v: PdfPageOptions[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Pills<PageSize>
        label="Page size"
        value={value.pageSize}
        onChange={(v) => set("pageSize", v)}
        options={[
          { value: "fit", label: "Fit to image" },
          { value: "a4", label: "A4" },
          { value: "letter", label: "US Letter" },
        ]}
      />
      <Pills<PageOrientation>
        label="Orientation"
        value={value.orientation}
        onChange={(v) => set("orientation", v)}
        disabled={value.pageSize === "fit"}
        options={[
          { value: "auto", label: "Auto" },
          { value: "portrait", label: "Portrait" },
          { value: "landscape", label: "Landscape" },
        ]}
      />
      <Pills<PageMargin>
        label="Margin"
        value={value.margin}
        onChange={(v) => set("margin", v)}
        options={[
          { value: "none", label: "None" },
          { value: "small", label: "Small (10 mm)" },
          { value: "large", label: "Large (20 mm)" },
        ]}
      />
      <div>
        <Pills<ImageQuality>
          label="Image quality"
          value={value.quality}
          onChange={(v) => set("quality", v)}
          options={[
            { value: "original", label: "Original" },
            { value: "balanced", label: "Balanced" },
            { value: "small", label: "Smaller file" },
          ]}
        />
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{QUALITY_HINT[value.quality]}</p>
      </div>
    </div>
  );
}
