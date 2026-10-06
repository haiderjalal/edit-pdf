"use client";

import { Upload } from "lucide-react";
import { useId, useState } from "react";

interface Props {
  accept: string;
  hint: string;
  onFile: (file: File) => void;
  label?: string;
}

export function Dropzone({ accept, hint, onFile, label = "Choose a file" }: Props) {
  const [over, setOver] = useState(false);
  const id = useId();
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed bg-white px-6 py-12 text-center transition-colors focus-within:outline-2 focus-within:outline-blue-600 ${
        over ? "border-blue-600 bg-blue-50" : "border-slate-300 hover:border-blue-400"
      }`}
    >
      <Upload className="text-blue-700" size={36} />
      <span className="rounded-lg bg-blue-700 px-5 py-2.5 font-medium text-white shadow-sm">{label}</span>
      <span className="text-sm text-slate-500">or drop it here · {hint}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </label>
  );
}
