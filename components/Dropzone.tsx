"use client";

import { useCallback, useId, useState } from "react";
import type { DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { kitStrings, useStrings } from "@/lib/i18n";

type DropzoneProps = {
  accept?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label?: string;
  hint?: string;
};

export default function Dropzone({
  accept = "application/pdf",
  multiple = false,
  onFiles,
  label,
  hint,
}: DropzoneProps) {
  const t = useStrings(kitStrings);
  const [isDragging, setIsDragging] = useState(false);
  const inputId = useId();

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      onFiles(Array.from(fileList));
    },
    [onFiles]
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-5 py-6 sm:p-10 text-center cursor-pointer transition-colors ${
        isDragging
          ? "border-red-500 bg-red-50 dark:bg-red-500/10"
          : "border-black/20 dark:border-white/20 hover:border-red-400"
      }`}
    >
      <UploadCloud className="h-9 w-9 text-zinc-400" aria-hidden="true" />
      <span className="font-medium">{label ?? (multiple ? t.dropPdfs : t.dropPdf)}</span>
      <span className="text-sm text-zinc-500">{hint ?? (multiple ? t.browseMany : t.browse)}</span>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
