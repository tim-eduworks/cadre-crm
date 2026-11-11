import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "CADRE Pipeline", description: "CADRE pipeline and contacts" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-500">
          Not for CUI or classified information.
        </footer>
      </body>
    </html>
  );
}
