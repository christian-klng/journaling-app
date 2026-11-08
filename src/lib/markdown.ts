// Kleines Markdown für Fragen und Einleitungen: **fett**, *kursiv* (auch __fett__, _kursiv_),
// Listen mit "- ", "* " oder "1. " und Absätze. Mit \* oder \_ bleibt das Zeichen stehen.
// Ergebnis ist ein Baum, aus dem React Elemente baut; HTML aus dem Text wird nie ausgeführt.

export type Inline = string | { type: "strong" | "em"; children: Inline[] };
/** Eine Zeile oder ein Listenpunkt */
export type Line = Inline[];
export type Block =
  | { type: "p"; lines: Line[] }
  | { type: "ul"; items: Line[] }
  | { type: "ol"; start: number; items: Line[] };

const ESCAPED: Record<string, string> = { "*": "", _: "" };
const UNESCAPED: Record<string, string> = { "": "*", "": "_" };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;

// Fett vor kursiv; Unterstriche nur an Wortgrenzen, damit "snake_case" bleibt, wie es ist
const EMPHASIS =
  /\*\*(?=\S)([\s\S]*?\S)\*\*|(?<![\p{L}\p{N}])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}])|\*(?=\S)([\s\S]*?\S)\*|(?<![\p{L}\p{N}])_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}])/u;

const restore = (text: string) => text.replace(/[]/g, (c) => UNESCAPED[c]);

function parseInline(text: string): Inline[] {
  const result: Inline[] = [];
  let rest = text;
  while (rest) {
    const match = EMPHASIS.exec(rest);
    if (!match) break;
    if (match.index > 0) result.push(restore(rest.slice(0, match.index)));
    const strong = match[1] ?? match[2];
    result.push(
      strong !== undefined
        ? { type: "strong", children: parseInline(strong) }
        : { type: "em", children: parseInline(match[3] ?? match[4]) },
    );
    rest = rest.slice(match.index + match[0].length);
  }
  if (rest) result.push(restore(rest));
  return result;
}

export function parseMarkdown(source: string): Block[] {
  const text = source.replace(/\r\n?/g, "\n").replace(/\\([*_])/g, (_, c: string) => ESCAPED[c]);
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const raw of text.split("\n")) {
    if (!raw.trim()) {
      current = null;
      continue;
    }
    const bullet = BULLET.exec(raw);
    const numbered = bullet ? null : NUMBERED.exec(raw);
    if (bullet) {
      if (current?.type !== "ul") blocks.push((current = { type: "ul", items: [] }));
      current.items.push(parseInline(bullet[1].trim()));
    } else if (numbered) {
      if (current?.type !== "ol") blocks.push((current = { type: "ol", start: Number(numbered[1]), items: [] }));
      current.items.push(parseInline(numbered[2].trim()));
    } else {
      if (current?.type !== "p") blocks.push((current = { type: "p", lines: [] }));
      current.lines.push(parseInline(raw.trim()));
    }
  }
  return blocks;
}
