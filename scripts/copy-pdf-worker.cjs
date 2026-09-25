/**
 * Copies the pdf.js worker used by react-pdf into public/ so the PDF preview loads it from
 * our own origin (the Content Security Policy does not allow third-party scripts).
 * Runs on postinstall; the worker version always matches the installed react-pdf.
 */
const fs = require("fs");
const path = require("path");

try {
  const reactPdfDir = path.dirname(require.resolve("react-pdf/package.json"));
  const pdfjsDir = path.dirname(
    require.resolve("pdfjs-dist/package.json", { paths: [reactPdfDir] })
  );
  const source = path.join(pdfjsDir, "build", "pdf.worker.min.mjs");
  const target = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");
  fs.copyFileSync(source, target);
  console.log(`pdf.js worker copied to public/ (${require(path.join(pdfjsDir, "package.json")).version})`);
} catch (error) {
  console.error("copy-pdf-worker: could not copy the pdf.js worker:", error);
  process.exitCode = 1;
}
