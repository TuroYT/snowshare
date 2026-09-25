/**
 * Copies the pdf.js worker used by react-pdf into public/ so the PDF preview loads it from
 * our own origin (the Content Security Policy does not allow third-party scripts).
 * Runs on postinstall; the worker version always matches the installed react-pdf.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const resolver = createRequire(import.meta.url);
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  const reactPdfDir = path.dirname(resolver.resolve("react-pdf/package.json"));
  const pdfjsPackage = resolver.resolve("pdfjs-dist/package.json", { paths: [reactPdfDir] });
  const pdfjsDir = path.dirname(pdfjsPackage);
  const { version } = JSON.parse(fs.readFileSync(pdfjsPackage, "utf8"));

  fs.copyFileSync(
    path.join(pdfjsDir, "build", "pdf.worker.min.mjs"),
    path.join(repoRoot, "public", "pdf.worker.min.mjs")
  );
  console.log(`pdf.js worker ${version} copied to public/`);
} catch (error) {
  console.error("copy-pdf-worker: could not copy the pdf.js worker:", error);
  process.exitCode = 1;
}
