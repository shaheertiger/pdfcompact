"use client";

import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import Dropzone from "@/components/Dropzone";
import { ActionButton, ErrorNote, Field, FileBar, InfoNote, Progress, ResultPanel, inputClass, type ResultFile } from "@/components/ui/kit";
import { baseName, formatBytes, isPdf, pdfBlob } from "@/lib/download";
import { loadPdfjs } from "@/lib/pdfjs";
import { passwordStrength } from "@/lib/password-strength";

const meterColors = ["bg-red-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"];

function PasswordInput({
  value,
  onChange,
  show,
  autoComplete = "new-password",
  id,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  autoComplete?: string;
  id?: string;
  invalid?: boolean;
}) {
  return (
    <input
      id={id}
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      aria-invalid={invalid || undefined}
      className={`${inputClass} h-11 w-full font-mono ${invalid ? "border-red-500" : ""}`}
    />
  );
}

/** Check the output really is locked: pdf.js must refuse it without the password and open it with it. */
async function verifyLocked(bytes: Uint8Array, password: string): Promise<{ ok: boolean; pages: number }> {
  const pdfjs = await loadPdfjs();
  let refused = false;
  try {
    const d = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    await d.destroy();
  } catch (e) {
    refused = Boolean(e && typeof e === "object" && "name" in e && e.name === "PasswordException");
  }
  const d = await pdfjs.getDocument({ data: bytes.slice(), password, isEvalSupported: false }).promise;
  const pages = d.numPages;
  await d.destroy();
  return { ok: refused, pages };
}

