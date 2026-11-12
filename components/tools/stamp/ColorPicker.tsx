"use client";

export const defaultSwatches = [
  { value: "#000000", label: "Black" },
  { value: "#6b7280", label: "Gray" },
  { value: "#1d4ed8", label: "Blue" },
  { value: "#dc2626", label: "Red" },
];

/** Swatches plus a custom colour input, all ≥40px touch targets. */
export default function ColorPicker({
  value,
  onChange,
  label = "Color",
  swatches = defaultSwatches,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  swatches?: { value: string; label: string }[];
}) {
  const custom = !swatches.some((s) => s.value.toLowerCase() === value.toLowerCase());
  return (
    <fieldset>
      <legend className="text-sm font-medium mb-1">{label}</legend>
      <div className="flex flex-wrap items-center gap-1">
        {swatches.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-label={s.label}
            aria-pressed={value.toLowerCase() === s.value.toLowerCase()}
            onClick={() => onChange(s.value)}
            className={`h-10 w-10 shrink-0 rounded-full border-2 flex items-center justify-center ${
              value.toLowerCase() === s.value.toLowerCase() ? "border-red-500" : "border-transparent"
            }`}
          >
            <span className="h-6 w-6 rounded-full ring-1 ring-black/10" style={{ background: s.value }} />
          </button>
        ))}
        <label
          className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 cursor-pointer ${
            custom ? "border-red-500" : "border-transparent"
          }`}
          title="Pick any color"
        >
          <span className="sr-only">Pick any color</span>
          <span
            className="h-6 w-6 rounded-full ring-1 ring-black/10"
            style={{ background: custom ? value : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
          />
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full opacity-0 cursor-pointer" />
        </label>
      </div>
    </fieldset>
  );
}
