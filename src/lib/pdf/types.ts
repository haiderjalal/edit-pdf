/**
 * Editor document model. All coordinates are in "page units": CSS pixels of the page at
 * zoom 1, origin top-left, in the page's own orientation (its built-in /Rotate applied,
 * user rotation NOT applied). 1 page unit == 1 PDF point.
 */

export type FontFamily = "sans" | "serif" | "mono";
export type Align = "left" | "center" | "right";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextStyle {
  fontFamily: FontFamily;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  align: Align;
}

export interface TextObject extends Rect, TextStyle {
  id: string;
  type: "text";
  text: string;
  /** Width grows with the text (until the user resizes the box manually). */
  autoWidth?: boolean;
  /** Present when this box replaces text that was already in the PDF. */
  cover?: Rect & { color: string };
  /** Identifies the original text run this box replaced, so it isn't offered for editing twice. */
  sourceKey?: string;
}

export interface ImageObject extends Rect {
  id: string;
  type: "image";
  /** PNG or JPEG data URL. */
  src: string;
}

export interface ShapeObject extends Rect {
  id: string;
  type: "rect" | "ellipse";
  stroke: string | null;
  fill: string | null;
  strokeWidth: number;
  opacity: number;
  /** Multiply blend, used by the highlighter so text stays readable underneath. */
  highlight?: boolean;
}

export interface PathObject {
  id: string;
  type: "path";
  points: [number, number][];
  color: string;
  width: number;
  opacity: number;
}

export type EditorObject = TextObject | ImageObject | ShapeObject | PathObject;

export interface PageModel {
  id: string;
  /** 0-based page index in the source PDF, or null for an inserted blank page. */
  src: number | null;
  /** PDF view box [x0, y0, x1, y1] in PDF user space. */
  view: [number, number, number, number];
  /** Rotation stored in the source PDF. */
  baseRotate: number;
  /** Extra rotation applied by the user (multiple of 90). */
  rotation: number;
  /** Page size in page units (baseRotate applied). */
  width: number;
  height: number;
  objects: EditorObject[];
}

export type Tool =
  | "select"
  | "editText"
  | "text"
  | "rect"
  | "ellipse"
  | "line"
  | "pen"
  | "highlight"
  | "whiteout";
