import { BlendMode, degrees, LineCapStyle, PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

import { toPdfPoint } from "./geometry";
import { BASELINE_OFFSET, LINE_HEIGHT, wrapText } from "./layout";
import type { EditorObject, PageModel, TextObject } from "./types";

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const FONT_TABLE = {
  sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
  serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
  mono: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
} as const;

/**
 * Applies the editor model to the original PDF and returns the new file.
 * Original page content is preserved untouched; edits are drawn on top of it.
 */
export async function buildPdf(
  original: Uint8Array | null,
  pages: PageModel[],
  { skipCovers = false }: { skipCovers?: boolean } = {},
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const src = original ? await PDFDocument.load(original, { ignoreEncryption: true }) : null;

  const fonts = new Map<string, PDFFont>();
  const font = async (t: TextObject) => {
    const name = FONT_TABLE[t.fontFamily][(t.bold ? 1 : 0) + (t.italic ? 2 : 0)];
    if (!fonts.has(name)) fonts.set(name, await out.embedFont(name));
    return fonts.get(name)!;
  };

  const srcIndices = pages.flatMap((p) => (p.src === null ? [] : [p.src]));
  const copied = src ? await out.copyPages(src, srcIndices) : [];
  let next = 0;

  for (const page of pages) {
    const pdfPage =
      page.src === null ? out.addPage([page.view[2] - page.view[0], page.view[3] - page.view[1]]) : out.addPage(copied[next++]);
    pdfPage.setRotation(degrees((((page.baseRotate + page.rotation) % 360) + 360) % 360));
    for (const obj of page.objects) {
      // Once the original text has been removed, the background-coloured cover isn't needed.
      const o = skipCovers && obj.type === "text" ? { ...obj, cover: undefined } : obj;
      await drawObject(out, pdfPage, page, o, font);
    }
  }

  return out.save();
}

/**
 * Areas whose original text should be removed (edited lines and whiteouts), in PDF user space
 * of the source document. Shrunk inwards so neighbouring glyphs only partly covered survive —
 * the redaction engine removes any character its rectangle touches.
 */
export function redactionRects(pages: PageModel[]): { page: number; rect: [number, number, number, number] }[] {
  return pages.flatMap((page) => {
    if (page.src === null) return [];
    const src = page.src;
    return page.objects.flatMap((o) => {
      const r = o.type === "text" ? o.cover : o.type === "rect" && o.fill === "#ffffff" && !o.stroke ? o : null;
      if (!r) return [];
      const ix = Math.min(r.w * 0.35, 2.5);
      const iy = Math.min(r.h * 0.42, 6);
      const [ax, ay] = toPdfPoint(page, r.x + ix, r.y + iy);
      const [bx, by] = toPdfPoint(page, r.x + r.w - ix, r.y + r.h - iy);
      return [{ page: src, rect: [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)] as [number, number, number, number] }];
    });
  });
}

async function drawObject(
  doc: PDFDocument,
  pdfPage: PDFPage,
  page: PageModel,
  obj: EditorObject,
  font: (t: TextObject) => Promise<PDFFont>,
): Promise<void> {
  const rotate = degrees(page.baseRotate);
  const at = (x: number, y: number) => {
    const [px, py] = toPdfPoint(page, x, y);
    return { x: px, y: py };
  };

  switch (obj.type) {
    case "text": {
      if (obj.cover) {
        const c = obj.cover;
        pdfPage.drawRectangle({ ...at(c.x, c.y + c.h), width: c.w, height: c.h, color: hexToRgb(c.color), rotate });
      }
      const f = await font(obj);
      const size = obj.fontSize;
      const text = encodable(obj.text, f);
      const lines = wrapText(text, obj.w, (s) => f.widthOfTextAtSize(s, size));
      const color = hexToRgb(obj.color);
      lines.forEach((line, i) => {
        const width = f.widthOfTextAtSize(line, size);
        const dx = obj.align === "center" ? (obj.w - width) / 2 : obj.align === "right" ? obj.w - width : 0;
        const baseline = obj.y + i * size * LINE_HEIGHT + size * BASELINE_OFFSET[obj.fontFamily];
        if (line) pdfPage.drawText(line, { ...at(obj.x + dx, baseline), size, font: f, color, rotate });
        if (obj.underline && line) {
          const uy = baseline + size * 0.12;
          pdfPage.drawLine({ start: at(obj.x + dx, uy), end: at(obj.x + dx + width, uy), thickness: size / 16, color });
        }
      });
      return;
    }
    case "image": {
      const bytes = await fetch(obj.src).then((r) => r.arrayBuffer());
      const img = obj.src.startsWith("data:image/png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      pdfPage.drawImage(img, { ...at(obj.x, obj.y + obj.h), width: obj.w, height: obj.h, rotate });
      return;
    }
    case "rect":
    case "ellipse": {
      const style = {
        color: obj.fill ? hexToRgb(obj.fill) : undefined,
        borderColor: obj.stroke ? hexToRgb(obj.stroke) : undefined,
        borderWidth: obj.stroke ? obj.strokeWidth : 0,
        opacity: obj.opacity,
        borderOpacity: obj.opacity,
        blendMode: obj.highlight ? BlendMode.Multiply : undefined,
        rotate,
      };
      if (obj.type === "rect") {
        // Inset the border so it sits inside the box, matching CSS box-sizing: border-box.
        const b = obj.stroke ? obj.strokeWidth / 2 : 0;
        pdfPage.drawRectangle({ ...at(obj.x + b, obj.y + obj.h - b), width: obj.w - 2 * b, height: obj.h - 2 * b, ...style });
      } else {
        const b = obj.stroke ? obj.strokeWidth / 2 : 0;
        pdfPage.drawEllipse({ ...at(obj.x + obj.w / 2, obj.y + obj.h / 2), xScale: obj.w / 2 - b, yScale: obj.h / 2 - b, ...style });
      }
      return;
    }
    case "path": {
      // One SVG path (not many segments) so semi-transparent strokes don't darken where segments overlap.
      const pts = obj.points.length === 1 ? [obj.points[0], obj.points[0]] : obj.points;
      const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
      pdfPage.drawSvgPath(d, {
        ...at(0, 0),
        rotate,
        borderColor: hexToRgb(obj.color),
        borderWidth: obj.width,
        borderOpacity: obj.opacity,
        borderLineCap: LineCapStyle.Round,
        blendMode: obj.opacity < 1 ? BlendMode.Multiply : undefined,
      });
      return;
    }
  }
}

/** Standard PDF fonts only cover Latin-1; replace anything else so export never fails. */
function encodable(text: string, f: PDFFont): string {
  const ok = new Set(f.getCharacterSet());
  return [...text].map((ch) => (ch === "\n" || ok.has(ch.codePointAt(0)!) ? ch : "?")).join("");
}
