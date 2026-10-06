"use client";

import { Move } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";

import { CSS_FONT, LINE_HEIGHT } from "@/lib/pdf/layout";
import type { EditorObject, ImageObject, PathObject, ShapeObject, TextObject } from "@/lib/pdf/types";

import { startDrag } from "../drag";
import { useEditor } from "../store";

interface Props {
  obj: EditorObject;
  zoom: number;
  rotation: number;
  /** False while a drawing tool is active, so strokes can pass over existing objects. */
  interactive: boolean;
  /** Page width in page units; auto-growing text boxes stop at the right margin. */
  pageWidth: number;
}

export function ObjectView({ obj, ...rest }: Props) {
  if (obj.type === "path") return null; // paths are rendered in the page's SVG layer
  if (obj.type === "text") return <TextBox obj={obj} {...rest} />;
  return <BoxObject obj={obj} {...rest} />;
}

function useObjectActions(obj: EditorObject, zoom: number, rotation: number) {
  const { select, checkpoint, patchObject } = useEditor.getState();
  const selected = useEditor((s) => s.selectedId === obj.id);

  const move = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    select(obj.id);
    const origin = obj;
    startDrag(e, {
      zoom,
      rotation,
      onStart: checkpoint,
      onMove: (dx, dy) =>
        origin.type === "path"
          ? patchObject(origin.id, { points: origin.points.map(([x, y]) => [x + dx, y + dy]) })
          : patchObject(origin.id, { x: origin.x + dx, y: origin.y + dy }),
    });
  };

  const resize = (e: React.PointerEvent) => {
    if (obj.type === "path") return;
    const origin = obj;
    const ratio = origin.h / origin.w;
    startDrag(e, {
      zoom,
      rotation,
      onStart: checkpoint,
      onMove: (dx) => {
        const w = Math.max(10, origin.w + dx);
        // A manual resize fixes the width, like turning off "resize shape to fit text" in Word.
        patchObject(origin.id, origin.type === "image" ? { w, h: w * ratio } : { w, autoWidth: false });
      },
    });
  };

  const resizeBoth = (e: React.PointerEvent) => {
    if (obj.type === "path") return;
    const origin = obj;
    startDrag(e, {
      zoom,
      rotation,
      onStart: checkpoint,
      onMove: (dx, dy) => patchObject(origin.id, { w: Math.max(4, origin.w + dx), h: Math.max(4, origin.h + dy) }),
    });
  };

  return { selected, move, resize, resizeBoth };
}

function Handle({ onPointerDown, label }: { onPointerDown: (e: React.PointerEvent) => void; label: string }) {
  return (
    <span
      role="presentation"
      aria-label={label}
      onPointerDown={onPointerDown}
      className="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-blue-600 shadow"
    />
  );
}

function TextBox({ obj, zoom, rotation, interactive, pageWidth }: Props & { obj: TextObject }) {
  const { selected, move, resize } = useObjectActions(obj, zoom, rotation);
  const { select, checkpoint, patchObject, deleteObject } = useEditor.getState();
  const ref = useRef<HTMLTextAreaElement>(null);
  const editedSinceFocus = useRef(false);

  // A freshly created/converted box is focused immediately so the user can start typing.
  useEffect(() => {
    if (useEditor.getState().selectedId !== obj.id || !ref.current) return;
    ref.current.focus();
    ref.current.setSelectionRange(obj.text.length, obj.text.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Size follows the content: width grows with the longest line (up to the page margin) for
  // auto-width boxes, and height always fits the wrapped text.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const patch: Partial<TextObject> = {};
    let w = obj.w;
    if (obj.autoWidth) {
      el.style.whiteSpace = "pre";
      el.style.width = "0px";
      // Half an em of slack so PDF font metrics never wrap a line the browser kept on one.
      const needed = el.scrollWidth / zoom + obj.fontSize * 0.5;
      el.style.whiteSpace = "";
      el.style.width = "";
      w = Math.max(obj.fontSize, Math.min(needed, pageWidth - obj.x - 4));
      if (Math.abs(w - obj.w) > 0.5) patch.w = w;
    }
    el.style.width = `${w * zoom}px`;
    el.style.height = "0px";
    const h = el.scrollHeight / zoom;
    el.style.height = "";
    el.style.width = "";
    if (Math.abs(h - obj.h) > 0.5) patch.h = h;
    if (patch.w !== undefined || patch.h !== undefined) patchObject(obj.id, patch);
  }, [obj.text, obj.w, obj.h, obj.x, obj.autoWidth, obj.fontSize, obj.fontFamily, obj.bold, obj.italic, zoom, pageWidth, obj.id, patchObject]);

  return (
    <>
      {obj.cover && (
        <div
          className="absolute"
          style={{
            left: obj.cover.x * zoom,
            top: obj.cover.y * zoom,
            width: obj.cover.w * zoom,
            height: obj.cover.h * zoom,
            background: obj.cover.color,
          }}
        />
      )}
      <div
        className={`group absolute ${selected ? "outline outline-1 outline-blue-500" : interactive ? "hover:outline hover:outline-1 hover:outline-blue-300" : ""}`}
        style={{ left: obj.x * zoom, top: obj.y * zoom, width: obj.w * zoom, height: obj.h * zoom, pointerEvents: interactive ? "auto" : "none" }}
      >
        <textarea
          ref={ref}
          value={obj.text}
          aria-label="Text box"
          spellCheck
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!selected) select(obj.id);
          }}
          onFocus={() => {
            editedSinceFocus.current = false;
            if (!selected) select(obj.id);
          }}
          onChange={(e) => {
            if (!editedSinceFocus.current) {
              checkpoint();
              editedSinceFocus.current = true;
            }
            patchObject(obj.id, { text: e.target.value });
          }}
          onBlur={() => {
            // An empty new box is just noise; an empty replacement box still hides the original text.
            if (!obj.text.trim() && !obj.cover) deleteObject(obj.id);
          }}
          className="block h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
          style={{
            fontFamily: CSS_FONT[obj.fontFamily],
            fontSize: obj.fontSize * zoom,
            lineHeight: LINE_HEIGHT,
            fontWeight: obj.bold ? 700 : 400,
            fontStyle: obj.italic ? "italic" : "normal",
            textDecoration: obj.underline ? "underline" : "none",
            color: obj.color,
            textAlign: obj.align,
          }}
        />
        {selected && (
          <>
            <button
              type="button"
              aria-label="Move text box"
              onPointerDown={move}
              className="absolute -top-6 left-0 flex h-5 w-5 cursor-move items-center justify-center rounded bg-blue-600 text-white shadow"
            >
              <Move size={12} />
            </button>
            <Handle onPointerDown={resize} label="Resize text box" />
          </>
        )}
      </div>
    </>
  );
}

