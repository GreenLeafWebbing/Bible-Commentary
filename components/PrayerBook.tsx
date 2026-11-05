"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/useAuth";
import AuthForm from "./AuthForm";

export const CATEGORIES = ["Family", "Friends", "Church", "Myself", "Work", "Nation & World", "Salvation", "Healing", "Other"] as const;
type Category = (typeof CATEGORIES)[number];

type Prayer = {
  id: string;
  person: string;
  request: string;
  category: Category;
  status: "ongoing" | "answered";
  answer_note: string | null;
  answered_at: string | null;
  prayed_count: number;
  last_prayed_at: string | null;
  created_at: string;
};

const DAY = 86_400_000;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
function daysBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY));
}

export default function PrayerBook() {
  const { sb, session, ready } = useAuth();
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"ongoing" | "answered">("ongoing");
  const [filter, setFilter] = useState<Category | "All">("All");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await sb.from("prayers").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    setPrayers((data ?? []) as Prayer[]);
    setLoaded(true);
  }, [sb]);

  useEffect(() => { if (session) load(); }, [session, load]);

  const counts = useMemo(() => ({
    ongoing: prayers.filter((p) => p.status === "ongoing").length,
    answered: prayers.filter((p) => p.status === "answered").length,
  }), [prayers]);

  const shown = prayers
    .filter((p) => p.status === tab && (filter === "All" || p.category === filter))
    .sort((a, b) => tab === "answered"
      ? (b.answered_at ?? "").localeCompare(a.answered_at ?? "")
      : b.created_at.localeCompare(a.created_at));

  const replace = (p: Prayer) => setPrayers((list) => list.map((x) => (x.id === p.id ? p : x)));

  async function update(id: string, patch: Partial<Prayer>) {
    setError(null);
    const { data, error } = await sb.from("prayers").update(patch).eq("id", id).select().single();
    if (error) return setError(error.message);
    replace(data as Prayer);
  }

  async function prayed(id: string) {
    const { data, error } = await sb.rpc("mark_prayed", { prayer_id: id });
    if (error) return setError(error.message);
    if (data) replace(data as Prayer);
  }

  async function remove(p: Prayer) {
    const msg = p.status === "answered"
      ? `Delete this answered prayer for ${p.person} forever? You'll lose this record of God's faithfulness.`
      : `Delete this prayer for ${p.person} forever?\n\nIf God has answered it, choose "Answered" instead so you can remember His faithfulness.`;
    if (!confirm(msg)) return;
    const { error } = await sb.from("prayers").delete().eq("id", p.id);
    if (error) return setError(error.message);
    setPrayers((list) => list.filter((x) => x.id !== p.id));
  }

  if (!ready) return <p className="muted">Loading…</p>;
  if (!session)
    return (
      <>
        <PrayerIntro />
        <AuthForm title="Sign in to your prayer book" intro="Your prayer book is private. Only you can see what you write." redirectPath="/prayers" />
      </>
    );

  return (
    <>
      <PrayerIntro />

      <div className="prayer-stats">
        <div><strong>{counts.ongoing}</strong><span>Praying</span></div>
        <div><strong>{counts.answered}</strong><span>Answered</span></div>
      </div>

      {adding ? (
        <PrayerForm
          onCancel={() => setAdding(false)}
          onSave={async (v) => {
            setError(null);
            const { data, error } = await sb.from("prayers").insert(v).select().single();
            if (error) return setError(error.message);
            setPrayers((list) => [data as Prayer, ...list]);
            setAdding(false);
            setTab("ongoing");
          }}
        />
      ) : (
        <button className="btn primary new-prayer" onClick={() => setAdding(true)}>+ New prayer</button>
      )}

      {error && <p className="error">{error}</p>}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "ongoing"} className={tab === "ongoing" ? "active" : ""} onClick={() => setTab("ongoing")}>Praying ({counts.ongoing})</button>
        <button role="tab" aria-selected={tab === "answered"} className={tab === "answered" ? "active" : ""} onClick={() => setTab("answered")}>Answered ({counts.answered})</button>
        <span style={{ flex: 1 }} />
        <select aria-label="Filter by category" className="cat-filter" value={filter} onChange={(e) => setFilter(e.target.value as Category | "All")}>
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {!loaded ? <p className="muted">Loading your prayers…</p> : shown.length === 0 ? (
        <div className="notice">
          {tab === "ongoing"
            ? "No prayers here yet. Tap “New prayer” to start. “Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.” Philippians 4:6"
            : "Answered prayers will be kept here as a record of God’s faithfulness."}
        </div>
      ) : (
        <div className="prayer-list">
          {shown.map((p) => (
            <PrayerCard key={p.id} p={p} onUpdate={update} onPrayed={prayed} onDelete={remove} />
          ))}
        </div>
      )}
    </>
  );
}

