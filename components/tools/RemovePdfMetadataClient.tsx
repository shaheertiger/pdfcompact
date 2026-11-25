"use client";

import { useState } from "react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, FileBar, InfoNote, ResultPanel, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, isPdf, pdfBlob } from "@/lib/download";
import type { Field, MetadataReport } from "@/lib/metadata";
import { CheckOption } from "./convert-kit";

function FieldTable({ title, rows, empty }: { title: string; rows: Field[]; empty: string }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold mb-1.5">{title}</h3>
      {rows.length ? (
        <div className="table-wrap">
          <table className="limits text-xs sm:text-sm">
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key + i}>
                  <th scope="row" className="whitespace-nowrap">{r.key}</th>
                  <td className="break-all">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">{empty}</p>
      )}
    </div>
  );
}

function Extras({ r }: { r: MetadataReport }) {
  const items: string[] = [];
  if (r.objectXmp) items.push(`${r.objectXmp} XMP ${r.objectXmp === 1 ? "packet" : "packets"} on pages, images or fonts`);
  if (r.pieceInfo) items.push(`private app data (PieceInfo) on ${r.pieceInfo} ${r.pieceInfo === 1 ? "object" : "objects"}`);
  if (r.commentAuthors)
    items.push(
      `${r.commentAuthors} ${r.commentAuthors === 1 ? "comment" : "comments"} signed by ${r.authorNames.length ? r.authorNames.map((n) => `“${n}”`).join(", ") : "an author"}`
    );
  if (r.commentDates && !r.commentAuthors) items.push(`${r.commentDates} dated ${r.commentDates === 1 ? "comment" : "comments"}`);
  if (!items.length) return null;
  return <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Also found: {items.join("; ")}.</p>;
}

export default function RemovePdfMetadataClient() {
  const [file, setFile] = useState<File | null>(null);
  const [before, setBefore] = useState<MetadataReport | null>(null);
  const [after, setAfter] = useState<MetadataReport | null>(null);
  const [keepTitle, setKeepTitle] = useState(false);
  const [comments, setComments] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultFile | null>(null);

  const friendly = (e: unknown) => {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "encrypted") return "This PDF needs a password to open. Remove the password first, then try again.";
    return "Couldn't read this PDF. It may be damaged or not a real PDF.";
  };

  const reset = () => {
    setFile(null);
    setBefore(null);
    setAfter(null);
    setResult(null);
    setError(null);
  };

  const onFiles = async (files: File[]) => {
    const f = files[0];
    reset();
    if (!f || !isPdf(f)) {
      setError("That isn't a PDF. Choose a .pdf file.");
      return;
    }
    setFile(f);
    try {
      const { loadForMetadata, readMetadata } = await import("@/lib/metadata");
      setBefore(readMetadata(await loadForMetadata(new Uint8Array(await f.arrayBuffer()))));
    } catch (e) {
      setError(friendly(e));
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setAfter(null);
    try {
      const m = await import("@/lib/metadata");
      const doc = await m.loadForMetadata(new Uint8Array(await file.arrayBuffer()));
      m.stripMetadata(doc, { keepTitle, comments });
      const out = await m.saveStripped(doc);
      // Re-open the saved file and read it back, so "after" shows what's really in it.
      setAfter(m.readMetadata(await m.loadForMetadata(out)));
      setResult({ blob: pdfBlob(out), name: `${baseName(file.name)}-no-metadata.pdf` });
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <>
        <Dropzone onFiles={onFiles} />
        <ErrorNote>{error}</ErrorNote>
      </>
    );
  }

  const nothing = before && !before.info.length && !before.xmp.length && !before.objectXmp && !before.pieceInfo && !before.commentAuthors;

  return (
    <div>
      <FileBar name={file.name} detail={`${before ? `${before.pages} ${before.pages === 1 ? "page" : "pages"} · ` : ""}${formatBytes(file.size)}`} onReset={reset} />
      {before && (
        <section aria-label="Metadata found">
          <div className="grid gap-4 md:grid-cols-2">
            <FieldTable title="Document properties (Info)" rows={before.info} empty="None." />
            <FieldTable title={`XMP metadata${before.xmpBytes ? ` (${formatBytes(before.xmpBytes)})` : ""}`} rows={before.xmp} empty="None." />
          </div>
          <Extras r={before} />
          {nothing && <InfoNote>This PDF has no document metadata. You can still save a clean copy with a new file ID.</InfoNote>}
        </section>
      )}
      {before && !result && (
        <div className="mt-5 grid gap-1">
          <CheckOption checked={keepTitle} onChange={setKeepTitle} disabled={!before.info.some((f) => f.key === "Title")} hint="Viewers show it in the tab or title bar instead of the file name.">
            Keep the title
          </CheckOption>
          <CheckOption checked={comments} onChange={setComments} hint="Comments stay; only the name and timestamp on each one go. Form fields are not touched.">
            Remove comment author names and dates
          </CheckOption>
          <div className="mt-3">
            <ActionButton onClick={run} busy={busy}>
              Remove metadata
            </ActionButton>
          </div>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
      {result && after && (
        <>
          <ResultPanel
            files={[result]}
            originalSize={file.size}
            note="Re-read from the cleaned file below. Page content, text and images are unchanged."
            onReset={reset}
            resetLabel="Clean another PDF"
          />
          <section aria-label="Metadata after" className="mt-4">
            <h3 className="text-sm font-semibold mb-1.5">What the cleaned file contains</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldTable title="Document properties (Info)" rows={after.info} empty="Empty." />
              <FieldTable title="XMP metadata" rows={after.xmp} empty="Removed." />
            </div>
            <Extras r={after} />
            {after.attachments > 0 && (
              <InfoNote>
                This PDF has {after.attachments} attached {after.attachments === 1 ? "file" : "files"}. Attachments are kept and can carry their own metadata.
              </InfoNote>
            )}
          </section>
        </>
      )}
    </div>
  );
}
