import { Suspense } from "react";
import Admin from "@/components/Admin";

export const metadata = { title: "Write · Living Word Commentary", robots: { index: false } };

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Admin />
    </Suspense>
  );
}