function BoxObject({ obj, zoom, rotation, interactive }: Props & { obj: ImageObject | ShapeObject }) {
  const { selected, move, resizeBoth, resize } = useObjectActions(obj, zoom, rotation);
  const style: React.CSSProperties = {
    left: obj.x * zoom,
    top: obj.y * zoom,
    width: obj.w * zoom,
    height: obj.h * zoom,
    pointerEvents: interactive ? "auto" : "none",
  };

  return (
    <div
      className={`absolute cursor-move ${selected ? "outline outline-1 outline-offset-2 outline-blue-500" : ""}`}
      style={{ ...style, mixBlendMode: obj.type !== "image" && obj.highlight ? "multiply" : undefined }}
      onPointerDown={move}
    >
      {obj.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-supplied data URL, not an optimisable asset
        <img src={obj.src} alt="" draggable={false} className="h-full w-full select-none" />
      ) : (
        <div
          className="h-full w-full"
          style={{
            background: obj.fill ?? "transparent",
            border: obj.stroke ? `${obj.strokeWidth * zoom}px solid ${obj.stroke}` : undefined,
            borderRadius: obj.type === "ellipse" ? "50%" : 0,
            opacity: obj.opacity,
          }}
        />
      )}
      {selected && <Handle onPointerDown={obj.type === "image" ? resize : resizeBoth} label="Resize" />}
    </div>
  );
}

export function PathView({ obj, zoom, rotation, interactive }: Props & { obj: PathObject }) {
  const { selected, move } = useObjectActions(obj, zoom, rotation);
  const d = pathData(obj.points);
  return (
    <g>
      {/* Wide invisible stroke makes thin lines easy to click. */}
      <path
        d={d}
        stroke="transparent"
        strokeWidth={Math.max(obj.width, 10 / zoom)}
        fill="none"
        strokeLinecap="round"
        style={{ pointerEvents: interactive ? "stroke" : "none", cursor: "move" }}
        onPointerDown={move}
      />
      <path
        d={d}
        stroke={obj.color}
        strokeWidth={obj.width}
        strokeOpacity={obj.opacity}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: "none", mixBlendMode: obj.opacity < 1 ? "multiply" : undefined }}
      />
      {selected && <PathBounds obj={obj} />}
    </g>
  );
}

function PathBounds({ obj }: { obj: PathObject }) {
  const xs = obj.points.map((p) => p[0]);
  const ys = obj.points.map((p) => p[1]);
  const pad = obj.width / 2 + 2;
  return (
    <rect
      x={Math.min(...xs) - pad}
      y={Math.min(...ys) - pad}
      width={Math.max(...xs) - Math.min(...xs) + pad * 2}
      height={Math.max(...ys) - Math.min(...ys) + pad * 2}
      fill="none"
      stroke="#3b82f6"
      strokeWidth={1}
      strokeDasharray="4 3"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}

export function pathData(points: [number, number][]): string {
  if (points.length === 1) return `M${points[0][0]} ${points[0][1]} l0.01 0`;
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
}
