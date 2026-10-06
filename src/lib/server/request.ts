import "server-only";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 10 * 60 * 1000;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// ponytail: per-process memory limiter; move to Redis/Upstash if you run multiple instances.
const hits = new Map<string, number[]>();

export function rateLimited(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  if (hits.size > 10_000) hits.clear();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

export type FileKind = "pdf" | "docx" | "doc" | "rtf" | "odt";

/** Detects file type from magic bytes — never trust the extension or MIME type alone. */
export function sniff(bytes: Uint8Array, name: string): FileKind | null {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 8));
  if (head.startsWith("%PDF-")) return "pdf";
  if (head.startsWith("PK\x03\x04")) return name.toLowerCase().endsWith(".odt") ? "odt" : "docx";
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return "doc";
  if (head.startsWith("{\\rtf")) return "rtf";
  return null;
}

export function fail(status: number, message: string): Response {
  return Response.json({ success: false, message }, { status });
}

/** Reads and size-checks the uploaded `file` field, or returns an error response. */
export async function readUpload(req: Request): Promise<{ file: File; bytes: Uint8Array; form: FormData } | Response> {
  if (rateLimited(req)) return fail(429, "Too many requests. Please wait a few minutes and try again.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return fail(400, "Please choose a file.");
  if (file.size === 0) return fail(400, "The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, "File is too large. The limit is 50 MB.");
  return { file, bytes: new Uint8Array(await file.arrayBuffer()), form };
}

export function fileResponse(data: Buffer, filename: string, type: string): Response {
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
