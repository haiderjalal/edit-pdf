import type { Metadata } from "next";

import { Converter } from "@/components/Converter";
import { ToolPage } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Word to PDF Converter — PDFDesk",
  description: "Convert DOCX, DOC, RTF or ODT documents to PDF with accurate layout. Free, no sign-up.",
};

export default function WordToPdfPage() {
  return (
    <ToolPage title="Word to PDF" subtitle="Convert DOCX, DOC, RTF or ODT into a pixel-accurate PDF.">
      <Converter direction="word-to-pdf" />
    </ToolPage>
  );
}
