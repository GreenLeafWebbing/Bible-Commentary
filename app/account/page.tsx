import { Suspense } from "react";
import Account from "@/components/Account";

export const metadata = { title: "Account · Living Word Commentary", robots: { index: false } };

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Account />
    </Suspense>
  );
}
