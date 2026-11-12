// Copies the pdf.js worker, the tesseract.js worker + WASM core and the OCR
// language files into public/vendor so nothing loads from a third-party CDN
// and the tools keep working offline once loaded.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = (...p) => join(root, "node_modules", ...p);
const out = join(root, "public", "vendor");

const vendorTs = readFileSync(join(root, "lib", "vendor.ts"), "utf8");
const want = (name) => vendorTs.match(new RegExp(`${name} = "([^"]+)"`))[1];
const have = (pkg) => JSON.parse(readFileSync(nm(pkg, "package.json"), "utf8")).version;

for (const [constName, pkg] of [
  ["PDFJS_VERSION", "pdfjs-dist"],
  ["TESSERACT_VERSION", "tesseract.js"],
  ["TESSERACT_CORE_VERSION", "tesseract.js-core"],
]) {
  if (want(constName) !== have(pkg)) {
    console.error(
      `lib/vendor.ts has ${constName}="${want(constName)}" but ${pkg}@${have(pkg)} is installed. Update lib/vendor.ts.`
    );
    process.exit(1);
  }
}

rmSync(out, { recursive: true, force: true });
const copy = (src, destDir) => {
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, join(destDir, src.split("/").pop()));
};

copy(nm("pdfjs-dist", "build", "pdf.worker.min.mjs"), join(out, `pdfjs-${have("pdfjs-dist")}`));
copy(nm("tesseract.js", "dist", "worker.min.js"), join(out, `tesseract-${have("tesseract.js")}`));

const coreDir = join(out, `tesseract-core-${have("tesseract.js-core")}`);
for (const f of readdirSync(nm("tesseract.js-core"))) {
  // LSTM-only builds are all we use: smaller, and the best_int data is LSTM-only.
  if (/^tesseract-core(-simd|-relaxedsimd)?-lstm\.wasm\.js$/.test(f)) copy(nm("tesseract.js-core", f), coreDir);
}

const langDir = join(out, "tessdata-4.0.0_best_int");
for (const code of ["eng", "hin", "spa", "fra", "deu", "por"]) {
  const src = nm("@tesseract.js-data", code, "4.0.0_best_int", `${code}.traineddata.gz`);
  if (!existsSync(src)) {
    console.error(`Missing OCR language data: ${src}`);
    process.exit(1);
  }
  copy(src, langDir);
}

console.log("Copied pdf.js worker, tesseract worker/core and 6 OCR languages to public/vendor/");
