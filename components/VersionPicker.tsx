"use client";

import { useRouter } from "next/navigation";

type V = { id: string; abbreviation: string; title?: string };

export default function VersionPicker({ versions, current }: { versions: V[]; current: string }) {
  const router = useRouter();
  if (versions.length < 2) return null;
  return (
    <select
      className="version-picker"
      aria-label="Bible translation"
      value={current}
      onChange={(e) => {
        document.cookie = `bv=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {versions.map((v) => (
        <option key={v.id} value={v.id}>{v.abbreviation}{v.title ? ` — ${v.title}` : ""}</option>
      ))}
    </select>
  );
}
