"use client";

import { convertFile, downloadBlob } from "@/lib/convertClient";
import { buildPdf, redactionRects } from "@/lib/pdf/export";
import { uid } from "@/lib/pdf/geometry";

import { useEditor } from "./store";

/** Asks the server to strip the original text under edited lines / whiteouts. */
async function removeOriginalText(bytes: Uint8Array, rects: ReturnType<typeof redactionRects>): Promise<Uint8Array> {
  const body = new FormData();
  body.append("file", new Blob([bytes as BlobPart], { type: "application/pdf" }), "document.pdf");
  body.append("rects", JSON.stringify(rects));
  const res = await fetch("/api/redact", { method: "POST", body });
  if (!res.ok) throw new Error(`redact failed: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function exportPdfBlob(): Promise<Blob> {
  const { bytes, pages } = useEditor.getState();
  const rects = redactionRects(pages);
  let base = bytes;
  let redacted = false;
  if (bytes && rects.length) {
    try {
      base = await removeOriginalText(bytes, rects);
      redacted = true;
    } catch (err) {
      // Still export: the edit is visually correct, the old text just remains hidden underneath.
      console.warn("[editor] could not remove original text, falling back to covering it", err);
    }
  }
  const data = await buildPdf(base, pages, { skipCovers: redacted });
  return new Blob([data as BlobPart], { type: "application/pdf" });
}

export async function downloadPdf(): Promise<void> {
  const blob = await exportPdfBlob();
  downloadBlob(blob, `${useEditor.getState().fileName}-edited.pdf`);
}

/** Saves the edited PDF, then converts it to Word on the server. */
export async function downloadWord(): Promise<void> {
  const { fileName } = useEditor.getState();
  const pdf = new File([await exportPdfBlob()], `${fileName}.pdf`, { type: "application/pdf" });
  const docx = await convertFile("pdf-to-word", pdf);
  downloadBlob(docx, `${fileName}.docx`);
}

const MAX_IMAGE_SIDE = 2400;

/** Normalises any browser-readable image to PNG/JPEG (the formats PDFs support), downscaling huge photos. */
async function readImage(file: File): Promise<{ src: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const src = file.type === "image/jpeg" ? canvas.toDataURL("image/jpeg", 0.92) : canvas.toDataURL("image/png");
  return { src, width, height };
}

export async function insertImage(file: File): Promise<void> {
  const { current, pages, addObject, select, setTool } = useEditor.getState();
  const page = pages[current];
  if (!page) return;
  const img = await readImage(file);
  const w = Math.min(img.width, page.width * 0.5);
  const h = (w * img.height) / img.width;
  const id = uid();
  setTool("select");
  addObject(current, { id, type: "image", src: img.src, x: (page.width - w) / 2, y: (page.height - h) / 3, w, h });
  select(id);
}
