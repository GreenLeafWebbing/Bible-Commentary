import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOK_BY_ID } from "@/lib/books";
import { serverClient } from "@/lib/supabase";

export const revalidate = 60;

export default async function BookPage({ params }: { params: Promise<{ book: string }> }) {
  const { book: bookId } = await params;
  const book = BOOK_BY_ID.get(bookId.toUpperCase());
  if (!book) notFound();
  const { data } = await serverClient().from("commentaries").select("chapter").eq("book", book.id);
  const withNotes = new Set((data ?? []).map((r: { chapter: number }) => r.chapter));
  return (
    <>
      <h1>{book.name}</h1>
      <p className="muted small">Highlighted chapters have commentary.</p>
      <div className="chapter-grid">
        {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => (
          <Link key={c} href={`/read/${book.id}/${c}`} className={withNotes.has(c) ? "has-notes" : undefined}>{c}</Link>
        ))}
      </div>
    </>
  );
}
