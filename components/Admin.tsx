"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { browserClient, type Commentary } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import AuthForm from "./AuthForm";
import { BOOKS, BOOK_BY_ID, formatRef, parseRef } from "@/lib/books";
import { Markdown } from "@/lib/markdown";

type Draft = {
  id?: string;
  book: string;
  chapter: number;
  scope: "chapter" | "verses";
  verseStart: number;
  verseEnd: number;
  title: string;
  body: string;
  crossRefs: string;
};

const empty = (book = "GEN", chapter = 1, vs?: number, ve?: number): Draft => ({
  book, chapter, scope: vs ? "verses" : "chapter", verseStart: vs ?? 1, verseEnd: Math.max(ve ?? vs ?? 1, vs ?? 1), title: "", body: "", crossRefs: "",
});

export default function Admin() {
  const params = useSearchParams();
  const { sb, session, ready, isAdmin } = useAuth();

  if (!ready) return <p className="muted">Loading…</p>;
  if (!session)
    return <AuthForm title="Author sign in" intro="Commentary is written by the site author. Everyone can read it, no account needed." redirectPath="/admin" />;
  if (isAdmin === null) return <p className="muted">Checking access…</p>;
  if (!isAdmin)
    return (
      <div style={{ marginTop: 32 }}>
        <h1>Commentary is author-only</h1>
        <p className="muted">Only the site author writes commentary, but your account has its own private prayer book.</p>
        <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn primary" href="/prayers">Open my prayer book</Link>
          <Link className="btn" href="/commentary">Read commentary</Link>
          <button className="btn" onClick={() => sb.auth.signOut()}>Sign out</button>
        </p>
      </div>
    );

  return <Editor email={session.user.email ?? ""} initialEdit={params.get("edit")} prefill={{
    book: params.get("book") ?? undefined,
    chapter: params.get("chapter") ? Number(params.get("chapter")) : undefined,
    vs: params.get("vs") ? Number(params.get("vs")) : undefined,
    ve: params.get("ve") ? Number(params.get("ve")) : undefined,
  }} />;
}

