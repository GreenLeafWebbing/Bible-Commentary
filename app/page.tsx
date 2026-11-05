import Link from "next/link";
import { BOOKS } from "@/lib/books";

export default function Home() {
  const ot = BOOKS.filter((b) => b.testament === "OT");
  const nt = BOOKS.filter((b) => b.testament === "NT");
  return (
    <>
      <section className="hero">
        <h1>Living Word Commentary</h1>
        <p className="muted">
          Read the Scriptures and open commentary on a verse, passage, or chapter. Look for the{" "}
          <span className="plus" aria-hidden>+</span> beside the text.
        </p>
        <blockquote>“Your word is a lamp to my feet and a light to my path.” — Psalm 119:105</blockquote>
      </section>
      <h2>Old Testament</h2>
      <div className="book-grid">
        {ot.map((b) => <Link key={b.id} href={`/read/${b.id}`}>{b.name}</Link>)}
      </div>
      <h2>New Testament</h2>
      <div className="book-grid">
        {nt.map((b) => <Link key={b.id} href={`/read/${b.id}`}>{b.name}</Link>)}
      </div>
    </>
  );
}
