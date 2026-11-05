import "server-only";

const API = "https://api.youversion.com/v1";
const DAY = 60 * 60 * 24;

export type Verse = { n: number; text: string };
export type ChapterResult =
  | { ok: true; verses: Verse[]; version: { id: string; abbreviation: string; copyright?: string }; usedFallback: boolean }
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

type Attempt =
  | { status: number }
  | { status: 200; verses: Verse[]; version: { id: string; abbreviation: string; copyright?: string } };

async function tryVersion(versionId: string, bookId: string, chapter: number): Promise<Attempt> {
  const passage = await getJson(`${API}/bibles/${versionId}/passages/${bookId}.${chapter}?format=html`);
  if (passage.status !== 200) return { status: passage.status };
  const content = pick(passage.body, "content", "html", "text");
  if (!content) return { status: 502 };
  const info = await getJson(`${API}/bibles/${versionId}`).catch(() => ({ status: 0, body: null }));
  return {
    status: 200,
    verses: parseVerses(content, bookId, chapter),
    version: {
      id: versionId,
      abbreviation: pick(info.body, "abbreviation", "local_abbreviation") ?? (versionId === "114" ? "NKJV" : `v${versionId}`),
      copyright: pick(info.body, "copyright_short", "copyright", "copyright_long"),
    },
  };
}

export async function getChapter(bookId: string, chapter: number): Promise<ChapterResult> {
  try {
    const primary = process.env.YOUVERSION_BIBLE_ID || "114";
    const fallback = process.env.YOUVERSION_FALLBACK_BIBLE_ID;
    const first = await tryVersion(primary, bookId, chapter);
    if ("verses" in first) return { ok: true, verses: first.verses, version: first.version, usedFallback: false };
    if (fallback && fallback !== primary && [401, 403, 404].includes(first.status)) {
      const second = await tryVersion(fallback, bookId, chapter);
      if ("verses" in second) return { ok: true, verses: second.verses, version: second.version, usedFallback: true };
    }
    return { ok: false, error: `Bible text unavailable (YouVersion status ${first.status}).` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bible text unavailable." };
  }
}