export default function ProtectPdfClient() {
  const [file, setFile] = useState<File | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [restrict, setRestrict] = useState(false);
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(true);
  const [allowEdit, setAllowEdit] = useState(true);
  const [ownerPw, setOwnerPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; pages: number } | null>(null);

  const strength = passwordStrength(pw);
  const mismatch = pw2.length > 0 && pw !== pw2;
  const restricted = restrict && (!allowPrint || !allowCopy || !allowEdit);
  const ownerProblem = restricted
    ? !ownerPw
      ? "Set a permissions password, or nobody (including you) could lift these restrictions."
      : ownerPw === pw
        ? "Use a different password for permissions. Anyone with the open password would otherwise get full access."
        : null
    : null;

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setLoadError(null);
    setPw("");
    setPw2("");
    setOwnerPw("");
  };

  const onFiles = (files: File[]) => {
    const f = files[0];
    reset();
    if (!isPdf(f)) {
      setLoadError("That isn't a PDF. Choose a .pdf file.");
      return;
    }
    setFile(f);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress(0.05);
    try {
      const { PDFDocument } = await import("@cantoo/pdf-lib");
      setProgress(0.2);
      const bytes = new Uint8Array(await file.arrayBuffer());
      let doc;
      try {
        doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      } catch {
        throw new Error("Couldn't read this PDF. It may be damaged or not a real PDF.");
      }
      if (doc.isEncrypted) {
        // Permissions-only files (they open without a password) can be decrypted and re-locked.
        try {
          doc = await PDFDocument.load(bytes, { ignoreEncryption: true, password: "", updateMetadata: false });
        } catch {
          throw new Error("This PDF already needs a password to open. Open it with that password and save an unprotected copy first, then protect that copy.");
        }
      }
      setProgress(0.4);
      doc.encrypt({
        userPassword: pw,
        // Without restrictions the opener gets full rights, so they can still remove the password later in Acrobat or Preview.
        ownerPassword: restricted ? ownerPw : pw,
        permissions: restricted
          ? {
              printing: allowPrint ? "highResolution" : false,
              copying: allowCopy,
              contentAccessibility: true,
              modifying: allowEdit,
              annotating: allowEdit,
              fillingForms: allowEdit,
              documentAssembly: allowEdit,
            }
          : {
              printing: "highResolution",
              copying: true,
              contentAccessibility: true,
              modifying: true,
              annotating: true,
              fillingForms: true,
              documentAssembly: true,
            },
      });
      const out = await doc.save();
      setProgress(0.8);
      const check = await verifyLocked(out, pw);
      if (!check.ok) throw new Error("The encrypted file didn't verify, so it wasn't saved. Please try again.");
      setProgress(1);
      setResult({ file: { blob: pdfBlob(out), name: `${baseName(file.name)}-protected.pdf` }, pages: check.pages });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while encrypting the PDF.");
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <div>
        <Dropzone onFiles={onFiles} />
        <ErrorNote>{loadError}</ErrorNote>
      </div>
    );
  }

  const ready = pw.length >= 4 && pw === pw2 && !ownerProblem;

  return (
    <div>
      <FileBar name={file.name} detail={formatBytes(file.size)} onReset={reset} />
      {result ? (
        <ResultPanel
          title="Protected with AES-256"
          files={[result.file]}
          originalSize={file.size}
          note={
            <div className="grid gap-1">
              <p className="flex items-start gap-1.5">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>
                  Checked: the file refuses to open without the password and opens all {result.pages} page{result.pages === 1 ? "" : "s"} with it.
                </span>
              </p>
              <p>
                Store the password somewhere safe. There is no way to recover it, from us or anyone else. Send it to the recipient by a
                different channel than the file (text it, or tell them on the phone).
              </p>
            </div>
          }
          onReset={reset}
          resetLabel="Protect another PDF"
        />
      ) : (
        <div className="grid gap-5 max-w-xl mx-auto">
          <div className="grid gap-1 text-sm">
            <label htmlFor="pp-open" className="font-medium">
              Password to open the PDF
            </label>
            <div className="flex gap-2">
              <PasswordInput id="pp-open" value={pw} onChange={setPw} show={show} />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-pressed={show}
                aria-label={show ? "Hide passwords" : "Show passwords"}
                className="h-11 w-11 shrink-0 rounded-md border border-black/15 dark:border-white/15 flex items-center justify-center hover:border-red-400"
              >
                {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            {pw && (
              <div className="mt-1" aria-live="polite">
                <div className="flex gap-1" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength.score ? meterColors[strength.score] : "bg-zinc-200 dark:bg-zinc-700"}`} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <strong>{strength.label}.</strong> {strength.hint}
                  {pw.length < 4 && " Use at least 4 characters."}
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-1 text-sm">
            <label htmlFor="pp-confirm" className="font-medium">
              Type it again
            </label>
            <PasswordInput id="pp-confirm" value={pw2} onChange={setPw2} show={show} invalid={mismatch} />
            {mismatch && <span className="text-xs text-red-600">The passwords don&apos;t match.</span>}
          </div>

          <div className="rounded-xl border border-black/10 dark:border-white/15 p-4">
            <label className="flex items-start gap-3 cursor-pointer min-h-10">
              <input type="checkbox" checked={restrict} onChange={(e) => setRestrict(e.target.checked)} className="mt-1 h-5 w-5 accent-red-600" />
              <span className="text-sm">
                <span className="font-medium block">Also restrict printing, copying or editing</span>
                <span className="text-zinc-500 text-xs">Optional. Honored by Adobe Reader, Chrome, Edge and most readers; some apps ignore it.</span>
              </span>
            </label>
            {restrict && (
              <div className="mt-3 grid gap-3 pl-1">
                {[
                  { v: allowPrint, set: setAllowPrint, label: "Allow printing" },
                  { v: allowCopy, set: setAllowCopy, label: "Allow copying text and images" },
                  { v: allowEdit, set: setAllowEdit, label: "Allow editing, comments, form filling and page changes" },
                ].map((c) => (
                  <label key={c.label} className="flex items-center gap-3 text-sm min-h-10 cursor-pointer">
                    <input type="checkbox" checked={c.v} onChange={(e) => c.set(e.target.checked)} className="h-5 w-5 accent-red-600" />
                    {c.label}
                  </label>
                ))}
                <Field label="Permissions password" hint="Different from the open password. Whoever has it can lift the restrictions.">
                  <PasswordInput value={ownerPw} onChange={setOwnerPw} show={show} invalid={Boolean(ownerPw) && ownerPw === pw} />
                </Field>
              </div>
            )}
          </div>

          <ErrorNote>{ownerProblem || error}</ErrorNote>
          <ActionButton onClick={run} busy={busy} disabled={!ready}>
            Protect PDF
          </ActionButton>
          {busy && <Progress value={progress} label="Encrypting with AES-256…" />}
          <InfoNote>
            Encryption: AES-256 (PDF 2.0 standard security handler, revision 6). Opens in current readers such as Adobe Reader (X or
            later), Chrome, Edge, Firefox and macOS Preview; very old readers can&apos;t open it. Nothing is uploaded: the password and the file stay on this device.
          </InfoNote>
        </div>
      )}
    </div>
  );
}
