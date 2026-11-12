import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How It Works — Why Your PDFs Are Never Uploaded",
  description:
    "PDFCompact processes files in your browser with JavaScript and WebAssembly. Here's what runs where, what we can and can't see, and how to check it yourself.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14 w-full">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">How PDFCompact works, and why nothing is uploaded</h1>
      <div className="article mt-6">
        <p>
          Every tool on this site runs inside your web browser. When you open a tool page, your browser
          downloads the program, not the other way round. Your file is read from your device, changed in
          the page&apos;s memory, and saved back to your device. It is never sent to our servers, because
          there is no server-side part to send it to.
        </p>

        <h2>What runs where</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Part</th><th>Where it runs</th><th>What it does</th></tr>
            </thead>
            <tbody>
              <tr><td>The web page</td><td>Vercel&apos;s CDN (static HTML)</td><td>Delivers the page and the tool code. Same files for everyone.</td></tr>
              <tr><td>pdf-lib</td><td>Your browser</td><td>Reads and writes PDF structure: merge, split, rotate, sign, page numbers, passwords.</td></tr>
              <tr><td>pdf.js (Mozilla)</td><td>Your browser, in a Web Worker</td><td>Renders pages and reads their text: thumbnails, PDF to image, compare, compress.</td></tr>
              <tr><td>Tesseract (OCR)</td><td>Your browser, as WebAssembly</td><td>Recognises text in scans. Language files are served from our own domain and cached.</td></tr>
              <tr><td>Your file</td><td>Your device only</td><td>Held in the page&apos;s memory while you work, then saved to your downloads.</td></tr>
            </tbody>
          </table>
        </div>

        <h2>How to check it yourself</h2>
        <ol>
          <li>Open any tool, for example <Link href="/compress-pdf">Compress PDF</Link>, and wait for it to load.</li>
          <li>Turn off Wi-Fi or switch on airplane mode.</li>
          <li>Use the tool on a file. It still works, because nothing needs the network.</li>
        </ol>
        <p>
          You can also open your browser&apos;s developer tools, go to the Network tab and watch: when you
          process a file, no request carries it anywhere. The only requests are for the page&apos;s own
          code and, for OCR, the language file the first time you use it.
        </p>

        <h2>What we can and can&apos;t see</h2>
        <p>
          We can&apos;t see your files, their names or their contents, because they never reach us. We use
          Vercel Web Analytics, which counts page views without cookies and without identifying you. It
          tells us which tool pages are popular, nothing about what you did with them. See the{" "}
          <Link href="/privacy">Privacy Policy</Link> for details.
        </p>

        <h2>Limits that come from running on your device</h2>
        <p>
          Because your device does the work, its memory and speed set the limits. A recent laptop handles
          files of several hundred megabytes; a phone handles less. OCR and compression of long scanned
          documents can take a minute or more because they process every page image. Each tool&apos;s page
          has a limits table with the practical numbers for that tool.
        </p>

        <h2>Why we built it this way</h2>
        <p>
          People use PDF tools for CVs, passports, payslips, medical letters and contracts. Uploading those
          to an unknown server is a real risk, and it&apos;s slow on mobile connections. Doing the work in
          the browser removes the risk and the wait, and it keeps the site cheap enough to run that every
          tool can stay free without a sign-up wall.
        </p>
      </div>
    </div>
  );
}
