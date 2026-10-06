"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Circle,
  Eraser,
  FilePlus,
  FileText,
  FolderOpen,
  Highlighter,
  ImagePlus,
  Italic,
  Loader2,
  MousePointer2,
  Minus,
  PenLine,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Slash,
  Square,
  Trash2,
  Type,
  TextCursorInput,
  Underline,
  Undo2,
  X,
  Download,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import { Brand } from "@/components/Brand";

import { FONT_LABEL } from "@/lib/pdf/layout";
import type { FontFamily, Tool } from "@/lib/pdf/types";

import { downloadPdf, downloadWord, insertImage } from "../actions";
import { useEditor } from "../store";

const TABS = ["File", "Home", "Insert", "Draw", "Pages"] as const;
type Tab = (typeof TABS)[number];
const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

function Btn({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
  big,
  busy,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  big?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled || busy}
      onClick={onClick}
      className={`flex items-center justify-center rounded text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40 disabled:hover:bg-transparent ${
        active ? "bg-blue-100 text-blue-800 ring-1 ring-blue-300 hover:bg-blue-100" : ""
      } ${big ? "h-14 min-w-14 flex-col gap-1 px-1.5 text-[11px] leading-tight" : "h-7 min-w-7 px-1"}`}
    >
      {busy ? <Loader2 size={big ? 20 : 16} className="animate-spin" /> : <Icon size={big ? 20 : 16} />}
      {big && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 flex-col items-stretch border-r border-slate-200 px-2 last:border-r-0">
      <div className="flex flex-1 items-center gap-0.5">{children}</div>
      <div className="pt-0.5 text-center text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

function ColorPick({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label title={label} className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-slate-200">
      <span className="sr-only">{label}</span>
      <span className="h-4 w-4 rounded-sm border border-slate-400" style={{ background: value }} />
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
    </label>
  );
}

export function Ribbon({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("Home");
  const [busy, setBusy] = useState<"pdf" | "word" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  const s = useEditor();
  const toolBtn = (tool: Tool, icon: LucideIcon, label: string, big = true) => (
    <Btn icon={icon} label={label} big={big} active={s.tool === tool} onClick={() => s.setTool(s.tool === tool ? "select" : tool)} />
  );

  const run = async (kind: "pdf" | "word") => {
    setBusy(kind);
    setError(null);
    try {
      await (kind === "pdf" ? downloadPdf() : downloadWord());
    } catch (err) {
      console.error("[editor] export failed", err);
      setError(err instanceof Error && kind === "word" ? err.message : "Couldn't create the file. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const ts = s.textStyle;
  const ds = s.drawStyle;

  return (
    <header className="shrink-0 border-b border-slate-300 bg-white">
      <div className="flex items-center gap-3 bg-black px-3 py-1.5 text-white">
        <Brand tone="light" size={24} />
        <span className="hidden truncate text-sm text-slate-400 sm:inline" title={s.fileName}>
          {s.fileName}.pdf
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => run("word")}
            disabled={!!busy}
            className="hidden items-center gap-1.5 rounded px-3 py-1 text-sm hover:bg-white/10 disabled:opacity-60 sm:flex"
          >
            {busy === "word" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Export to Word
          </button>
          <button
            type="button"
            onClick={() => run("pdf")}
            disabled={!!busy}
            className="flex items-center gap-1.5 rounded bg-musme px-3 py-1 text-sm font-medium text-black hover:brightness-95 disabled:opacity-60"
          >
            {busy === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download PDF
          </button>
        </div>
      </div>

      <nav role="tablist" aria-label="Ribbon" className="flex gap-1 overflow-x-auto px-2 pt-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-t px-3 py-1 ${tab === t ? "border-b-2 border-blue-700 font-medium text-blue-800" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div role="tabpanel" aria-label={tab} className="flex h-[84px] items-stretch overflow-x-auto bg-slate-50 py-1.5">
        {tab === "File" && (
          <>
            <Group label="Document">
              <Btn big icon={FolderOpen} label="Open PDF" onClick={onOpen} />
              <Btn big icon={Download} label="Download PDF" busy={busy === "pdf"} onClick={() => run("pdf")} />
              <Btn big icon={FileText} label="Save as Word" busy={busy === "word"} onClick={() => run("word")} />
            </Group>
            <Group label="Close">
              <Btn big icon={X} label="Close file" onClick={onClose} />
            </Group>
          </>
        )}

        {tab === "Home" && (
          <>
            <Group label="Undo">
              <Btn icon={Undo2} label="Undo (Ctrl+Z)" onClick={s.undo} disabled={!s.past.length} />
              <Btn icon={Redo2} label="Redo (Ctrl+Y)" onClick={s.redo} disabled={!s.future.length} />
            </Group>
            <Group label="Editing">
              {toolBtn("select", MousePointer2, "Select")}
              {toolBtn("editText", TextCursorInput, "Edit text")}
              {toolBtn("text", Type, "Add text")}
            </Group>
            <Group label="Font">
              <div className="flex flex-col gap-1">
                <div className="flex gap-1">
                  <select
                    aria-label="Font"
                    value={ts.fontFamily}
                    onChange={(e) => s.setTextStyle({ fontFamily: e.target.value as FontFamily })}
                    className="h-7 w-40 rounded border border-slate-300 bg-white px-1 text-sm"
                  >
                    {(Object.keys(FONT_LABEL) as FontFamily[]).map((f) => (
                      <option key={f} value={f}>
                        {FONT_LABEL[f]}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Font size"
                    list="font-sizes"
                    type="number"
                    min={4}
                    max={200}
                    step={0.5}
                    value={ts.fontSize}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v >= 4 && v <= 200) s.setTextStyle({ fontSize: v });
                    }}
                    className="h-7 w-16 rounded border border-slate-300 bg-white px-1 text-sm"
                  />
                  <datalist id="font-sizes">
                    {FONT_SIZES.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
                <div className="flex gap-0.5">
                  <Btn icon={Bold} label="Bold" active={ts.bold} onClick={() => s.setTextStyle({ bold: !ts.bold })} />
                  <Btn icon={Italic} label="Italic" active={ts.italic} onClick={() => s.setTextStyle({ italic: !ts.italic })} />
                  <Btn icon={Underline} label="Underline" active={ts.underline} onClick={() => s.setTextStyle({ underline: !ts.underline })} />
                  <ColorPick label="Font colour" value={ts.color} onChange={(color) => s.setTextStyle({ color })} />
                </div>
              </div>
            </Group>
            <Group label="Paragraph">
              <Btn icon={AlignLeft} label="Align left" active={ts.align === "left"} onClick={() => s.setTextStyle({ align: "left" })} />
              <Btn icon={AlignCenter} label="Center" active={ts.align === "center"} onClick={() => s.setTextStyle({ align: "center" })} />
              <Btn icon={AlignRight} label="Align right" active={ts.align === "right"} onClick={() => s.setTextStyle({ align: "right" })} />
            </Group>
            <Group label="Selection">
              <Btn big icon={Trash2} label="Delete" disabled={!s.selectedId} onClick={() => s.selectedId && s.deleteObject(s.selectedId)} />
            </Group>
            <ZoomGroup />
          </>
        )}

        {tab === "Insert" && (
          <>
            <Group label="Text">{toolBtn("text", Type, "Text box")}</Group>
            <Group label="Images">
              <Btn big icon={ImagePlus} label="Picture" onClick={() => imageInput.current?.click()} />
            </Group>
            <Group label="Shapes">
              {toolBtn("rect", Square, "Rectangle")}
              {toolBtn("ellipse", Circle, "Ellipse")}
              {toolBtn("line", Slash, "Line")}
            </Group>
            <ShapeStyleGroup />
            <Group label="Markup">
              {toolBtn("highlight", Highlighter, "Highlight")}
              {toolBtn("whiteout", Eraser, "Whiteout")}
            </Group>
          </>
        )}

        {tab === "Draw" && (
          <>
            <Group label="Tools">
              {toolBtn("select", MousePointer2, "Select")}
              {toolBtn("pen", Pencil, "Pen")}
              {toolBtn("highlight", Highlighter, "Highlight")}
              {toolBtn("whiteout", Eraser, "Whiteout")}
            </Group>
            <Group label="Pen">
              <ColorPick label="Pen colour" value={ds.penColor} onChange={(penColor) => s.setDrawStyle({ penColor })} />
              <select
                aria-label="Pen thickness"
                value={ds.penWidth}
                onChange={(e) => s.setDrawStyle({ penWidth: Number(e.target.value) })}
                className="h-7 rounded border border-slate-300 bg-white px-1 text-sm"
              >
                {[1, 2, 3, 5, 8, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} pt
                  </option>
                ))}
              </select>
            </Group>
            <Group label="Lines">{toolBtn("line", PenLine, "Line")}</Group>
          </>
        )}

        {tab === "Pages" && (
          <>
            <Group label={`Page ${s.current + 1} of ${s.pages.length}`}>
              <Btn big icon={RotateCcw} label="Rotate left" onClick={() => s.rotatePage(s.current, -90)} />
              <Btn big icon={RotateCw} label="Rotate right" onClick={() => s.rotatePage(s.current, 90)} />
              <Btn big icon={ArrowUp} label="Move up" disabled={s.current === 0} onClick={() => s.movePage(s.current, -1)} />
              <Btn
                big
                icon={ArrowDown}
                label="Move down"
                disabled={s.current >= s.pages.length - 1}
                onClick={() => s.movePage(s.current, 1)}
              />
            </Group>
            <Group label="Insert / remove">
              <Btn big icon={FilePlus} label="Blank page" onClick={() => s.insertBlankPage(s.current)} />
              <Btn big icon={Trash2} label="Delete page" disabled={s.pages.length <= 1} onClick={() => s.deletePage(s.current)} />
            </Group>
            <ZoomGroup />
          </>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 border-t border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700">
          {error}
          <button type="button" className="ml-auto underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) insertImage(file).catch(() => setError("That image couldn't be read. Try a PNG or JPEG."));
        }}
      />
    </header>
  );
}

function ZoomGroup() {
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  return (
    <Group label="Zoom">
      <Btn icon={Minus} label="Zoom out" onClick={() => setZoom(zoom - 0.1)} />
      <button type="button" title="Reset to 100%" onClick={() => setZoom(1)} className="w-12 rounded text-sm hover:bg-slate-200">
        {Math.round(zoom * 100)}%
      </button>
      <Btn icon={Plus} label="Zoom in" onClick={() => setZoom(zoom + 0.1)} />
    </Group>
  );
}

function ShapeStyleGroup() {
  const ds = useEditor((s) => s.drawStyle);
  const setDrawStyle = useEditor((s) => s.setDrawStyle);
  return (
    <Group label="Shape style">
      <ColorPick label="Outline colour" value={ds.stroke} onChange={(stroke) => setDrawStyle({ stroke })} />
      <label className="flex items-center gap-1 text-xs text-slate-600">
        <input type="checkbox" checked={ds.fill !== null} onChange={(e) => setDrawStyle({ fill: e.target.checked ? "#bfdbfe" : null })} />
        Fill
      </label>
      {ds.fill !== null && <ColorPick label="Fill colour" value={ds.fill} onChange={(fill) => setDrawStyle({ fill })} />}
      <select
        aria-label="Outline thickness"
        value={ds.strokeWidth}
        onChange={(e) => setDrawStyle({ strokeWidth: Number(e.target.value) })}
        className="h-7 rounded border border-slate-300 bg-white px-1 text-sm"
      >
        {[0.5, 1, 2, 3, 4, 6].map((n) => (
          <option key={n} value={n}>
            {n} pt
          </option>
        ))}
      </select>
    </Group>
  );
}
