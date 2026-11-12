"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, RotateCcw } from "lucide-react";
import { downloadBlob, formatBytes } from "@/lib/download";
import { kitStrings, useStrings } from "@/lib/i18n";

/** Big red action button used by every tool. */
export function ActionButton({
  children,
  onClick,
  disabled,
  busy,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 text-white px-6 py-3 font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-black/15 dark:border-white/20 px-4 py-2 text-sm font-medium hover:border-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
    >
      {children}
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="mt-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 rounded-lg px-4 py-3"
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{children}</p>
  );
}

/** Shows the loaded file and a way to start over. */
export function FileBar({
  name,
  detail,
  onReset,
}: {
  name: string;
  detail?: string;
  onReset: () => void;
}) {
  const t = useStrings(kitStrings);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 dark:border-white/10 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 mb-5">
      <span className="text-sm truncate">
        <span className="font-medium">{name}</span>
        {detail && <span className="text-zinc-500"> · {detail}</span>}
      </span>
      <button
        type="button"
        onClick={onReset}
        className="shrink-0 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-red-600"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        {t.changeFile}
      </button>
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const t = useStrings(kitStrings);
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="mt-4" aria-live="polite">
      <div className="flex justify-between text-xs text-zinc-500 mb-1">
        <span>{label ?? t.working}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-red-600 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export type ResultFile = { blob: Blob; name: string };

/** Success panel with a download button. Nothing downloads until the user clicks. */
export function ResultPanel({
  title,
  files,
  note,
  originalSize,
  onReset,
  resetLabel,
}: {
  title?: string;
  files: ResultFile[];
  note?: ReactNode;
  originalSize?: number;
  onReset?: () => void;
  resetLabel?: string;
}) {
  const t = useStrings(kitStrings);
  const total = files.reduce((n, f) => n + f.blob.size, 0);
  const saved =
    originalSize && originalSize > 0 ? 1 - total / originalSize : undefined;
  return (
    <div className="mt-5 rounded-xl border border-emerald-300/60 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5 p-4 sm:p-5">
      <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        {title ?? t.done}
      </div>
      {originalSize !== undefined && (
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          {formatBytes(originalSize)} → <strong>{formatBytes(total)}</strong>
          {saved !== undefined && (
            <span className={saved > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500"}>
              {" "}
              ({saved > 0 ? `${Math.round(saved * 100)}% ${t.smaller}` : t.noSmaller})
            </span>
          )}
        </p>
      )}
      {note && <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{note}</div>}
      <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap gap-2">
        {files.map((f) => (
          <DownloadLink key={f.name} file={f} />
        ))}
        {onReset && <SecondaryButton onClick={onReset}>{resetLabel ?? t.startOver}</SecondaryButton>}
      </div>
    </div>
  );
}

function DownloadLink({ file }: { file: ResultFile }) {
  return (
    <button
      type="button"
      onClick={() => downloadBlob(file.blob, file.name)}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-700 transition-colors"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      <span className="truncate max-w-[16rem]">{file.name}</span>
      <span className="opacity-80">({formatBytes(file.blob.size)})</span>
    </button>
  );
}

/** Segmented choice control (levels, modes). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
  label?: string;
}) {
  return (
    <fieldset>
      {label && <legend className="text-sm font-medium mb-2">{label}</legend>}
      <div className={`grid gap-2 ${options.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`text-left rounded-lg border px-4 py-2.5 text-sm transition-colors ${
              value === o.value
                ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300"
                : "border-black/10 dark:border-white/10 hover:border-red-300"
            }`}
          >
            <span className="font-medium block">{o.label}</span>
            {o.hint && <span className="text-xs text-zinc-500 dark:text-zinc-400">{o.hint}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-zinc-900 px-3 py-2 text-sm";
