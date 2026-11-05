"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function NavLinks() {
  const { session, isAdmin } = useAuth();
  const path = usePathname();
  const cls = (href: string) => (href === "/" ? path === "/" || path.startsWith("/read") : path.startsWith(href)) ? "active" : undefined;
  return (
    <nav className="site">
      <Link href="/" className={cls("/")}>Bible</Link>
      <Link href="/commentary" className={cls("/commentary")}>Commentary</Link>
      <Link href="/prayers" className={cls("/prayers")}>Prayer</Link>
      {isAdmin && <Link href="/admin" className={cls("/admin")}>Write</Link>}
      <Link href="/account" className={cls("/account")}>{session ? "Account" : "Sign in"}</Link>
    </nav>
  );
}
