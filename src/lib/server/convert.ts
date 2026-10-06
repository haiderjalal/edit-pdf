import "server-only";

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TIMEOUT_MS = 180_000;

export class ConversionError extends Error {}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: TIMEOUT_MS, windowsHide: true }, (err, _out, stderr) => {
      if (err) {
        console.error(`[convert] ${path.basename(cmd)} failed`, err.message, stderr?.slice(-2000));
        reject(new ConversionError("Conversion failed. The file may be damaged or protected."));
      } else resolve();
    });
  });
}

function findPython(): string {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
  const venv = path.join(process.cwd(), ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (existsSync(venv)) return venv;
  return process.platform === "win32" ? "python" : "python3";
}

function findSoffice(): string {
  if (process.env.SOFFICE_PATH) return process.env.SOFFICE_PATH;
  const candidates =
    process.platform === "win32"
      ? ["C:/Program Files/LibreOffice/program/soffice.exe", "C:/Program Files (x86)/LibreOffice/program/soffice.exe"]
      : process.platform === "darwin"
        ? ["/Applications/LibreOffice.app/Contents/MacOS/soffice"]
        : ["/usr/bin/soffice", "/usr/bin/libreoffice", "/opt/libreoffice/program/soffice"];
  const found = candidates.find((c) => existsSync(c));
  if (!found) throw new ConversionError("Word to PDF is unavailable: LibreOffice is not installed on the server.");
  return found;
}

/** Runs `fn` in a private temp dir that is always deleted afterwards (uploads are never kept). */
async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "pdfedit-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export function pdfToDocx(input: Uint8Array): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const src = path.join(dir, "input.pdf");
    const dst = path.join(dir, "output.docx");
    await writeFile(src, input);
    await run(findPython(), [path.join(process.cwd(), "scripts", "pdf_to_docx.py"), src, dst]);
    return readFile(dst);
  });
}

export function redactText(input: Uint8Array, rects: { page: number; rect: number[] }[]): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const src = path.join(dir, "input.pdf");
    const dst = path.join(dir, "output.pdf");
    const json = path.join(dir, "rects.json");
    await writeFile(src, input);
    await writeFile(json, JSON.stringify(rects));
    await run(findPython(), [path.join(process.cwd(), "scripts", "redact.py"), src, dst, json]);
    return readFile(dst);
  });
}

export function wordToPdf(input: Uint8Array, ext: string): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const src = path.join(dir, `input.${ext}`);
    await writeFile(src, input);
    // Own profile dir per call: LibreOffice refuses to run two conversions sharing one profile.
    const profile = pathToFileURL(path.join(dir, "profile")).href;
    await run(findSoffice(), [
      `-env:UserInstallation=${profile}`,
      "--headless",
      "--norestore",
      "--convert-to",
      "pdf",
      "--outdir",
      dir,
      src,
    ]);
    const out = (await readdir(dir)).find((f) => f.endsWith(".pdf"));
    if (!out) throw new ConversionError("Conversion failed. The document could not be rendered.");
    return readFile(path.join(dir, out));
  });
}
