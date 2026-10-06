import type * as PdfJs from "pdfjs-dist";

let lib: Promise<typeof PdfJs> | null = null;

/** Lazily loads pdf.js in the browser only (it needs DOM APIs) and wires up its worker. */
export function loadPdfJs(): Promise<typeof PdfJs> {
  lib ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return m;
  });
  return lib;
}

export type PdfDoc = PdfJs.PDFDocumentProxy;
export type PdfPage = PdfJs.PDFPageProxy;
