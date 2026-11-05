import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BOOK_BY_ID, BOOKS } from "@/lib/books";
import { cookies } from "next/headers";
import { availableVersions, getChapter } from "@/lib/youversion";
import { serverClient, type Commentary } from "@/lib/supabase";
import Reader from "@/components/Reader";

export const revalidate = 60;

type Params = Promise<{ book: string; chapter: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { book, chapter } = await params;
  const b = BOOK_BY_ID.get(book.toUpperCase());
  return { title: b ? `${b.name} ${chapter} · Living Word Commentary` : "Living Word Commentary" };
}

function neighbor(bookId: string, chapter: number, dir: 1 | -1) {
  const idx = BOOKS.findIndex((b) => b.id === bookId);
  const book = BOOKS[idx];
  const c = chapter + dir;
  if (c >= 1 && c <= book.chapters) return { book, chapter: c };
  const next = BOOKS[idx + dir];
  if (!next) return undefined;
  return { book: next, chapter: dir === 1 ? 1 : next.chapters };
}

export default async function ChapterPage({ params, searchParams }: { params: Params; searchParams: Promise<{ v?: string }> }) {
  const { book: bookParam, chapter: chapterParam } = await params;
  const { v } = await searchParams;
  const requested = v ?? (await cookies()).get("bv")?.value;
  const book = BOOK_BY_ID.get(bookParam.toUpperCase());
  const chapter = Number(chapterParam);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) notFound();

  const [bible, versions, notes] = await Promise.all([
    getChapter(book.id, chapter, requested),
    availableVersions(),
    serverClient()
      .from("commentaries")
      .select("*")
      .eq("book", book.id)
      .eq("chapter", chapter)
      .order("verse_start", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true }),
  ]);

  const prev = neighbor(book.id, chapter, -1);
  const next = neighbor(book.id, chapter, 1);

  return (
    <>
      <p className="small" style={{ marginTop: 24 }}><Link href={`/read/${book.id}`}>← {book.name}</Link></p>
      <Reader
        bookId={book.id}
        bookName={book.name}
        chapter={chapter}
        bible={bible}
        versions={versions}
        notes={(notes.data ?? []) as Commentary[]}
      />
      <div className="chapter-nav">
        {prev ? <Link className="btn" href={`/read/${prev.book.id}/${prev.chapter}`}>← {prev.book.name} {prev.chapter}</Link> : <span />}
        {next ? <Link className="btn" href={`/read/${next.book.id}/${next.chapter}`}>{next.book.name} {next.chapter} →</Link> : <span />}
      </div>
    </>
  );
}
