// A small markdown reader for the Content preview. It turns markdown into
// blocks the template renders with plain elements, so nothing from the file
// reaches the page as HTML. Links keep their text only.

export interface InlinePart {
  text: string;
  code?: true;
  strong?: true;
  em?: true;
}

export type MarkdownBlock =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; parts: InlinePart[] }
  | { kind: 'paragraph'; parts: InlinePart[] }
  | { kind: 'quote'; parts: InlinePart[] }
  | { kind: 'list'; ordered: boolean; items: InlinePart[][] }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'rule' };

const MAX_BLOCKS = 400;

/** Inline markdown as parts: `code`, **strong**, *em*; links and images keep their text. */
export function inline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  // Code spans first, so `<b>` or `[a](b)` inside backticks stays as written.
  for (const [i, piece] of text.split(/(`[^`]+`)/).entries()) {
    if (!piece) continue;
    if (i % 2 === 1) parts.push({ text: piece.slice(1, -1), code: true });
    else parts.push(...emphasis(stripMarkup(piece)));
  }
  return parts;
}

function stripMarkup(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '');
}

function emphasis(plain: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  for (const match of plain.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: plain.slice(last, match.index) });
    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) {
      parts.push({ text: token.slice(2, -2), strong: true });
    } else parts.push({ text: token.slice(1, -1), em: true });
    last = match.index + token.length;
  }
  if (last < plain.length) parts.push({ text: plain.slice(last) });
  return parts;
}

export function markdownBlocks(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = source.replace(/\r/g, '').split('\n');
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', parts: inline(paragraph.join(' ')) });
    paragraph = [];
  };
  for (let i = 0; i < lines.length && blocks.length < MAX_BLOCKS; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*(```|~~~)\s*([\w-]*)/);
    if (fence) {
      flush();
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) body.push(lines[i]);
      blocks.push({ kind: 'code', lang: fence[2], text: body.join('\n') });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      flush();
      const level = heading[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ kind: 'heading', level, parts: inline(heading[2]) });
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      blocks.push({ kind: 'rule' });
      continue;
    }
    const item = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (item) {
      flush();
      const ordered = /\d/.test(item[1]);
      const items: InlinePart[][] = [inline(item[2])];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (!next || /\d/.test(next[1]) !== ordered) break;
        items.push(inline(next[2]));
        i++;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flush();
      const text = [quote[1]];
      while (i + 1 < lines.length && /^\s*>/.test(lines[i + 1])) {
        text.push(lines[++i].replace(/^\s*>\s?/, ''));
      }
      blocks.push({ kind: 'quote', parts: inline(text.join(' ')) });
      continue;
    }
    if (!line.trim()) flush();
    else paragraph.push(line.trim());
  }
  flush();
  return blocks;
}
