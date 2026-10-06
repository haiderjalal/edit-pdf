"use client";

import { create } from "zustand";

import { uid } from "@/lib/pdf/geometry";
import { loadPdfJs, type PdfDoc } from "@/lib/pdf/pdfjs";
import type { EditorObject, PageModel, TextStyle, Tool } from "@/lib/pdf/types";

const MAX_HISTORY = 100;
const A4: [number, number, number, number] = [0, 0, 595.28, 841.89];

export interface DrawStyle {
  stroke: string;
  fill: string | null;
  strokeWidth: number;
  penColor: string;
  penWidth: number;
}

interface EditorState {
  fileName: string;
  bytes: Uint8Array | null;
  doc: PdfDoc | null;
  pages: PageModel[];
  current: number;
  zoom: number;
  tool: Tool;
  selectedId: string | null;
  textStyle: TextStyle;
  drawStyle: DrawStyle;
  past: PageModel[][];
  future: PageModel[][];
  loading: boolean;
  error: string | null;
  /** File picked on another route, waiting to be opened by the editor. */
  pending: File | null;

  setPending: (file: File | null) => void;
  open: (file: File) => Promise<void>;
  close: () => void;
  setTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setCurrent: (index: number) => void;
  select: (id: string | null) => void;
  setTextStyle: (patch: Partial<TextStyle>) => void;
  setDrawStyle: (patch: Partial<DrawStyle>) => void;

  /** Saves the current pages to undo history. Call once before a change (or a drag). */
  checkpoint: () => void;
  addObject: (pageIndex: number, obj: EditorObject) => void;
  /** Updates an object without recording history (call checkpoint() first when needed). */
  patchObject: (id: string, patch: Partial<EditorObject>) => void;
  deleteObject: (id: string) => void;
  undo: () => void;
  redo: () => void;

  rotatePage: (index: number, delta: number) => void;
  deletePage: (index: number) => void;
  movePage: (index: number, delta: number) => void;
  insertBlankPage: (after: number) => void;
}

const DEFAULT_TEXT: TextStyle = {
  fontFamily: "sans",
  fontSize: 12,
  bold: false,
  italic: false,
  underline: false,
  color: "#000000",
  align: "left",
};

