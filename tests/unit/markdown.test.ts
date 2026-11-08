import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../../src/lib/markdown";

describe("parseMarkdown", () => {
  it("lässt normalen Text unverändert", () => {
    expect(parseMarkdown("Wie geht es dir?")).toEqual([{ type: "p", lines: [["Wie geht es dir?"]] }]);
  });

  it("erkennt fett und kursiv, auch verschachtelt", () => {
    expect(parseMarkdown("Wie **sehr** hat dich *das* gestört?")).toEqual([
      {
        type: "p",
        lines: [["Wie ", { type: "strong", children: ["sehr"] }, " hat dich ", { type: "em", children: ["das"] }, " gestört?"]],
      },
    ]);
    expect(parseMarkdown("__ganz *wichtig*__")[0]).toEqual({
      type: "p",
      lines: [[{ type: "strong", children: ["ganz ", { type: "em", children: ["wichtig"] }] }]],
    });
  });

  it("lässt einzelne Sternchen, Unterstriche im Wort und Escapes stehen", () => {
    expect(parseMarkdown("5 * 3 und snake_case_name")).toEqual([{ type: "p", lines: [["5 * 3 und snake_case_name"]] }]);
    expect(parseMarkdown("\\*kein kursiv\\*")).toEqual([{ type: "p", lines: [["*kein kursiv*"]] }]);
    expect(parseMarkdown("-5 bis 5")).toEqual([{ type: "p", lines: [["-5 bis 5"]] }]);
  });

  it("baut Listen und Absätze", () => {
    expect(parseMarkdown("Denk an:\n- Schlaf\n* **Sport**\n\n1. erstens\n2. zweitens\nZeile\nnoch eine")).toEqual([
      { type: "p", lines: [["Denk an:"]] },
      { type: "ul", items: [["Schlaf"], [{ type: "strong", children: ["Sport"] }]] },
      { type: "ol", start: 1, items: [["erstens"], ["zweitens"]] },
      { type: "p", lines: [["Zeile"], ["noch eine"]] },
    ]);
  });

  it("macht aus HTML keinen Code, sondern Text", () => {
    expect(parseMarkdown("<b>hallo</b>")).toEqual([{ type: "p", lines: [["<b>hallo</b>"]] }]);
  });
});
