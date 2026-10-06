import { Lock } from "lucide-react";
import Link from "next/link";

import { Brand, MUSME_URL } from "./Brand";

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
          <Brand />
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
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2">
            <Lock size={14} /> No sign-up. Editing happens in your browser; files sent to our server are deleted right after.
          </p>
          <p>
            PDFDesk is a product of{" "}
            <a href={MUSME_URL} target="_blank" rel="noopener" className="font-medium text-slate-700 hover:underline">
              Musme
            </a>{" "}
            · © {new Date().getFullYear()} musme.co
          </p>
        </div>
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
