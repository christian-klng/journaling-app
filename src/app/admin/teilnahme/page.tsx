import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { getParticipationData } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { getStudyPeriod } from "@/lib/settings";
import { formatCode } from "@/lib/study/code";
import { buildParticipation, type ParticipationStatus } from "@/lib/study/participation";
import { berlinDate } from "@/lib/study/schedule";

export const metadata: Metadata = { title: "Teilnahme" };

const STATUS: Record<ParticipationStatus, { symbol: string; label: string; className: string }> = {
  done: { symbol: "✓", label: "erledigt", className: "bg-accent text-white dark:text-background" },
  late: { symbol: "✓", label: "nachgeholt", className: "bg-accent-soft text-accent ring-1 ring-accent" },
  started: { symbol: "…", label: "begonnen", className: "bg-accent-soft text-accent" },
  missed: { symbol: "✗", label: "verpasst", className: "bg-danger-soft text-danger" },
  open: { symbol: "○", label: "läuft gerade", className: "ring-1 ring-border text-muted" },
  upcoming: { symbol: "·", label: "kommt noch", className: "text-muted" },
  none: { symbol: "", label: "keine Abfrage", className: "" },
};

export default async function ParticipationPage() {
  await requireAdmin();
  const [period, data] = await Promise.all([getStudyPeriod(), getParticipationData()]);

  if (!period.start || !period.end) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Teilnahme</h1>
        <p className="text-muted">
          Bitte zuerst unter{" "}
          <Link href="/admin/studie" className="font-medium text-accent underline underline-offset-4">
            Studie
          </Link>{" "}
          den Studienzeitraum festlegen.
        </p>
      </div>
    );
  }

  const { names, weeks, rows } = buildParticipation({
    studyStart: period.start,
    studyEnd: period.end,
    today: berlinDate(),
    people: data.people,
    questionnaires: data.questionnaires,
    entries: data.entries,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Teilnahme</h1>
        <p className="text-sm text-muted">
          Pro Woche je ein Feld für {names.join(" und ") || "jede Abfrage"}, in dieser Reihenfolge. Die
          Zuordnung zu echten Namen läuft über den persönlichen Code.
        </p>
      </div>

      {weeks.length === 0 ? (
        <p className="text-muted">Die Studie hat noch nicht begonnen.</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th scope="col" className="sticky left-0 bg-surface px-3 py-2 font-medium">
                  Person
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Erledigt
                </th>
                {weeks.map((week) => (
                  <th key={week.weekStart} scope="col" className="px-2 py-2 text-center font-medium">
                    W{week.weekNumber}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, index) => {
                const person = data.people[index];
                return (
                  <tr key={row.personId}>
                    <th scope="row" className="sticky left-0 bg-surface px-3 py-2 text-left font-normal">
                      <Link href={`/admin/nutzer/${person.id}`} className="block font-medium hover:text-accent">
                        {person.displayName}
                      </Link>
                      <span className="block font-mono text-xs text-muted">
                        {formatCode(person.codeStem, person.groupLetter) ?? "kein Code"}
                        {person.teamName && ` · ${person.teamName}`}
                      </span>
                    </th>
                    <td className="px-2 py-2 tabular-nums">
                      {row.due > 0 ? `${row.completed}/${row.due}` : "–"}
                    </td>
                    {row.cells.map((week, w) => (
                      <td key={weeks[w].weekStart} className="px-2 py-2">
                        <span className="flex justify-center gap-1">
                          {week.map((status, q) => (
                            <span
                              key={q}
                              title={`${names[q]}: ${STATUS[status].label}`}
                              className={`flex size-6 items-center justify-center rounded-md text-xs font-semibold ${STATUS[status].className}`}
                            >
                              <span aria-hidden>{STATUS[status].symbol}</span>
                              <span className="sr-only">
                                {names[q]}: {STATUS[status].label}
                              </span>
                            </span>
                          ))}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
        {(["done", "late", "started", "missed", "open", "upcoming"] as const).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`flex size-5 items-center justify-center rounded-md text-xs font-semibold ${STATUS[status].className}`}
            >
              {STATUS[status].symbol}
            </span>
            {STATUS[status].label}
          </li>
        ))}
      </ul>
    </div>
  );
}
