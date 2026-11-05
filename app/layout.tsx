import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Living Word Commentary",
  description: "A personal Bible commentary — verse by verse, passage by passage, to the glory of Jesus Christ.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site">
          <div className="container">
            <Link href="/" className="brand">Living <span>Word</span> Commentary</Link>
            <nav className="site">
              <Link href="/">Books</Link>
              <Link href="/admin">Write</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site">
          <div className="container">
            “For the word of God is living and powerful…” — Hebrews 4:12 (NKJV)
          </div>
        </footer>
      </body>
    </html>
  );
}
