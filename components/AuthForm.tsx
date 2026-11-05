"use client";

import { useState, type FormEvent } from "react";
import { browserClient } from "@/lib/supabase";

export default function AuthForm({ title, intro, redirectPath = "/account" }: { title?: string; intro?: string; redirectPath?: string }) {
  const sb = browserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const redirect = `${window.location.origin}${redirectPath}`;
    if (mode === "reset") {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account?reset=1` });
      setBusy(false);
      setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "If that email has an account, a reset link is on its way." });
      return;
    }
    const { error } = mode === "in"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
    setBusy(false);
    if (error) setMsg({ ok: false, text: error.message });
    else if (mode === "up") setMsg({ ok: true, text: "Account created! Check your email and click the link to confirm, then sign in." });
  }

  const heading = mode === "up" ? "Create your account" : mode === "reset" ? "Reset password" : title ?? "Sign in";

  return (
    <div style={{ maxWidth: 380, margin: "40px auto" }}>
      <h1>{heading}</h1>
      {intro && mode !== "reset" && <p className="muted small">{intro}</p>}
      <form className="stack" onSubmit={submit}>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        {mode !== "reset" && (
          <label>Password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} />
            {mode === "up" && <span className="hint">At least 8 characters.</span>}
          </label>
        )}
        <button className="btn primary" disabled={busy}>
          {busy ? "Please wait…" : mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}
        </button>
        {msg && <p className={msg.ok ? "success" : "error"}>{msg.text}</p>}
      </form>
      <p className="small muted" style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {mode !== "up" && <>New here? <button className="btn" style={{ padding: "2px 8px" }} onClick={() => { setMode("up"); setMsg(null); }}>Create account</button></>}
        {mode !== "in" && <>Have an account? <button className="btn" style={{ padding: "2px 8px" }} onClick={() => { setMode("in"); setMsg(null); }}>Sign in</button></>}
        {mode === "in" && <button className="btn" style={{ padding: "2px 8px" }} onClick={() => { setMode("reset"); setMsg(null); }}>Forgot password?</button>}
      </p>
    </div>
  );
}
