/**
 * HEIC decoding for browsers that can't read iPhone photos natively.
 *
 * heic2any 0.0.4 bundles libheif (compiled to asm.js with Emscripten embind)
 * and runs it in a Worker built from a Blob. Embind generates functions with
 * `new Function(...)`, which our Content-Security-Policy forbids (no
 * 'unsafe-eval'), so the stock worker silently hangs in production.
 *
 * Fix without loosening the CSP: while heic2any's module runs, we intercept
 * the Blob it builds the worker from and swap the three eval-based embind
 * helpers for plain closures that do the same thing. If heic2any ever
 * changes and a patch no longer matches, the worker is left untouched and
 * the conversion times out with a clear message instead of hanging.
 */

type Heic2Any = (opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>;

const CREATE_NAMED_FN = "function QA(A,e){return function(){return e.apply(this,arguments)}}";

// craftInvokerFunction without eval: same argument checks, wire conversion,
// destructors and return conversion as the generated code.
const CRAFT_INVOKER = [
  "function xe(A,e,r,i,f){var n=e.length;n<2&&HA(\"argTypes array size mismatch! Must at least get return value and 'this' types!\");",
  "for(var t=null!==e[1]&&null!==r,o=!1,a=1;a<e.length;++a)if(null!==e[a]&&void 0===e[a].destructorFunction){o=!0;break}",
  "var c=\"void\"!==e[0].name,g=n-2;",
  "return function(){if(arguments.length!==g)HA(\"function \"+A+\" called with \"+arguments.length+\" arguments, expected \"+g+\" args!\");",
  "var s=o?[]:null,w=[f],tw,aw=[],a;",
  "if(t){tw=e[1].toWireType(s,this);w.push(tw)}",
  "for(a=0;a<g;++a){aw[a]=e[a+2].toWireType(s,arguments[a]);w.push(aw[a])}",
  "var rv=i.apply(null,w);",
  "if(o)CA(s);else for(a=t?1:2;a<e.length;++a){var x=e[a].destructorFunction;if(null!==x)x(1===a?tw:aw[a-2])}",
  "if(c)return e[0].fromWireType(rv)}}",
].join("");

function replaceBetween(src: string, start: string, end: string, replacement: string): string | null {
  const i = src.indexOf(start);
  if (i < 0) return null;
  const j = src.indexOf(end, i);
  if (j < 0) return null;
  return src.slice(0, i) + replacement + src.slice(j + end.length);
}

/** Make heic2any's worker source CSP-safe. Returns null if it doesn't look like the expected build. */
export function patchHeicWorkerSource(src: string): string | null {
  let s: string | null = src;
  s = replaceBetween(s, "function QA(A,e){return A=YA(A),new Function", "')(e)}", CREATE_NAMED_FN);
  if (!s) return null;
  s = replaceBetween(s, "function QA(A,e){return A=YA(A=A||", "')(e)}", CREATE_NAMED_FN);
  if (!s) return null;
  s = replaceBetween(s, 'new Function("dynCall","rawFunction",i)(A,n)', "(A,n)", "function(){return A.apply(null,[n].concat(Array.prototype.slice.call(arguments)))}");
  if (!s) return null;
  s = replaceBetween(s, "function xe(A,e,r,i,f){", "He(Function,d).apply(null,k)}", CRAFT_INVOKER);
  if (!s) return null;
  if (/new Function|[^.\w]Function\(/.test(s)) return null;
  return s;
}

let loader: Promise<Heic2Any> | null = null;

/** Load heic2any (about 1.3 MB) once, with its worker patched for our CSP. */
export function loadHeic2any(): Promise<Heic2Any> {
  if (!loader) {
    loader = (async () => {
      const OriginalBlob = window.Blob;
      class PatchingBlob extends OriginalBlob {
        constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
          const first = parts?.[0];
          if (parts && parts.length === 1 && typeof first === "string" && first.length > 1_000_000 && first.includes("heif_")) {
            const patched = patchHeicWorkerSource(first);
            super(patched ? [patched] : parts, options);
            // Diagnostic flag (checked by our browser tests).
            (window as unknown as { __heicWorkerPatched?: boolean }).__heicWorkerPatched = Boolean(patched);
          } else {
            super(parts, options);
          }
        }
      }
      window.Blob = PatchingBlob;
      try {
        const mod = await import("heic2any");
        return mod.default as Heic2Any;
      } finally {
        window.Blob = OriginalBlob;
      }
    })();
    loader.catch(() => {
      loader = null;
    });
  }
  return loader;
}

/** Convert a HEIC/HEIF file to a JPEG blob (first image of the file). */
export async function heicToJpegBlob(file: Blob, quality: number, timeoutMs = 90_000): Promise<Blob> {
  let heic2any: Heic2Any;
  try {
    heic2any = await loadHeic2any();
  } catch {
    throw new Error("Couldn't load the HEIC converter. Check your connection and reload the page.");
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("The HEIC converter stopped responding. Reload the page and try again, or try a smaller photo.")),
      timeoutMs
    );
  });
  try {
    const out = await Promise.race([heic2any({ blob: file, toType: "image/jpeg", quality }), timeout]);
    return Array.isArray(out) ? out[0] : out;
  } catch (e) {
    if (e instanceof Error && /stopped responding/.test(e.message)) throw e;
    const msg =
      typeof e === "string" ? e : e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
    if (/ERR_USER|not supported|format/i.test(msg)) {
      throw new Error("This doesn't look like a HEIC photo the converter can read. It may be damaged, or another format renamed to .heic.");
    }
    throw new Error("Couldn't convert this HEIC file. It may be damaged, or too large for this device's memory.");
  } finally {
    clearTimeout(timer);
  }
}
