export type Direction = "pdf-to-word" | "word-to-pdf";

/** Sends a file to the conversion API and returns the converted file, or throws a user-friendly error. */
export async function convertFile(direction: Direction, file: File): Promise<Blob> {
  const body = new FormData();
  body.append("file", file);
  let res: Response;
  try {
    res = await fetch(`/api/convert/${direction}`, { method: "POST", body });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "Conversion failed. Please try again.");
  }
  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
