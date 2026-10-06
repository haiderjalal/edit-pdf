"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { Dropzone } from "@/components/Dropzone";

import { downloadPdf } from "../actions";
import { useEditor } from "../store";
import { PageView } from "./PageView";
import { Ribbon } from "./Ribbon";
import { Sidebar } from "./Sidebar";

const isTyping = (el: Element | null) => !!el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT");

export function Editor() {
  const doc = useEditor((s) => s.doc);
  const pages = useEditor((s) => s.pages);
  const loading = useEditor((s) => s.loading);
  const error = useEditor((s) => s.error);
  const pending = useEditor((s) => s.pending);
  const fileInput = useRef<HTMLInputElement>(null);

  // Open a file handed over from the home page.
  useEffect(() => {
    if (!pending) return;
    const { open, setPending } = useEditor.getState();
    setPending(null);
    open(pending);
  }, [pending]);

  // Word-style keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState();
      if (!s.doc) return;
      const mod = e.ctrlKey || e.metaKey;
      const typing = isTyping(document.activeElement);
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        downloadPdf().catch((err) => console.error("[editor] save failed", err));
      } else if (mod && !typing && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && !typing && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
      } else if (!typing && (e.key === "Delete" || e.key === "Backspace") && s.selectedId) {
        e.preventDefault();
        s.deleteObject(s.selectedId);
      } else if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur();
        s.setTool("select");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Warn before leaving with unsaved edits — nothing is stored on a server.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().past.length) e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const openPicker = () => fileInput.current?.click();

  if (!doc || pending) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-4">
        {loading || pending ? (
          <p role="status" className="flex items-center gap-2 text-slate-600">
            <Loader2 className="animate-spin" /> Opening your PDF…
          </p>
        ) : (
          <div className="w-full max-w-xl">
            <h1 className="mb-4 text-center text-2xl font-semibold text-slate-800">Edit a PDF</h1>
            <Dropzone accept="application/pdf,.pdf" hint="PDF files up to 100 MB" onFile={(f) => useEditor.getState().open(f)} />
            {error && (
              <p role="alert" className="mt-3 text-center text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
        )}
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-200">
      <Ribbon
        onOpen={openPicker}
        onClose={() => {
          if (!useEditor.getState().past.length || confirm("Close this file? Unsaved changes will be lost.")) useEditor.getState().close();
        }}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto" aria-label="Document">
          <div className="flex min-w-fit flex-col items-center gap-6 p-6">
            {pages.map((p, i) => (
              <PageView key={p.id} page={p} index={i} />
            ))}
          </div>
        </main>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && (!useEditor.getState().past.length || confirm("Open another file? Unsaved changes will be lost."))) {
            useEditor.getState().open(file);
          }
        }}
      />
    </div>
  );
}
