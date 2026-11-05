import "server-only";

const API = "https://api.youversion.com/v1";
const DAY = 60 * 60 * 24;

export type Verse = { n: number; text: string };
export type ChapterResult =
  | { ok: true; verses: Verse[]; version: { id: string; abbreviation: string; title?: string; copyright?: string }; fellBackFrom?: string }
  | { ok: false; error: string };

function headers() {
  const key = process.env.YOUVERSION_API_KEY;
  if (!key) throw new Error("YOUVERSION_API_KEY is not set");
  return { "X-YVP-App-Key": key, Accept: "application/json" };
}

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { headers: headers(), next: { revalidate: DAY } });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/** Pull a string field out of a response that might be wrapped in { data: ... }. */
function pick(body: unknown, ...keys: string[]): string | undefined {
  const objs = [body, (body as { data?: unknown })?.data];
  for (const o of objs) {
    if (!o || typeof o !== "object") continue;
    for (const k of keys) {
      const v = (o as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return undefined;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const SKIP_CLASS = /\b(heading|s\d?|ms\d?|mr|r|d|note|notes|footnote|fr|ft|fq|fqa|xo|xt|x|f|yv-h|yv-n|cl)\b/i;
const MARKER_CLASS = /\b(label|v|verse-num|verse-number|yv-v|vlbl|yv-vlbl)\b/i;
const VOID = new Set(["br", "hr", "img", "meta", "link", "input", "wbr"]);

/** Splits passage HTML into verses. Handles data-usfm spans and verse-number markers. */
export function parseVerses(html: string, bookId: string, chapter: number): Verse[] {
  const texts = new Map<number, string>();
  let current = 0;
  type Frame = { tag: string; skip: boolean; marker: boolean };
  const stack: Frame[] = [];
  const skipping = () => stack.some((f) => f.skip || f.marker);
  const inMarker = () => stack.some((f) => f.marker);
  const usfmVerse = new RegExp(`data-usfm="${bookId}\\.${chapter}\\.(\\d+)`, "i");

  const re = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [token, tagRaw, attrs = "", text] = m;
    if (text !== undefined) {
      if (inMarker()) {
        const n = parseInt(text.trim(), 10);
        if (Number.isFinite(n) && n > 0) current = n;
        continue;
      }
      if (skipping() || current === 0) continue;
      texts.set(current, (texts.get(current) ?? "") + decode(text));
      continue;
    }
    const tag = tagRaw.toLowerCase();
    if (token.startsWith("</")) {
      const idx = stack.map((f) => f.tag).lastIndexOf(tag);
      if (idx >= 0) stack.length = idx;
      // Keep paragraph breaks readable as spaces.
      if (["p", "div", "br"].includes(tag) && current) texts.set(current, (texts.get(current) ?? "") + " ");
      continue;
    }
    if (VOID.has(tag) || token.endsWith("/>")) continue;
    const cls = attrs.match(/class="([^"]*)"/i)?.[1] ?? "";
    const vAttr = attrs.match(/\b(?:v|data-verse|data-number)="(\d+)"/i)?.[1];
    const usfm = attrs.match(usfmVerse)?.[1];
    let marker = false;
    if (usfm) current = Number(usfm);
    if (MARKER_CLASS.test(cls) || tag === "sup") {
      marker = true;
      if (vAttr) current = Number(vAttr);
    } else if (vAttr && /verse/i.test(cls)) {
      current = Number(vAttr);
    }
    stack.push({ tag, skip: SKIP_CLASS.test(cls) && !usfm, marker });
  }

  let verses = [...texts.entries()]
    .map(([n, t]) => ({ n, text: t.replace(/\s+/g, " ").trim() }))
    .filter((v) => v.text)
    .sort((a, b) => a.n - b.n);

  // Plain-text fallback: "1 In the beginning ... 2 And the earth ..."
  if (verses.length === 0) {
    const plain = decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const parts = plain.split(/(?:^|\s)(\d{1,3})\s(?=\D)/);
    const out: Verse[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      const n = Number(parts[i]);
      if (n === out.length + 1) out.push({ n, text: parts[i + 1].trim() });
      else if (out.length) out[out.length - 1].text += ` ${parts[i]} ${parts[i + 1]}`;
    }
    verses = out.length ? out : plain ? [{ n: 1, text: plain }] : [];
  }
  return verses;
}

type VersionInfo = { id: string; abbreviation: string; title?: string; copyright?: string };
type Attempt = { status: number } | { status: 200; verses: Verse[]; version: VersionInfo };

/** Default order: first one your key is licensed for wins. */
export const PREFERRED = ["114", "59", "111", "116"]; // NKJV, ESV, NIV, NLT
const KNOWN: Record<string, { abbreviation: string; title: string }> = {
  "114": { abbreviation: "NKJV", title: "New King James Version" },
  "59": { abbreviation: "ESV", title: "English Standard Version" },
  "111": { abbreviation: "NIV", title: "New International Version" },
  "116": { abbreviation: "NLT", title: "New Living Translation" },
  "113": { abbreviation: "NIVUK", title: "New International Version (UK)" },
  "2692": { abbreviation: "NASB", title: "New American Standard Bible 2020" },
  "100": { abbreviation: "NASB1995", title: "New American Standard Bible 1995" },
  "1588": { abbreviation: "AMP", title: "Amplified Bible" },
  "1": { abbreviation: "KJV", title: "King James Version" },
  "1713": { abbreviation: "CSB", title: "Christian Standard Bible" },
  "3034": { abbreviation: "BSB", title: "Berean Standard Bible" },
  "2660": { abbreviation: "LSV", title: "Literal Standard Version" },
  "12": { abbreviation: "ASV", title: "American Standard Version" },
  "2163": { abbreviation: "GNV", title: "Geneva Bible" },
  "206": { abbreviation: "WEB", title: "World English Bible" },
  "110": { abbreviation: "NIrV", title: "New International Reader's Version" },
};
/** Translations offered in the picker, in this order (only those the key can read are shown). */
const CURATED = ["114", "59", "111", "116", "113", "2692", "100", "1713", "1588", "1", "3034", "2660", "12", "2163", "206", "110"];
const fallbackId = () => process.env.YOUVERSION_FALLBACK_BIBLE_ID || "3034";

async function versionInfo(id: string): Promise<VersionInfo> {
  const info = await getJson(`${API}/bibles/${id}`).catch(() => ({ status: 0, body: null }));
  return {
    id,
    abbreviation: KNOWN[id]?.abbreviation ?? pick(info.body, "abbreviation", "local_abbreviation") ?? `v${id}`,
    title: KNOWN[id]?.title ?? pick(info.body, "title", "local_title", "name"),
    copyright: pick(info.body, "copyright_short", "copyright", "copyright_long"),
  };
}

async function tryVersion(versionId: string, bookId: string, chapter: number): Promise<Attempt> {
  if (!/^\d+$/.test(versionId)) return { status: 400 };
  const passage = await getJson(`${API}/bibles/${versionId}/passages/${bookId}.${chapter}?format=html`);
  if (passage.status !== 200) return { status: passage.status };
  const content = pick(passage.body, "content", "html", "text");
  if (!content) return { status: 502 };
  return { status: 200, verses: parseVerses(content, bookId, chapter), version: await versionInfo(versionId) };
}

/** Can this key read this version? Probes a tiny passage (cached for a day). */
async function canRead(id: string) {
  try {
    const r = await getJson(`${API}/bibles/${id}/passages/JHN.3.16?format=text`);
    return r.status === 200;
  } catch {
    return false;
  }
}

/** The first preferred version (NKJV, ESV, NIV, NLT) the key can read, else the fallback. */
export async function defaultVersionId(): Promise<string> {
  for (const id of PREFERRED) if (await canRead(id)) return id;
  return fallbackId();
}

function asList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const b = body as Record<string, unknown> | null;
  for (const k of ["data", "bibles", "versions", "items", "results"]) if (Array.isArray(b?.[k])) return b![k] as unknown[];
  return [];
}

/** English versions the key can read, preferred ones first. */
export async function availableVersions(): Promise<VersionInfo[]> {
  const found = new Map<string, VersionInfo>();
  try {
    let token: string | undefined;
    for (let page = 0; page < 5; page++) {
      const q = new URLSearchParams({ "language_ranges[]": "en" });
      if (token) q.set("page_token", token);
      const r = await getJson(`${API}/bibles?${q}`);
      if (r.status !== 200) break;
      for (const item of asList(r.body)) {
        const o = item as Record<string, unknown>;
        const id = o.id != null ? String(o.id) : "";
        if (!/^\d+$/.test(id)) continue;
        const abbreviation = [o.abbreviation, o.local_abbreviation].find((v) => typeof v === "string") as string | undefined;
        const title = [o.title, o.local_title, o.name].find((v) => typeof v === "string") as string | undefined;
        found.set(id, { id, abbreviation: abbreviation ?? KNOWN[id]?.abbreviation ?? `v${id}`, title: title ?? KNOWN[id]?.title });
      }
      token = pick(r.body, "next_page_token");
      if (!token) break;
    }
  } catch {
    /* fall through to probing known versions */
  }
  // Listed versions confirm access; anything not listed is probed directly.
  const checks = await Promise.all(
    CURATED.map(async (id) => [id, found.has(id) || (await canRead(id))] as const),
  );
  return checks.filter(([, ok]) => ok).map(([id]) => ({ id, ...KNOWN[id] }));
}

/**
 * Load a chapter in the requested version (if any), else the default.
 * `fellBackFrom` is set when the reader picked a version that isn't available.
 */
export async function getChapter(bookId: string, chapter: number, requested?: string): Promise<ChapterResult> {
  try {
    const def = await defaultVersionId();
    const order = [...new Set([requested, def, fallbackId()].filter(Boolean) as string[])];
    let firstStatus = 0;
    for (const id of order) {
      const r = await tryVersion(id, bookId, chapter);
      if ("verses" in r)
        return { ok: true, verses: r.verses, version: r.version, fellBackFrom: requested && requested !== id ? KNOWN[requested]?.abbreviation ?? requested : undefined };
      firstStatus ||= r.status;
    }
    return { ok: false, error: `Bible text unavailable (YouVersion status ${firstStatus}).` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bible text unavailable." };
  }
}
