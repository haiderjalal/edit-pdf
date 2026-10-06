import { BASELINE_OFFSET, LINE_HEIGHT } from "./layout";
import { loadPdfJs, type PdfPage } from "./pdfjs";
import type { FontFamily, Rect } from "./types";

export interface TextRun extends Rect {
  key: string;
  text: string;
  fontSize: number;
  fontFamily: FontFamily;
  bold: boolean;
  italic: boolean;
}

interface RawItem {
  str: string;
  fontName: string;
  transform: number[];
  width: number;
  hasEOL: boolean;
}

function classifyFont(realName: string, generic: string): Pick<TextRun, "fontFamily" | "bold" | "italic"> {
  const n = realName.toLowerCase();
  const fontFamily: FontFamily = /courier|mono|consol|menlo/.test(n) || generic === "monospace"
    ? "mono"
    : /times|roman|georgia|garamond|cambria|book|minion|palatino/.test(n) || (generic === "serif" && !/sans/.test(n))
      ? "serif"
      : "sans";
  return {
    fontFamily,
    bold: /bold|black|heavy|semibold|demi/.test(n),
    italic: /italic|oblique/.test(n),
  };
}

/**
 * Extracts editable lines of text from a rendered page, in page units.
 * Adjacent fragments on the same baseline and font are merged so users edit whole phrases.
 */
export async function extractTextRuns(page: PdfPage): Promise<TextRun[]> {
  const pdfjs = await loadPdfJs();
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const runs: TextRun[] = [];
  let open: (TextRun & { fontName: string; baseline: number; end: number }) | null = null;

  for (const raw of content.items) {
    if (!("str" in raw)) continue;
    const item = raw as RawItem;
    const tx = pdfjs.Util.transform(viewport.transform, item.transform);
    if (Math.abs(tx[1]) > 0.01 || Math.abs(tx[2]) > 0.01) {
      open = null; // rotated/skewed text is not offered for inline editing
      continue;
    }
    const fontSize = Math.hypot(tx[2], tx[3]);
    const x = tx[4];
    const baseline = tx[5];
    const gap = open ? x - open.end : 0;

    if (open && open.fontName === item.fontName && Math.abs(open.baseline - baseline) < fontSize * 0.2 && gap > -fontSize * 0.3 && gap < fontSize) {
      const needsSpace = gap > fontSize * 0.15 && !open.text.endsWith(" ") && !item.str.startsWith(" ");
      open.text += (needsSpace ? " " : "") + item.str;
      open.end = x + item.width;
      open.w = open.end - open.x;
    } else if (item.str.trim()) {
      const style = content.styles[item.fontName];
      const realName = page.commonObjs.has(item.fontName)
        ? String((page.commonObjs.get(item.fontName) as { name?: string } | null)?.name ?? "")
        : "";
      const font = classifyFont(`${realName} ${style?.fontFamily ?? ""}`, style?.fontFamily ?? "");
      open = {
        key: `${runs.length}:${Math.round(x)}:${Math.round(baseline)}`,
        text: item.str,
        fontSize,
        ...font,
        x,
        y: baseline - fontSize * BASELINE_OFFSET[font.fontFamily],
        w: item.width,
        h: fontSize * LINE_HEIGHT,
        fontName: item.fontName,
        baseline,
        end: x + item.width,
      };
      runs.push(open);
    } else {
      open = null;
    }
    if (item.hasEOL) open = null;
  }
  return runs.map(({ key, text, fontSize, fontFamily, bold, italic, x, y, w, h }) => ({
    key,
    text: text.trim(),
    fontSize: Math.round(fontSize * 10) / 10,
    fontFamily,
    bold,
    italic,
    x,
    y,
    w,
    h,
  }));
}

const toHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/**
 * Reads the rendered page pixels around a text run to find its background colour (most common
 * colour on the border) and text colour (the pixel that differs most from the background).
 */
export function sampleColors(canvas: HTMLCanvasElement, rect: Rect, pxPerUnit: number): { bg: string; fg: string } {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const x = Math.max(0, Math.floor((rect.x - 2) * pxPerUnit));
  const y = Math.max(0, Math.floor((rect.y - 2) * pxPerUnit));
  const w = Math.min(canvas.width - x, Math.ceil((rect.w + 4) * pxPerUnit));
  const h = Math.min(canvas.height - y, Math.ceil((rect.h + 4) * pxPerUnit));
  if (!ctx || w <= 0 || h <= 0) return { bg: "#ffffff", fg: "#000000" };
  const data = ctx.getImageData(x, y, w, h).data;
  const px = (i: number, j: number) => {
    const o = (j * w + i) * 4;
    return [data[o], data[o + 1], data[o + 2]] as const;
  };

  const counts = new Map<string, number>();
  const border = (i: number, j: number) => {
    const k = px(i, j).join(",");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (let i = 0; i < w; i++) {
    border(i, 0);
    border(i, h - 1);
  }
  for (let j = 0; j < h; j++) {
    border(0, j);
    border(w - 1, j);
  }
  const bgKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "255,255,255";
  const bg = bgKey.split(",").map(Number) as [number, number, number];

  let best = 0;
  let fg: readonly [number, number, number] = [0, 0, 0];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const p = px(i, j);
      const d = Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]);
      if (d > best) {
        best = d;
        fg = p;
      }
    }
  }
  return { bg: toHex(...bg), fg: toHex(...fg) };
}
