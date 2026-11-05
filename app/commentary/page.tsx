import Link from "next/link";
import type { Metadata } from "next";
import { BOOKS, BOOK_BY_ID, formatRef, parseRef, refHref } from "@/lib/books";
import { serverClient, type Commentary } from "@/lib/supabase";
import { Markdown } from "@/lib/markdown";

export const revalidate = 60;
export const metadata: Metadata = { title: "All Commentary · Living Word Commentary" };

const ORDER = new Map(BOOKS.map((b, i) => [b.id, i]));

/** Bible order: book (Genesis → Revelation), chapter, whole-chapter notes first, then by verse. */
function canonical(a: Commentary, b: Commentary) {
  return (
    (ORDER.get(a.book) ?? 99) - (ORDER.get(b.book) ?? 99) ||
    a.chapter - b.chapter ||
    (a.verse_start ?? 0) - (b.verse_start ?? 0) ||
    (a.verse_end ?? 0) - (b.verse_end ?? 0) ||
    a.created_at.localeCompare(b.created_at)
  );
}

async function allNotes(): Promise<Commentary[]> {
  const sb = serverClient();
  const out: Commentary[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("commentaries").select("*").range(from, from + 999);
    if (error || !data?.length) break;
    out.push(...(data as Commentary[]));
    if (data.length < 1000) break;
  }
  return out.sort(canonical);
}

export default async function CommentaryIndex() {
  const notes = await allNotes();
  const byBook = new Map<string, Commentary[]>();
  for (const n of notes) byBook.set(n.book, [...(byBook.get(n.book) ?? []), n]);
  const books = [...byBook.keys()];

  return (
    <>
      <h1>All Commentary</h1>
      <p className="muted">Every note, in Bible order from Genesis to Revelation.</p>

      {notes.length === 0 ? (
        <div className="notice">No commentary yet. Check back soon.</div>
      ) : (
        <>
          <nav className="book-jump" aria-label="Jump to book">
            {books.map((id) => (
              <a key={id} href={`#${id}`} className="chip">{BOOK_BY_ID.get(id)?.name ?? id} <span className="muted">({byBook.get(id)!.length})</span></a>
            ))}
          </nav>
          {books.map((id) => (
            <section key={id} id={id} className="book-section">
              <h2>{BOOK_BY_ID.get(id)?.name ?? id}</h2>
              {byBook.get(id)!.map((n) => (
                <article key={n.id} className="note index-note">
                  <Link className="ref" href={`/read/${n.book}/${n.chapter}${n.verse_start ? `#v${n.verse_start}` : ""}`}>
                    {formatRef(n.book, n.chapter, n.verse_start, n.verse_end)} →
                  </Link>
                  {n.title && <h4>{n.title}</h4>}
                  <Markdown source={n.body} />
                  {n.cross_refs.length > 0 && (
                    <div className="xrefs">
                      <span className="small muted">See also:</span>
                      {n.cross_refs.map((r) => {
                        const p = parseRef(r);
                        return p ? <Link key={r} href={refHref(p)}>{r}</Link> : <span key={r} className="small">{r}</span>;
                      })}
                    </div>
                  )}
                </article>
              ))}
            </section>
          ))}
        </>
      )}
    </>
  );
}
