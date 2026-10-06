import type { Metadata } from "next";

import { Converter } from "@/components/Converter";
import { ToolPage } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "PDF to Word Converter — PDFDesk by Musme",
  description: "Convert PDF to an editable Word (DOCX) file, keeping text, tables, images and layout. Free, no sign-up.",
};

export default function PdfToWordPage() {
  return (
    <ToolPage title="PDF to Word" subtitle="Get an editable DOCX that keeps your text, tables, images and layout.">
      <Converter direction="pdf-to-word" />
    </ToolPage>
  );
}
