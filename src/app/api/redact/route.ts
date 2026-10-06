import { ConversionError, redactText } from "@/lib/server/convert";
import { fail, fileResponse, readUpload, sniff } from "@/lib/server/request";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_RECTS = 5000;

interface RedactRect {
  page: number;
  rect: [number, number, number, number];
}

function parseRects(raw: unknown): RedactRect[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_RECTS) return null;
  const ok = raw.every(
    (r) =>
      Number.isInteger(r?.page) &&
      r.page >= 0 &&
      Array.isArray(r.rect) &&
      r.rect.length === 4 &&
      r.rect.every((v: unknown) => typeof v === "number" && Number.isFinite(v)),
  );
  return ok ? (raw as RedactRect[]) : null;
}

/** Removes the original text under edited/whited-out areas so it can't be copied or extracted. */
export async function POST(req: Request): Promise<Response> {
  const upload = await readUpload(req);
  if (upload instanceof Response) return upload;
  const { file, bytes, form } = upload;
  if (sniff(bytes, file.name) !== "pdf") return fail(415, "That file is not a PDF.");

  let rects: RedactRect[] | null = null;
  try {
    rects = parseRects(JSON.parse(String(form.get("rects") ?? "")));
  } catch {
    rects = null;
  }
  if (!rects) return fail(400, "Invalid edit areas.");

  try {
    return fileResponse(await redactText(bytes, rects), "redacted.pdf", "application/pdf");
  } catch (err) {
    if (err instanceof ConversionError) return fail(422, err.message);
    console.error("[redact] unexpected error", err);
    return fail(500, "Something went wrong. Please try again.");
  }
}
