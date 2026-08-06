export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function baseName(filename: string): string {
  return filename.replace(/\.pdf$/i, "");
}
