"use client";

import { useEffect, useRef, useState } from "react";

import { uid, unrotate } from "@/lib/pdf/geometry";
import type { PdfPage } from "@/lib/pdf/pdfjs";
import { extractTextRuns, sampleColors, type TextRun } from "@/lib/pdf/textRuns";
import type { EditorObject, PageModel, PathObject, ShapeObject } from "@/lib/pdf/types";

import { useEditor } from "../store";
import { ObjectView, PathView, pathData } from "./ObjectView";

const DRAW_TOOLS = new Set(["rect", "ellipse", "line", "pen", "highlight", "whiteout"]);

function useInView<T extends Element>(ref: React.RefObject<T | null>, rootMargin: string): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

export function PageView({ page, index }: { page: PageModel; index: number }) {
  const doc = useEditor((s) => s.doc);
  const zoom = useEditor((s) => s.zoom);
  const tool = useEditor((s) => s.tool);
  const { addObject, select, setCurrent } = useEditor.getState();

  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfPageRef = useRef<PdfPage | null>(null);
  const [rendered, setRendered] = useState(0);
  const [runs, setRuns] = useState<TextRun[] | null>(null);
  const [draft, setDraft] = useState<EditorObject | null>(null);
  const dragStart = useRef<[number, number]>([0, 0]);
  const inView = useInView(outerRef, "800px");

  const W = page.width * zoom;
  const H = page.height * zoom;
  const sideways = page.rotation % 180 !== 0;

  // Track which page is "current" for the page tools and the sidebar.
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setCurrent(index), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [index, setCurrent]);

  // Render the original PDF page (only when near the viewport, re-rendered on zoom).
  useEffect(() => {
    if (!doc || page.src === null || !inView) return;
    let cancelled = false;
    let task: ReturnType<PdfPage["render"]> | null = null;
    (async () => {
      const p = await doc.getPage(page.src! + 1);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const vp = p.getViewport({ scale: zoom * (window.devicePixelRatio || 1) });
      const off = document.createElement("canvas");
      off.width = Math.floor(vp.width);
      off.height = Math.floor(vp.height);
      task = p.render({ canvas: off, viewport: vp });
      await task.promise;
      if (cancelled) return;
      // Swap in the finished render in one go so zooming never flashes a blank page.
      canvas.width = off.width;
      canvas.height = off.height;
      canvas.getContext("2d")?.drawImage(off, 0, 0);
      pdfPageRef.current = p;
      setRendered((n) => n + 1);
    })().catch((err: unknown) => {
      if ((err as Error)?.name !== "RenderingCancelledException") console.error("[editor] render failed", err);
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page.src, zoom, inView]);

  // Detect existing text lines when the user switches to "Edit text".
  useEffect(() => {
    if (tool !== "editText" || runs || !rendered || !pdfPageRef.current) return;
    extractTextRuns(pdfPageRef.current).then(setRuns, (err) => console.error("[editor] text extraction failed", err));
  }, [tool, runs, rendered]);

  /** Converts a pointer position to page units, undoing zoom and user rotation. */
  const toLocal = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = innerRef.current!.getBoundingClientRect();
    const [dx, dy] = unrotate(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), page.rotation);
    return [(dx + W / 2) / zoom, (dy + H / 2) / zoom];
  };

  const editRun = (run: TextRun) => {
    const canvas = canvasRef.current;
    const { bg, fg } = canvas ? sampleColors(canvas, run, canvas.width / page.width) : { bg: "#ffffff", fg: "#000000" };
    const id = uid();
    addObject(index, {
      id,
      type: "text",
      text: run.text,
      x: run.x,
      y: run.y,
      // A little slack so the original line doesn't wrap because of rounding.
      w: run.w + run.fontSize * 1.5,
      h: run.h,
      fontFamily: run.fontFamily,
      fontSize: run.fontSize,
      bold: run.bold,
      italic: run.italic,
      underline: false,
      color: fg,
      align: "left",
      cover: { x: run.x - 1, y: run.y, w: run.w + 2, h: run.h, color: bg },
      sourceKey: run.key,
      autoWidth: true,
    });
    select(id);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    if (e.button !== 0 || !(target === e.currentTarget || target === canvasRef.current || target.tagName === "svg")) return;
    const [x, y] = toLocal(e);
    const { drawStyle, textStyle } = useEditor.getState();

    if (tool === "text") {
      const id = uid();
      addObject(index, { id, type: "text", text: "", x, y: y - textStyle.fontSize * 0.6, w: 40, h: textStyle.fontSize * 1.2, autoWidth: true, ...textStyle });
      useEditor.getState().setTool("select");
      select(id);
      return;
    }
    if (!DRAW_TOOLS.has(tool)) {
      select(null);
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = [x, y];
    const id = uid();
    if (tool === "pen" || tool === "line") {
      setDraft({
        id,
        type: "path",
        points: [[x, y]],
        color: tool === "pen" ? drawStyle.penColor : drawStyle.stroke,
        width: tool === "pen" ? drawStyle.penWidth : drawStyle.strokeWidth,
        opacity: 1,
      });
    } else {
      const shape: ShapeObject = {
        id,
        type: tool === "ellipse" ? "ellipse" : "rect",
        x,
        y,
        w: 0,
        h: 0,
        stroke: tool === "rect" || tool === "ellipse" ? drawStyle.stroke : null,
        fill: tool === "highlight" ? "#fde047" : tool === "whiteout" ? "#ffffff" : drawStyle.fill,
        strokeWidth: drawStyle.strokeWidth,
        opacity: 1,
        highlight: tool === "highlight",
      };
      setDraft(shape);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draft) return;
    const [x, y] = toLocal(e);
    if (draft.type === "path") {
      setDraft({ ...draft, points: tool === "line" ? [draft.points[0], [x, y]] : [...draft.points, [x, y]] } as PathObject);
    } else if (draft.type !== "text" && draft.type !== "image") {
      const [startX, startY] = dragStart.current;
      setDraft({ ...draft, x: Math.min(x, startX), y: Math.min(y, startY), w: Math.abs(x - startX), h: Math.abs(y - startY) });
    }
  };

  const onPointerUp = () => {
    if (!draft) return;
    setDraft(null);
    if (draft.type === "path") {
      if (tool === "line" && draft.points.length < 2) return;
      addObject(index, draft);
    } else if (draft.type === "rect" || draft.type === "ellipse") {
      if (draft.w < 3 || draft.h < 3) return;
      addObject(index, draft);
    }
    if (tool === "rect" || tool === "ellipse" || tool === "line") {
      useEditor.getState().setTool("select");
      select(draft.id);
    }
  };

  const replaced = new Set(page.objects.flatMap((o) => (o.type === "text" && o.sourceKey ? [o.sourceKey] : [])));
  const interactive = !DRAW_TOOLS.has(tool);
  const paths = page.objects.filter((o): o is PathObject => o.type === "path");

  return (
    <div
      id={`page-${page.id}`}
      ref={outerRef}
      className="relative mx-auto shrink-0"
      style={{ width: sideways ? H : W, height: sideways ? W : H }}
    >
      <div
        ref={innerRef}
        role="region"
        aria-label={`Page ${index + 1}`}
        className={`absolute top-1/2 left-1/2 overflow-hidden bg-white shadow-[0_1px_4px_rgba(0,0,0,0.2)] ${
          tool === "text" ? "cursor-text" : DRAW_TOOLS.has(tool) ? "cursor-crosshair" : ""
        }`}
        style={{ width: W, height: H, transform: `translate(-50%, -50%) rotate(${page.rotation}deg)`, touchAction: DRAW_TOOLS.has(tool) ? "none" : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {page.src !== null && <canvas ref={canvasRef} className="absolute inset-0" style={{ width: W, height: H }} />}

        {tool === "editText" &&
          runs
            ?.filter((r) => !replaced.has(r.key))
            .map((r) => (
              <button
                key={r.key}
                type="button"
                title="Click to edit this text"
                aria-label={`Edit text: ${r.text}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => editRun(r)}
                className="absolute cursor-text rounded-[2px] bg-blue-500/5 outline outline-1 outline-blue-400/40 hover:bg-blue-500/15 hover:outline-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600"
                style={{ left: r.x * zoom, top: r.y * zoom, width: r.w * zoom, height: r.h * zoom }}
              />
            ))}

        {page.objects.map((o) => (
          <ObjectView key={o.id} obj={o} zoom={zoom} rotation={page.rotation} interactive={interactive} pageWidth={page.width} />
        ))}
        {draft && draft.type !== "path" && <ObjectView obj={draft} zoom={zoom} rotation={page.rotation} interactive={false} pageWidth={page.width} />}

        <svg
          className="pointer-events-none absolute inset-0"
          width={W}
          height={H}
          viewBox={`0 0 ${page.width} ${page.height}`}
        >
          {paths.map((p) => (
            <PathView key={p.id} obj={p} zoom={zoom} rotation={page.rotation} interactive={interactive} pageWidth={page.width} />
          ))}
          {draft?.type === "path" && (
            <path d={pathData(draft.points)} stroke={draft.color} strokeWidth={draft.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </div>
    </div>
  );
}
