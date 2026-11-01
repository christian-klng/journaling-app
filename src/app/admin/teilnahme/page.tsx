import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { ExportLink } from "@/components/admin/export-link";
import { Button, Card } from "@/components/ui";
import { setParticipantIgnored } from "@/lib/admin/actions";
import { getParticipationData } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { formatShortDate } from "@/lib/format";
import { getStudyPeriod } from "@/lib/settings";
import { formatCode } from "@/lib/study/code";
import { buildParticipation, type ParticipationStatus } from "@/lib/study/participation";
import { berlinDate } from "@/lib/study/schedule";

export const metadata: Metadata = { title: "Teilnahme" };

const STATUS: Record<ParticipationStatus, { symbol: string; label: string; className: string }> = {
  done: { symbol: "✓", label: "erledigt", className: "bg-accent text-on-accent" },
  late: { symbol: "✓", label: "nachgeholt", className: "bg-accent-soft text-accent-ink ring-1 ring-accent" },
  started: { symbol: "…", label: "begonnen", className: "bg-accent-soft text-accent-ink" },
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
          <Link href="/admin/studie" className="font-medium text-accent-ink underline underline-offset-4">
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Teilnahme</h1>
          {rows.length > 0 && <ExportLink label="Alles exportieren" />}
        </div>
        <p className="text-sm text-muted">
          Der Export enthält diese Tabelle als teilnahme.csv und alle Antworten als antworten.csv. Pro Woche je ein Feld für {names.join(" und ") || "jede Abfrage"}, in dieser Reihenfolge. Die
          Zuordnung zu echten Namen läuft über den persönlichen Code.
        </p>
      </div>

      {weeks.length === 0 ? (
        <p className="text-muted">Die Studie hat noch nicht begonnen.</p>
      ) : (
        <Card className="relative overflow-x-auto p-0">
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
                      <Link href={`/admin/nutzer/${person.id}`} className="block font-medium hover:text-accent-ink">
                        {person.displayName}
                      </Link>
                      <span className="block font-mono text-xs text-muted">
                        {formatCode(person.codeStem, person.groupLetter) ?? "kein Code"}
                      </span>
                      {/* In der festen Spalte, damit es auch bei vielen Wochen ohne Scrollen erreichbar ist */}
                      <ConfirmForm
                        action={setParticipantIgnored.bind(null, person.id, true)}
                        message={`${person.displayName} ignorieren? Die Person fehlt dann in Übersicht, Teilnahme und Exporten. Ihre Einträge bleiben erhalten, und du kannst sie jederzeit zurückholen.`}
                      >
                        <button
                          type="submit"
                          aria-label={`${person.displayName} ignorieren`}
                          className="-mb-1 min-h-7 text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Ignorieren
                        </button>
                      </ConfirmForm>
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

      {data.ignored.length > 0 && (
        <section className="space-y-2">
          <div className="space-y-1">
            <h2 className="font-semibold">Ignoriert</h2>
            <p className="text-sm text-muted">
              Diese Personen fehlen in Übersicht, Teilnahme und Exporten, z. B. Testkonten oder
              Personen, die ausgestiegen sind. Ihre Einträge bleiben erhalten.
            </p>
          </div>
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {data.ignored.map((person) => (
                <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <Link href={`/admin/nutzer/${person.id}`} className="block font-medium hover:text-accent-ink">
                      {person.displayName}
                    </Link>
                    <span className="block text-xs text-muted">
                      <span className="font-mono">{formatCode(person.codeStem, person.groupLetter) ?? "kein Code"}</span>
                      {" · "}ignoriert seit {formatShortDate(person.ignoredAt!)}
                    </span>
                  </span>
                  <form action={setParticipantIgnored.bind(null, person.id, false)}>
                    <Button type="submit" variant="secondary" size="sm">
                      Wieder berücksichtigen
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
