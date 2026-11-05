export type Book = { id: string; name: string; chapters: number; testament: "OT" | "NT" };

export const BOOKS: Book[] = [
  ["GEN", "Genesis", 50], ["EXO", "Exodus", 40], ["LEV", "Leviticus", 27], ["NUM", "Numbers", 36],
  ["DEU", "Deuteronomy", 34], ["JOS", "Joshua", 24], ["JDG", "Judges", 21], ["RUT", "Ruth", 4],
  ["1SA", "1 Samuel", 31], ["2SA", "2 Samuel", 24], ["1KI", "1 Kings", 22], ["2KI", "2 Kings", 25],
  ["1CH", "1 Chronicles", 29], ["2CH", "2 Chronicles", 36], ["EZR", "Ezra", 10], ["NEH", "Nehemiah", 13],
  ["EST", "Esther", 10], ["JOB", "Job", 42], ["PSA", "Psalms", 150], ["PRO", "Proverbs", 31],
  ["ECC", "Ecclesiastes", 12], ["SNG", "Song of Solomon", 8], ["ISA", "Isaiah", 66], ["JER", "Jeremiah", 52],
  ["LAM", "Lamentations", 5], ["EZK", "Ezekiel", 48], ["DAN", "Daniel", 12], ["HOS", "Hosea", 14],
  ["JOL", "Joel", 3], ["AMO", "Amos", 9], ["OBA", "Obadiah", 1], ["JON", "Jonah", 4],
  ["MIC", "Micah", 7], ["NAM", "Nahum", 3], ["HAB", "Habakkuk", 3], ["ZEP", "Zephaniah", 3],
  ["HAG", "Haggai", 2], ["ZEC", "Zechariah", 14], ["MAL", "Malachi", 4],
  ["MAT", "Matthew", 28], ["MRK", "Mark", 16], ["LUK", "Luke", 24], ["JHN", "John", 21],
  ["ACT", "Acts", 28], ["ROM", "Romans", 16], ["1CO", "1 Corinthians", 16], ["2CO", "2 Corinthians", 13],
  ["GAL", "Galatians", 6], ["EPH", "Ephesians", 6], ["PHP", "Philippians", 4], ["COL", "Colossians", 4],
  ["1TH", "1 Thessalonians", 5], ["2TH", "2 Thessalonians", 3], ["1TI", "1 Timothy", 6], ["2TI", "2 Timothy", 4],
  ["TIT", "Titus", 3], ["PHM", "Philemon", 1], ["HEB", "Hebrews", 13], ["JAS", "James", 5],
  ["1PE", "1 Peter", 5], ["2PE", "2 Peter", 3], ["1JN", "1 John", 5], ["2JN", "2 John", 1],
  ["3JN", "3 John", 1], ["JUD", "Jude", 1], ["REV", "Revelation", 22],
].map(([id, name, chapters], i) => ({
  id: id as string,
  name: name as string,
  chapters: chapters as number,
  testament: i < 39 ? "OT" : "NT",
}));

export const BOOK_BY_ID = new Map(BOOKS.map((b) => [b.id, b]));

const EXTRA_ALIASES: Record<string, string> = {
  psalm: "PSA", ps: "PSA", song: "SNG", "song of songs": "SNG", canticles: "SNG",
  phil: "PHP", philem: "PHM", jas: "JAS", jn: "JHN", mk: "MRK", mt: "MAT", lk: "LUK",
  rev: "REV", revelations: "REV", ezek: "EZK", judg: "JDG", eccl: "ECC", prov: "PRO",
};

function normalize(s: string) {
  return s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim()
    .replace(/^(i{1,3})\s/, (_, r: string) => `${r.length} `)
    .replace(/^(first|second|third)\s/, (_, w: string) => `${{ first: 1, second: 2, third: 3 }[w as "first"]} `);
}

export function findBook(input: string): Book | undefined {
  const n = normalize(input);
  const upper = input.trim().toUpperCase();
  if (BOOK_BY_ID.has(upper)) return BOOK_BY_ID.get(upper);
  if (EXTRA_ALIASES[n]) return BOOK_BY_ID.get(EXTRA_ALIASES[n]);
  const exact = BOOKS.find((b) => b.name.toLowerCase() === n);
  if (exact) return exact;
  const compact = n.replace(/ /g, "");
  return BOOKS.find((b) => {
    const name = b.name.toLowerCase().replace(/ /g, "");
    return compact.length >= 3 && name.startsWith(compact);
  });
}

export type Ref = { book: Book; chapter: number; verseStart?: number; verseEnd?: number };

/** Parses "John 3:16", "1 Cor 13", "Rom 8:28-30", "Ps 23:1–3". */
export function parseRef(input: string): Ref | undefined {
  const m = input.trim().match(/^(.+?)\s*(\d+)(?:\s*:\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?$/);
  if (!m) return undefined;
  const book = findBook(m[1]);
  if (!book) return undefined;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > book.chapters) return undefined;
  const verseStart = m[3] ? Number(m[3]) : undefined;
  const verseEnd = m[4] ? Number(m[4]) : verseStart;
  if (verseStart && verseEnd && verseEnd < verseStart) return undefined;
  return { book, chapter, verseStart, verseEnd };
}

export function formatRef(bookId: string, chapter: number, vs?: number | null, ve?: number | null) {
  const name = BOOK_BY_ID.get(bookId)?.name ?? bookId;
  if (!vs) return `${name} ${chapter}`;
  return ve && ve !== vs ? `${name} ${chapter}:${vs}-${ve}` : `${name} ${chapter}:${vs}`;
}

export function refHref(r: Ref) {
  const base = `/read/${r.book.id}/${r.chapter}`;
  return r.verseStart ? `${base}#v${r.verseStart}` : base;
}
