import type { PageModel } from "./types";

/**
 * Maps a point in page units (top-left origin, baseRotate applied) to PDF user space.
 * Mirrors the transform pdf.js uses for its viewports.
 */
export function toPdfPoint(page: Pick<PageModel, "view" | "baseRotate">, x: number, y: number): [number, number] {
  const [x0, y0, x1, y1] = page.view;
  switch (((page.baseRotate % 360) + 360) % 360) {
    case 90:
      return [x0 + y, y0 + x];
    case 180:
      return [x1 - x, y0 + y];
    case 270:
      return [x1 - y, y1 - x];
    default:
      return [x0 + x, y1 - y];
  }
}

/** Rotates a vector by -deg degrees (screen space, y down) — undoes a CSS rotate(deg). */
export function unrotate(dx: number, dy: number, deg: number): [number, number] {
  const r = (-deg * Math.PI) / 180;
  const c = Math.round(Math.cos(r));
  const s = Math.round(Math.sin(r));
  return [dx * c - dy * s, dx * s + dy * c];
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