function PrayerIntro() {
  return (
    <section className="hero" style={{ paddingBottom: 0 }}>
      <h1>Prayer Book</h1>
      <p className="muted">Write down who and what you’re praying for. Track what God is doing, and remember His answers.</p>
    </section>
  );
}

type FormValues = { person: string; request: string; category: Category };

function PrayerForm({ initial, onSave, onCancel, saveLabel = "Save prayer" }: {
  initial?: FormValues; onSave: (v: FormValues) => Promise<void> | void; onCancel: () => void; saveLabel?: string;
}) {
  const [v, setV] = useState<FormValues>(initial ?? { person: "", request: "", category: "Family" });
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.person.trim() || !v.request.trim()) return;
    setBusy(true);
    await onSave({ ...v, person: v.person.trim(), request: v.request.trim() });
    setBusy(false);
  }
  return (
    <form className="stack card prayer-form" onSubmit={submit}>
      <label>Who are you praying for?
        <input value={v.person} maxLength={200} required placeholder="e.g. Mum, Pastor James, myself" onChange={(e) => setV({ ...v, person: e.target.value })} />
      </label>
      <label>What are you praying for?
        <textarea value={v.request} maxLength={5000} required style={{ minHeight: 110 }} placeholder="e.g. Healing after surgery, peace, salvation…" onChange={(e) => setV({ ...v, request: e.target.value })} />
      </label>
      <label>Category
        <select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value as Category })}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn primary" disabled={busy}>{busy ? "Saving…" : saveLabel}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function PrayerCard({ p, onUpdate, onPrayed, onDelete }: {
  p: Prayer;
  onUpdate: (id: string, patch: Partial<Prayer>) => Promise<void>;
  onPrayed: (id: string) => Promise<void>;
  onDelete: (p: Prayer) => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "answer">("view");
  const [note, setNote] = useState(p.answer_note ?? "");
  const [justPrayed, setJustPrayed] = useState(false);

  if (mode === "edit")
    return (
      <PrayerForm
        initial={{ person: p.person, request: p.request, category: p.category }}
        saveLabel="Save changes"
        onCancel={() => setMode("view")}
        onSave={async (v) => { await onUpdate(p.id, v); setMode("view"); }}
      />
    );

  return (
    <article className={`prayer-card ${p.status}`}>
      <div className="prayer-top">
        <span className="cat-chip">{p.category}</span>
        {p.status === "answered" && <span className="answered-chip">✓ Answered</span>}
      </div>
      <h3>{p.person}</h3>
      <p className="prayer-request">{p.request}</p>

      {p.status === "answered" && p.answered_at && (
        <div className="testimony">
          <div className="small"><strong>Answered {fmtDate(p.answered_at)}</strong> · prayed for {daysBetween(p.created_at, p.answered_at)} day{daysBetween(p.created_at, p.answered_at) === 1 ? "" : "s"}</div>
          {p.answer_note && <p>{p.answer_note}</p>}
        </div>
      )}

      <p className="small muted prayer-meta">
        Started {fmtDate(p.created_at)}
        {p.prayed_count > 0 && <> · prayed {p.prayed_count} time{p.prayed_count === 1 ? "" : "s"}{p.last_prayed_at && <>, last {ago(p.last_prayed_at)}</>}</>}
      </p>

      {mode === "answer" ? (
        <div className="stack" style={{ marginTop: 8 }}>
          <label>How did God answer? <span className="hint">Optional. Your testimony of His faithfulness.</span>
            <textarea value={note} maxLength={5000} style={{ minHeight: 90 }} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn primary" onClick={async () => {
              await onUpdate(p.id, { status: "answered", answered_at: p.answered_at ?? new Date().toISOString(), answer_note: note.trim() || null });
              setMode("view");
            }}>Save as answered</button>
            <button className="btn" onClick={() => setMode("view")}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="prayer-actions">
          {p.status === "ongoing" ? (
            <>
              <button className={`btn${justPrayed ? " prayed" : ""}`} onClick={async () => { await onPrayed(p.id); setJustPrayed(true); setTimeout(() => setJustPrayed(false), 1500); }}>
                {justPrayed ? "Amen ✓" : "🙏 I prayed"}
              </button>
              <button className="btn" onClick={() => setMode("answer")}>✓ Answered</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setMode("answer")}>Edit testimony</button>
              <button className="btn" onClick={() => onUpdate(p.id, { status: "ongoing", answered_at: null })}>Move back to praying</button>
            </>
          )}
          <button className="btn" onClick={() => setMode("edit")}>Edit</button>
          <button className="btn danger" onClick={() => onDelete(p)}>Delete</button>
        </div>
      )}
    </article>
  );
}
