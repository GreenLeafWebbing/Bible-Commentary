import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { parseRef, refHref } from "./books";

/**
 * Tiny, safe markdown renderer (no raw HTML). Supports:
 * paragraphs, # headings, > quotes, - lists, **bold**, *italic*,
 * [text](https://link) and [[John 3:16]] cross-reference links.
 */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[\[([^\]]+)\]\]|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) {
      const ref = parseRef(m[1]);
      out.push(ref ? <Link key={k} href={refHref(ref)} className="xref">{m[1]}</Link> : m[1]);
    } else if (m[2]) {
      out.push(<a key={k} href={m[3]} target="_blank" rel="noopener noreferrer">{m[2]}</a>);
    } else if (m[4]) out.push(<strong key={k}>{m[4]}</strong>);
    else if (m[5]) out.push(<em key={k}>{m[5]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="prose">
      {blocks.map((block, bi) => {
        const k = `b${bi}`;
        const lines = block.split("\n");
        const h = block.match(/^(#{1,3})\s+(.*)$/);
        if (h && lines.length === 1) {
          const Tag = (`h${h[1].length + 2}`) as "h3" | "h4" | "h5";
          return <Tag key={k}>{inline(h[2], k)}</Tag>;
        }
        if (lines.every((l) => /^>\s?/.test(l)))
          return <blockquote key={k}>{inline(lines.map((l) => l.replace(/^>\s?/, "")).join(" "), k)}</blockquote>;
        if (lines.every((l) => /^[-*]\s+/.test(l)))
          return <ul key={k}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^[-*]\s+/, ""), `${k}-${li}`)}</li>)}</ul>;
        return (
          <p key={k}>
            {lines.map((l, li) => (
              <Fragment key={li}>{li > 0 && <br />}{inline(l, `${k}-${li}`)}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
