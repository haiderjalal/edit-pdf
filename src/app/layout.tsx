import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "PDFDesk by Musme — Edit PDFs like a Word document",
  applicationName: "PDFDesk by Musme",
  authors: [{ name: "Musme", url: "https://musme.co" }],
  publisher: "Musme",
  description: "Free online PDF editor and PDF/Word converter. No sign-up: upload, edit text, add images and shapes, and download. Powered by musme.co.",
  openGraph: { siteName: "PDFDesk by Musme", images: ["/brand/musme-logo.jpg"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
