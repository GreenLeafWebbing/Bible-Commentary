"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { browserClient } from "./supabase";

/** Current session plus whether it's the site author. */
export function useAuth() {
  const sb = browserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (!session) { setIsAdmin(session === null && ready ? false : null); return; }
    sb.rpc("is_admin").then(({ data }) => setIsAdmin(data === true));
  }, [sb, session, ready]);

  return { sb, session, ready, isAdmin };
}
