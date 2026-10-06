"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useEditor } from "@/features/editor/store";

import { Converter } from "./Converter";
import { Dropzone } from "./Dropzone";

/** PDFs open straight in the editor; Word files are converted to PDF. */
export function HomeUpload() {
  const router = useRouter();
  const [wordFile, setWordFile] = useState<File | null>(null);

  if (wordFile) return <Converter direction="word-to-pdf" initialFile={wordFile} />;

  return (
    <Dropzone
      accept="application/pdf,.pdf,.doc,.docx,.rtf,.odt"
      hint="PDF or Word"
      label="Upload a file"
      onFile={(file) => {
        if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
          useEditor.getState().setPending(file);
          router.push("/edit");
        } else setWordFile(file);
      }}
    />
  );
}
