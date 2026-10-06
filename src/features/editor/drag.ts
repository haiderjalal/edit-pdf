import { unrotate } from "@/lib/pdf/geometry";

/**
 * Tracks a pointer drag and reports the movement in page units, compensating for zoom and
 * page rotation. `onStart` runs on the first real movement, so a plain click records no undo step.
 */
export function startDrag(
  e: React.PointerEvent,
  opts: { zoom: number; rotation: number; onStart?: () => void; onMove: (dx: number, dy: number) => void },
): void {
  e.preventDefault();
  e.stopPropagation();
  const sx = e.clientX;
  const sy = e.clientY;
  let started = false;
  const move = (ev: PointerEvent) => {
    if (!started) {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 3) return;
      started = true;
      opts.onStart?.();
    }
    const [dx, dy] = unrotate(ev.clientX - sx, ev.clientY - sy, opts.rotation);
    opts.onMove(dx / opts.zoom, dy / opts.zoom);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}