export const useEditor = create<EditorState>((set, get) => {
  /** Applies a change to pages, recording one undo step. */
  const commit = (fn: (pages: PageModel[]) => PageModel[]) => {
    get().checkpoint();
    set({ pages: fn(get().pages) });
  };

  const mapObjects = (fn: (o: EditorObject) => EditorObject | null) =>
    get().pages.map((p) => ({ ...p, objects: p.objects.flatMap((o) => fn(o) ?? []) }));

  return {
    fileName: "",
    bytes: null,
    doc: null,
    pages: [],
    current: 0,
    zoom: 1,
    tool: "select",
    selectedId: null,
    textStyle: DEFAULT_TEXT,
    drawStyle: { stroke: "#1d4ed8", fill: null, strokeWidth: 2, penColor: "#dc2626", penWidth: 2 },
    past: [],
    future: [],
    loading: false,
    error: null,
    pending: null,

    setPending: (pending) => set({ pending }),

    open: async (file) => {
      set({ loading: true, error: null });
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pdfjs = await loadPdfJs();
        // pdf.js transfers the buffer it is given to its worker, so hand it a copy.
        const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        const pages: PageModel[] = [];
        for (let i = 0; i < doc.numPages; i++) {
          const page = await doc.getPage(i + 1);
          const vp = page.getViewport({ scale: 1 });
          pages.push({
            id: uid(),
            src: i,
            view: page.view as PageModel["view"],
            baseRotate: page.rotate,
            rotation: 0,
            width: vp.width,
            height: vp.height,
            objects: [],
          });
        }
        get().doc?.loadingTask.destroy();
        set({
          fileName: file.name.replace(/\.pdf$/i, "") || "document",
          bytes,
          doc,
          pages,
          current: 0,
          zoom: typeof window !== "undefined" && window.innerWidth < 768 ? 0.6 : 1,
          tool: "select",
          selectedId: null,
          past: [],
          future: [],
          loading: false,
        });
      } catch (err) {
        console.error("[editor] failed to open PDF", err);
        const passwordProtected = err instanceof Error && err.name === "PasswordException";
        set({
          loading: false,
          error: passwordProtected
            ? "This PDF is password protected. Please remove the password and try again."
            : "We couldn't open that file. Please make sure it is a valid PDF.",
        });
      }
    },

    close: () => {
      get().doc?.loadingTask.destroy();
      set({ bytes: null, doc: null, pages: [], past: [], future: [], selectedId: null, fileName: "" });
    },

    setTool: (tool) => set({ tool, selectedId: null }),
    setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.25, Math.round(zoom * 100) / 100)) }),
    setCurrent: (current) => set({ current }),
    select: (selectedId) => {
      const obj = get().pages.flatMap((p) => p.objects).find((o) => o.id === selectedId);
      // Selecting a text box makes the ribbon reflect (and edit) its style, like Word.
      if (obj?.type === "text") {
        const { fontFamily, fontSize, bold, italic, underline, color, align } = obj;
        set({ selectedId, textStyle: { fontFamily, fontSize, bold, italic, underline, color, align } });
      } else set({ selectedId });
    },
    setTextStyle: (patch) => {
      const { selectedId } = get();
      const obj = get().pages.flatMap((p) => p.objects).find((o) => o.id === selectedId);
      if (obj?.type === "text") commit(() => mapObjects((o) => (o.id === selectedId ? { ...o, ...patch } : o)));
      set({ textStyle: { ...get().textStyle, ...patch } });
    },
    setDrawStyle: (patch) => set({ drawStyle: { ...get().drawStyle, ...patch } }),

    checkpoint: () => set({ past: [...get().past.slice(-MAX_HISTORY + 1), get().pages], future: [] }),

    addObject: (pageIndex, obj) =>
      commit((pages) => pages.map((p, i) => (i === pageIndex ? { ...p, objects: [...p.objects, obj] } : p))),

    patchObject: (id, patch) => set({ pages: mapObjects((o) => (o.id === id ? ({ ...o, ...patch } as EditorObject) : o)) }),

    deleteObject: (id) => {
      commit(() => mapObjects((o) => (o.id === id ? null : o)));
      if (get().selectedId === id) set({ selectedId: null });
    },

    undo: () => {
      const { past, pages, future } = get();
      if (!past.length) return;
      set({ pages: past[past.length - 1], past: past.slice(0, -1), future: [pages, ...future], selectedId: null });
    },
    redo: () => {
      const { past, pages, future } = get();
      if (!future.length) return;
      set({ pages: future[0], future: future.slice(1), past: [...past, pages], selectedId: null });
    },

    rotatePage: (index, delta) =>
      commit((pages) => pages.map((p, i) => (i === index ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p))),

    deletePage: (index) => {
      if (get().pages.length <= 1) return;
      commit((pages) => pages.filter((_, i) => i !== index));
      set({ current: Math.min(index, get().pages.length - 1) });
    },

    movePage: (index, delta) => {
      const to = index + delta;
      if (to < 0 || to >= get().pages.length) return;
      commit((pages) => {
        const next = [...pages];
        [next[index], next[to]] = [next[to], next[index]];
        return next;
      });
      set({ current: to });
    },

    insertBlankPage: (after) => {
      const ref = get().pages[after];
      // New pages match the size and orientation of the page they follow.
      const view: PageModel["view"] = ref ? [0, 0, ref.width, ref.height] : A4;
      const page: PageModel = {
        id: uid(),
        src: null,
        view,
        baseRotate: 0,
        rotation: ref?.rotation ?? 0,
        width: view[2],
        height: view[3],
        objects: [],
      };
      commit((pages) => [...pages.slice(0, after + 1), page, ...pages.slice(after + 1)]);
      set({ current: after + 1 });
    },
  };
});
