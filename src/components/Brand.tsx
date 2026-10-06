import Image from "next/image";
import Link from "next/link";

export const MUSME_URL = "https://musme.co";

/** Product logo + name, presented as a Musme product. `tone` adapts the text to light or dark bars. */
export function Brand({ tone = "dark", size = 28 }: { tone?: "dark" | "light"; size?: number }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="PDFDesk by Musme — home">
      <Image src="/brand/musme-logo.jpg" alt="" width={size} height={size} className="rounded-md" priority />
      <span className="flex items-baseline gap-1.5 leading-none">
        <span className={`text-lg font-semibold ${tone === "dark" ? "text-slate-900" : "text-white"}`}>PDFDesk</span>
        <span className={`text-xs font-medium ${tone === "dark" ? "text-slate-500" : "text-slate-300"}`}>by Musme</span>
      </span>
    </Link>
  );
}

export function PoweredByMusme({ className = "" }: { className?: string }) {
  return (
    <a href={MUSME_URL} target="_blank" rel="noopener" className={`inline-flex items-center gap-1.5 hover:underline ${className}`}>
      <Image src="/brand/musme-logo.jpg" alt="" width={16} height={16} className="rounded-sm" />
      Powered by musme.co
    </a>
  );
}
