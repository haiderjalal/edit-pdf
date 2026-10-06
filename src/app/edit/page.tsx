import type { Metadata } from "next";

import { Editor } from "@/features/editor/components/Editor";

export const metadata: Metadata = {
  title: "Edit PDF — PDFDesk by Musme",
  description: "Edit PDF text, add images, shapes, highlights and drawings, and rearrange pages — free, no sign-up.",
};

export default function EditPage() {
  return <Editor />;
}
