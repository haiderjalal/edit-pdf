import { FileOutput, FileText, PencilLine } from "lucide-react";
import Link from "next/link";

import { HomeUpload } from "@/components/HomeUpload";
import { SiteShell } from "@/components/SiteShell";

const TOOLS = [
  {
    href: "/edit",
    icon: PencilLine,
    title: "Edit PDF",
    text: "Change existing text, add text boxes, images, shapes, highlights and signatures. Rotate, reorder and delete pages.",
  },
  {
    href: "/pdf-to-word",
    icon: FileText,
    title: "PDF to Word",
    text: "Turn a PDF into an editable DOCX that keeps paragraphs, tables, images and layout.",
  },
  {
    href: "/word-to-pdf",
    icon: FileOutput,
    title: "Word to PDF",
    text: "Convert DOCX, DOC, RTF or ODT into a PDF that looks exactly like the original.",
  },
];

export default function Home() {
  return (
    <SiteShell>
      <main>
        <section className="mx-auto max-w-3xl px-4 pt-14 pb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Edit PDFs like a Word document</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Free, fast and private. No account needed — just upload and start editing.
          </p>
          <div className="mt-8">
            <HomeUpload />
          </div>
        </section>
        <section aria-label="Tools" className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
          {TOOLS.map(({ href, icon: Icon, title, text }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow"
            >
              <Icon className="text-blue-700" />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </Link>
          ))}
        </section>
      </main>
    </SiteShell>
  );
}
