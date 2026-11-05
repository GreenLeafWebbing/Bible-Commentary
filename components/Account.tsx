"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import AuthForm from "./AuthForm";

export default function Account() {
  const { sb, session, ready, isAdmin } = useAuth();
  const params = useSearchParams();
  const [changing, setChanging] = useState(params.get("reset") === "1");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!ready) return <p className="muted">Loading…</p>;
  if (!session)
    return <AuthForm intro="A free account gives you a private prayer book. Reading Scripture and commentary never needs an account." redirectPath="/prayers" />;

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Password updated." });
    if (!error) { setPassword(""); setChanging(false); }
  }

  return (
    <div style={{ maxWidth: 480, margin: "32px auto" }}>
      <h1>Your account</h1>
      <p className="muted">Signed in as <strong>{session.user.email}</strong>{isAdmin ? " · Site author" : ""}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <Link className="btn primary" href="/prayers">🙏 My prayer book</Link>
        {isAdmin && <Link className="btn" href="/admin">✍️ Write commentary</Link>}
        <button className="btn" onClick={() => { setChanging((c) => !c); setMsg(null); }}>Change password</button>
        <button className="btn" onClick={() => sb.auth.signOut()}>Sign out</button>
      </div>
      {changing && (
        <form className="stack card" onSubmit={changePassword}>
          <label>New password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
          <button className="btn primary">Save new password</button>
        </form>
      )}
      {msg && <p className={msg.ok ? "success" : "error"}>{msg.text}</p>}
    </div>
  );
}
