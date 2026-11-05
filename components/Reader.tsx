"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Commentary } from "@/lib/supabase";
import { browserClient } from "@/lib/supabase";
import type { ChapterResult } from "@/lib/youversion";
import { formatRef, parseRef, refHref } from "@/lib/books";
import { Markdown } from "@/lib/markdown";

type Props = { bookId: string; bookName: string; chapter: number; bible: ChapterResult; notes: Commentary[] };
type Selection = { kind: "chapter" } | { kind: "verse"; start: number };

export default function Reader({ bookId, bookName, chapter, bible, notes }: Props) {
  const [sel, setSel] = useState<Selection | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    browserClient().rpc("is_admin").then(({ data }) => setIsAdmin(data === true));
  }, []);

  const chapterNotes = notes.filter((n) => n.verse_start == null);
  const byStart = useMemo(() => {
    const m = new Map<number, Commentary[]>();
    for (const n of notes) if (n.verse_start != null) m.set(n.verse_start, [...(m.get(n.verse_start) ?? []), n]);
    return m;
  }, [notes]);

  const shown = sel == null ? [] : sel.kind === "chapter" ? chapterNotes : byStart.get(sel.start) ?? [];
  const highlight = new Set<number>();
  if (sel?.kind === "verse") for (const n of shown) for (let v = n.verse_start!; v <= n.verse_end!; v++) highlight.add(v);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addHref = (vs?: number) => `/admin?book=${bookId}&chapter=${chapter}${vs ? `&vs=${vs}` : ""}`;

  return (
    <>
      <div className="chapter-head">
        <h1 style={{ margin: "8px 0" }}>{bookName} {chapter}</h1>
        {chapterNotes.length > 0 && (
          <button className="plus lg" aria-label="Open chapter commentary" title="Chapter commentary" onClick={() => setSel({ kind: "chapter" })}>+</button>
        )}
        {isAdmin && <Link className="btn small" href={addHref()}>Add note</Link>}
      </div>

      {!bible.ok ? (
        <div className="notice">
          {bible.error} Commentary is still available below.
          {notes.length > 0 && (
            <ul>
              {notes.map((n) => (
                <li key={n.id}>
                  <button className="btn" style={{ marginTop: 6 }} onClick={() => setSel(n.verse_start ? { kind: "verse", start: n.verse_start } : { kind: "chapter" })}>
                    {formatRef(n.book, n.chapter, n.verse_start, n.verse_end)}{n.title ? ` — ${n.title}` : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {bible.usedFallback && (
            <div className="notice">NKJV isn’t available through the API right now, so this chapter is shown in {bible.version.abbreviation}.</div>
          )}
          <div className="scripture">
            {bible.verses.map((v) => {
              const has = byStart.has(v.n);
              return (
                <span key={v.n} id={`v${v.n}`} className={`verse${highlight.has(v.n) ? " hl" : ""}`}>
                  <span className="vnum">{v.n}</span>
                  {has && (
                    <button className="plus" aria-label={`Commentary on verse ${v.n}`} onClick={() => setSel({ kind: "verse", start: v.n })}>+</button>
                  )}
                  {v.text}{" "}
                </span>
              );
            })}
          </div>
          <p className="copyright">
            Scripture: {bible.version.abbreviation}{bible.version.copyright ? ` — ${bible.version.copyright}` : ""}. Text provided by YouVersion.
          </p>
        </>
      )}

      {sel && (
        <>
          <div className="panel-backdrop" onClick={() => setSel(null)} />
          <aside className="panel" role="dialog" aria-label="Commentary">
            <header>
              <h3>Commentary</h3>
              <button className="btn" onClick={() => setSel(null)} aria-label="Close">✕</button>
            </header>
            <div className="body">
              {shown.map((n) => (
                <article key={n.id} className="note">
                  <div className="ref">{formatRef(n.book, n.chapter, n.verse_start, n.verse_end)}</div>
                  {n.title && <h4>{n.title}</h4>}
                  <Markdown source={n.body} />
                  {n.cross_refs.length > 0 && (
                    <div className="xrefs">
                      <span className="small muted">See also:</span>
                      {n.cross_refs.map((r) => {
                        const p = parseRef(r);
                        return p ? <Link key={r} href={refHref(p)} onClick={() => setSel(null)}>{r}</Link> : <span key={r} className="small">{r}</span>;
                      })}
                    </div>
                  )}
                  {isAdmin && <p className="small"><Link href={`/admin?edit=${n.id}`}>Edit</Link></p>}
                </article>
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