function Editor({ email, initialEdit, prefill }: { email: string; initialEdit: string | null; prefill: { book?: string; chapter?: number; vs?: number; ve?: number } }) {
  const sb = browserClient();
  const startBook = prefill.book && BOOK_BY_ID.has(prefill.book) ? prefill.book : "GEN";
  const [draft, setDraft] = useState<Draft>(empty(startBook, prefill.chapter ?? 1, prefill.vs, prefill.ve));
  const [list, setList] = useState<Commentary[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const book = BOOK_BY_ID.get(draft.book)!;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const load = useCallback(async () => {
    const { data } = await sb.from("commentaries").select("*").order("updated_at", { ascending: false }).limit(200);
    setList((data ?? []) as Commentary[]);
  }, [sb]);

  useEffect(() => { load(); }, [load]);

  const edit = useCallback((c: Commentary) => {
    setDraft({
      id: c.id, book: c.book, chapter: c.chapter,
      scope: c.verse_start ? "verses" : "chapter",
      verseStart: c.verse_start ?? 1, verseEnd: c.verse_end ?? c.verse_start ?? 1,
      title: c.title ?? "", body: c.body, crossRefs: c.cross_refs.join("; "),
    });
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!initialEdit) return;
    sb.from("commentaries").select("*").eq("id", initialEdit).single().then(({ data }) => data && edit(data as Commentary));
  }, [sb, initialEdit, edit]);

  const refs = draft.crossRefs.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  const badRefs = refs.filter((r) => !parseRef(r));

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!draft.body.trim()) return setMsg({ ok: false, text: "Write something in the commentary first." });
    if (badRefs.length) return setMsg({ ok: false, text: `Couldn’t read these cross-references: ${badRefs.join(", ")}` });
    if (draft.scope === "verses" && draft.verseEnd < draft.verseStart) return setMsg({ ok: false, text: "End verse must be after start verse." });
    setBusy(true);
    const row = {
      book: draft.book,
      chapter: draft.chapter,
      verse_start: draft.scope === "verses" ? draft.verseStart : null,
      verse_end: draft.scope === "verses" ? draft.verseEnd : null,
      title: draft.title.trim() || null,
      body: draft.body,
      cross_refs: refs,
    };
    const { error } = draft.id
      ? await sb.from("commentaries").update(row).eq("id", draft.id)
      : await sb.from("commentaries").insert(row);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: draft.id ? "Updated." : "Saved. Praise God!" });
    setDraft(empty(draft.book, draft.chapter));
    setPreview(false);
    load();
  }

  async function remove(c: Commentary) {
    if (!confirm(`Delete the note on ${formatRef(c.book, c.chapter, c.verse_start, c.verse_end)}? This can’t be undone.`)) return;
    const { error } = await sb.from("commentaries").delete().eq("id", c.id);
    if (error) return setMsg({ ok: false, text: error.message });
    if (draft.id === c.id) setDraft(empty(draft.book, draft.chapter));
    load();
  }

  const viewHref = `/read/${draft.book}/${draft.chapter}${draft.scope === "verses" ? `#v${draft.verseStart}` : ""}`;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1>{draft.id ? "Edit commentary" : "New commentary"}</h1>
        <span className="small muted">{email} · <button className="btn" style={{ padding: "2px 8px" }} onClick={() => sb.auth.signOut()}>Sign out</button></span>
      </div>

      <form className="stack card" onSubmit={save}>
        <div className="row">
          <label>Book
            <select value={draft.book} onChange={(e) => setDraft((d) => ({ ...d, book: e.target.value, chapter: 1 }))}>
              {BOOKS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label>Chapter
            <input type="number" min={1} max={book.chapters} value={draft.chapter} onChange={(e) => set("chapter", Math.min(book.chapters, Math.max(1, Number(e.target.value) || 1)))} />
          </label>
          <label>Covers
            <select value={draft.scope} onChange={(e) => set("scope", e.target.value as Draft["scope"])}>
              <option value="chapter">Whole chapter</option>
              <option value="verses">Verse / passage</option>
            </select>
          </label>
        </div>
        {draft.scope === "verses" && (
          <div className="row">
            <label>From verse<input type="number" min={1} value={draft.verseStart} onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); setDraft((d) => ({ ...d, verseStart: v, verseEnd: Math.max(v, d.verseEnd) })); }} /></label>
            <label>To verse<input type="number" min={draft.verseStart} value={draft.verseEnd} onChange={(e) => set("verseEnd", Math.max(1, Number(e.target.value) || 1))} /></label>
          </div>
        )}
        <p className="small muted" style={{ margin: 0 }}>
          This note will appear on <strong>{formatRef(draft.book, draft.chapter, draft.scope === "verses" ? draft.verseStart : null, draft.verseEnd)}</strong>.
        </p>
        <label>Title <span className="hint">optional</span>
          <input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. The love that gives" />
        </label>
        <label>
          <span style={{ display: "flex", justifyContent: "space-between" }}>
            Commentary
            <button type="button" className="btn" style={{ padding: "2px 10px" }} onClick={() => setPreview((p) => !p)}>{preview ? "Write" : "Preview"}</button>
          </span>
          <span className="hint">**bold**, *italic*, &gt; quote, - list, # heading, [[Romans 5:8]] links to a passage. Leave a blank line between paragraphs.</span>
          {preview ? <div className="card" style={{ background: "var(--bg)" }}><Markdown source={draft.body || "_Nothing yet_"} /></div>
            : <textarea value={draft.body} onChange={(e) => set("body", e.target.value)} />}
        </label>
        <label>Cross-references <span className="hint">separate with semicolons, e.g. Romans 5:8; 1 John 4:9-10; Isaiah 53</span>
          <input value={draft.crossRefs} onChange={(e) => set("crossRefs", e.target.value)} />
          {badRefs.length > 0 && <span className="error">Not recognised: {badRefs.join(", ")}</span>}
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : draft.id ? "Update" : "Save"}</button>
          {draft.id && <button type="button" className="btn" onClick={() => { setDraft(empty(draft.book, draft.chapter)); setMsg(null); }}>Cancel edit</button>}
          <Link className="btn" href={viewHref} target="_blank">View passage ↗</Link>
        </div>
        {msg && <p className={msg.ok ? "success" : "error"}>{msg.text}</p>}
      </form>

      <h2>Your commentary ({list.length})</h2>
      {list.length === 0 && <p className="muted">Nothing written yet. Your first note is one Save away.</p>}
      {list.map((c) => (
        <div key={c.id} className="list-item">
          <div>
            <Link href={`/read/${c.book}/${c.chapter}${c.verse_start ? `#v${c.verse_start}` : ""}`}>{formatRef(c.book, c.chapter, c.verse_start, c.verse_end)}</Link>
            {c.title && <span className="muted"> — {c.title}</span>}
          </div>
          <div className="actions">
            <button className="btn" onClick={() => edit(c)}>Edit</button>
            <button className="btn danger" onClick={() => remove(c)}>Delete</button>
          </div>
        </div>
      ))}
    </>
  );
}
