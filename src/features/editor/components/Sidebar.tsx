"use client";

import { RotateCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { PageModel } from "@/lib/pdf/types";

import { useEditor } from "../store";

const THUMB_WIDTH = 120;

function Thumbnail({ page, index }: { page: PageModel; index: number }) {
  const doc = useEditor((s) => s.doc);
  const active = useEditor((s) => s.current === index);
  const canDelete = useEditor((s) => s.pages.length > 1);
  const { rotatePage, deletePage } = useEditor.getState();
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !doc || page.src === null) return;
    let task: { cancel: () => void } | null = null;
    doc
      .getPage(page.src + 1)
      .then((p) => {
        const canvas = ref.current;
        if (!canvas) return;
        const vp = p.getViewport({ scale: (THUMB_WIDTH / page.width) * (window.devicePixelRatio || 1) });
        canvas.width = vp.width;
        canvas.height = vp.height;
        const t = p.render({ canvas, viewport: vp });
        task = t;
        return t.promise;
      })
      .catch(() => {});
    return () => task?.cancel();
  }, [visible, doc, page.src, page.width]);

  const h = (THUMB_WIDTH * page.height) / page.width;
  return (
    <li className="group relative flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={`Go to page ${index + 1}`}
        aria-current={active ? "page" : undefined}
        onClick={() => document.getElementById(`page-${page.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className={`rounded-sm bg-white p-0.5 shadow ${active ? "ring-2 ring-blue-600" : "ring-1 ring-slate-300 hover:ring-blue-300"}`}
      >
        <canvas
          ref={ref}
          className="block bg-white"
          style={{ width: THUMB_WIDTH, height: h, transform: `rotate(${page.rotation}deg)`, transition: "transform .2s" }}
        />
      </button>
      <span className="text-xs text-slate-600">{index + 1}</span>
      <div className="absolute top-1 right-3 hidden gap-0.5 group-focus-within:flex group-hover:flex">
        <button type="button" aria-label={`Rotate page ${index + 1}`} onClick={() => rotatePage(index, 90)} className="rounded bg-white/90 p-1 shadow hover:bg-white">
          <RotateCw size={13} />
        </button>
        {canDelete && (
          <button type="button" aria-label={`Delete page ${index + 1}`} onClick={() => deletePage(index)} className="rounded bg-white/90 p-1 text-red-600 shadow hover:bg-white">
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </li>
  );
}

export function Sidebar() {
  const pages = useEditor((s) => s.pages);
  return (
    <aside aria-label="Pages" className="hidden w-44 shrink-0 overflow-y-auto border-r border-slate-300 bg-slate-100 py-3 md:block">
      <ol className="flex flex-col gap-3">
        {pages.map((p, i) => (
          <Thumbnail key={p.id} page={p} index={i} />
        ))}
      </ol>
    </aside>
  );
}
