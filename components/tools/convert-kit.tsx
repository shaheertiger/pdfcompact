"use client";

import type { ReactNode } from "react";

/** Checkbox row with a 40px+ touch target, used by the convert tools. */
export function CheckOption({
  checked,
  onChange,
  children,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 text-sm min-h-10 py-1 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 accent-red-600 shrink-0"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {children}
        {hint && <span className="block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
      </span>
    </label>
  );
}

/** Amber warning box for partial-success notes (replaced characters, skipped images). */
export function WarnNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-3 text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-4 py-3">
      {children}
    </p>
  );
}
