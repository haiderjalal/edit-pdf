"use client";

import { CheckCircle2, Download, Loader2, PencilLine, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useEditor } from "@/features/editor/store";
import { convertFile, downloadBlob, type Direction } from "@/lib/convertClient";

import { Dropzone } from "./Dropzone";

const CONFIG: Record<Direction, { accept: string; hint: string; ext: string; label: string }> = {
  "pdf-to-word": { accept: "application/pdf,.pdf", hint: "PDF up to 50 MB", ext: "docx", label: "Choose PDF" },
  "word-to-pdf": {
    accept: ".doc,.docx,.rtf,.odt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword",
    hint: "DOCX, DOC, RTF or ODT up to 50 MB",
    ext: "pdf",
    label: "Choose Word file",
  },
};

type State =
  | { step: "idle"; error?: string }
  | { step: "working"; name: string }
  | { step: "done"; name: string; blob: Blob };

export function Converter({ direction, initialFile }: { direction: Direction; initialFile?: File }) {
  const cfg = CONFIG[direction];
  const router = useRouter();
  const [state, setState] = useState<State>({ step: "idle" });

  const convert = async (file: File) => {
    const name = `${file.name.replace(/\.[^.]+$/, "")}.${cfg.ext}`;
    setState({ step: "working", name: file.name });
    try {
      const blob = await convertFile(direction, file);
      setState({ step: "done", name, blob });
      downloadBlob(blob, name);
    } catch (err) {
      setState({ step: "idle", error: err instanceof Error ? err.message : "Conversion failed. Please try again." });
    }
  };

  // A file dropped on the home page starts converting straight away.
  const started = useRef(false);
  useEffect(() => {
    if (!initialFile || started.current) return;
    started.current = true;
    convert(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  if (state.step === "working") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
        <Loader2 className="animate-spin text-blue-700" size={36} />
        <p className="font-medium text-slate-800">Converting {state.name}…</p>
        <p className="text-sm text-slate-500">Large documents can take up to a minute.</p>
      </div>
    );
  }

  if (state.step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
        <CheckCircle2 className="text-green-600" size={40} />
        <p className="font-medium text-slate-800">Your file is ready: {state.name}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => downloadBlob(state.blob, state.name)}
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800"
          >
            <Download size={18} /> Download again
          </button>
          {direction === "word-to-pdf" && (
            <button
              type="button"
              onClick={() => {
                useEditor.getState().setPending(new File([state.blob], state.name, { type: "application/pdf" }));
                router.push("/edit");
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              <PencilLine size={18} /> Edit this PDF
            </button>
          )}
          <button
            type="button"
            onClick={() => setState({ step: "idle" })}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={18} /> Convert another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Dropzone accept={cfg.accept} hint={cfg.hint} label={cfg.label} onFile={convert} />
      {state.error && (
        <p role="alert" className="mt-3 text-center text-sm text-red-600">
          {state.error}
        </p>
      )}
    </div>
  );
}
