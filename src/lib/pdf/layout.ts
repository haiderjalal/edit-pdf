import type { FontFamily } from "./types";

/** Line height used both by the on-screen text boxes and the exported PDF, so they match. */
export const LINE_HEIGHT = 1.2;

/**
 * Distance from the top of a CSS line box (line-height 1.2) to the text baseline, as a
 * fraction of font size. Derived from the ascent/descent of Arial, Times New Roman and
 * Courier New, which are metric-compatible with the PDF standard fonts we export with.
 */
export const BASELINE_OFFSET: Record<FontFamily, number> = {
  sans: 0.947,
  serif: 0.938,
  mono: 0.867,
};

export const CSS_FONT: Record<FontFamily, string> = {
  sans: 'Arial, Helvetica, "Liberation Sans", sans-serif',
  serif: '"Times New Roman", Times, "Liberation Serif", serif',
  mono: '"Courier New", Courier, "Liberation Mono", monospace',
};

export const FONT_LABEL: Record<FontFamily, string> = {
  sans: "Arial / Helvetica",
  serif: "Times New Roman",
  mono: "Courier New",
};

/** Word-wraps text the same way a textarea does: on spaces, breaking long words by character. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/(?<= )/)) {
      if (line !== "" && measure(line + word.trimEnd()) > maxWidth) {
        lines.push(line.trimEnd());
        line = "";
      }
      if (measure(word.trimEnd()) <= maxWidth) {
        line += word;
        continue;
      }
      for (const ch of word) {
        if (line !== "" && measure(line + ch) > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += ch;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
