import { ConversionError, pdfToDocx, wordToPdf } from "@/lib/server/convert";
import { fail, fileResponse, readUpload, sniff } from "@/lib/server/request";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/convert/[direction]">): Promise<Response> {
  const { direction } = await ctx.params;
  if (direction !== "pdf-to-word" && direction !== "word-to-pdf") return fail(404, "Unknown conversion.");

  const upload = await readUpload(req);
  if (upload instanceof Response) return upload;
  const { file, bytes } = upload;
  const kind = sniff(bytes, file.name);
  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^\w\- ]+/g, "_").slice(0, 100) || "document";

  try {
    if (direction === "pdf-to-word") {
      if (kind !== "pdf") return fail(415, "That file is not a PDF.");
      const out = await pdfToDocx(bytes);
      return fileResponse(out, `${baseName}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }
    if (!kind || kind === "pdf") return fail(415, "Please upload a Word document (.docx, .doc, .rtf or .odt).");
    const out = await wordToPdf(bytes, kind);
    return fileResponse(out, `${baseName}.pdf`, "application/pdf");
  } catch (err) {
    if (err instanceof ConversionError) return fail(422, err.message);
    console.error("[convert] unexpected error", err);
    return fail(500, "Something went wrong while converting. Please try again.");
  }
}
