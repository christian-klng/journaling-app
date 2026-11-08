import { Fragment, type ReactNode } from "react";
import { parseMarkdown, type Inline, type Line } from "@/lib/markdown";

function InlineParts({ parts }: { parts: Inline[] }) {
  return parts.map((part, index) =>
    typeof part === "string" ? (
      <Fragment key={index}>{part}</Fragment>
    ) : part.type === "strong" ? (
      <strong key={index} className="font-semibold">
        <InlineParts parts={part.children} />
      </strong>
    ) : (
      <em key={index}>
        <InlineParts parts={part.children} />
      </em>
    ),
  );
}

/**
 * Zeigt Fragen und Einleitungen mit einfachem Markdown an (fett, kursiv, Listen, Absätze).
 * `after` hängt etwas wie „(optional)“ an das Ende des letzten Absatzes oder Listenpunkts.
 */
export function Markdown({
  text,
  className = "",
  id,
  after,
}: {
  text: string;
  className?: string;
  id?: string;
  after?: ReactNode;
}) {
  const blocks = parseMarkdown(text);
  const last = blocks.length - 1;
  const line = (parts: Line, isLast: boolean) => (
    <>
      <InlineParts parts={parts} />
      {isLast && after}
    </>
  );

  return (
    <div id={id} className={`space-y-2 ${className}`}>
      {blocks.map((block, b) =>
        block.type === "p" ? (
          <p key={b}>
            {block.lines.map((parts, l) => (
              <Fragment key={l}>
                {l > 0 && <br />}
                {line(parts, b === last && l === block.lines.length - 1)}
              </Fragment>
            ))}
          </p>
        ) : block.type === "ul" ? (
          <ul key={b} className="list-disc space-y-1 pl-5">
            {block.items.map((parts, i) => (
              <li key={i}>{line(parts, b === last && i === block.items.length - 1)}</li>
            ))}
          </ul>
        ) : (
          <ol key={b} start={block.start} className="list-decimal space-y-1 pl-5">
            {block.items.map((parts, i) => (
              <li key={i}>{line(parts, b === last && i === block.items.length - 1)}</li>
            ))}
          </ol>
        ),
      )}
      {blocks.length === 0 && after}
    </div>
  );
}
