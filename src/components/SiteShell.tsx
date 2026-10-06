import { FileText, Lock } from "lucide-react";
import Link from "next/link";

const NAV = [
  { href: "/edit", label: "Edit PDF" },
  { href: "/pdf-to-word", label: "PDF to Word" },
  { href: "/word-to-pdf", label: "Word to PDF" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-blue-700">
            <FileText /> PDFDesk
          </Link>
          <nav aria-label="Tools" className="flex gap-4 text-sm font-medium text-slate-600">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-blue-700">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-slate-200 bg-white">
        <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-4 text-sm text-slate-500">
          <Lock size={14} /> No sign-up. PDFs you edit never leave your browser; files sent for conversion are deleted right after.
        </p>
      </footer>
    </div>
  );
}

export function ToolPage({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <SiteShell>
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-center text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 mb-8 text-center text-slate-600">{subtitle}</p>
        {children}
      </main>
    </SiteShell>
  );
}
