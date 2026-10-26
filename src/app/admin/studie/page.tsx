import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { MoveButtons } from "@/components/admin/move-buttons";
import { CreateGroupForm, CreateQuestionnaireForm, GroupLabelForm, ImportForm, StudyPeriodForm } from "@/components/admin/study-forms";
import { Button, buttonClass, Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/guards";
import { formatShortDate } from "@/lib/format";
import { getStudyPeriod, isRandomGroupAssignmentEnabled } from "@/lib/settings";
import { deleteGroup, moveQuestionnaire, setQuestionnaireArchived, setRandomGroupAssignment } from "@/lib/study/actions";
import { formatWindow } from "@/lib/study/config";
import { getStudyOverview } from "@/lib/study/queries";

export const metadata: Metadata = { title: "Studie" };

export default async function StudyPage() {
  await requireAdmin();
  const [groups, period, randomGroups] = await Promise.all([
    getStudyOverview(),
    getStudyPeriod(),
    isRandomGroupAssignmentEnabled(),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Studie</h1>
        <p className="text-sm text-muted">
          Gruppen und ihre Abfragen. Teilnehmende sehen nur die Abfragen ihrer eigenen Gruppe, nie die
          interne Bezeichnung.
        </p>
      </div>

      <Card className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-semibold">Studienzeitraum</h2>
          <p className="text-sm text-muted">
            {period.start && period.end
              ? `${formatShortDate(period.start)} bis ${formatShortDate(period.end)}. `
              : "Noch nicht festgelegt. "}
            Woche 1 beginnt am Montag der Woche, in die der Start fällt. Abfragen sind nur in diesem
            Zeitraum fällig und lassen sich nur dafür nachholen.
          </p>
        </div>
        <StudyPeriodForm start={period.start} end={period.end} />
      </Card>

      {groups.length >= 2 && (
        <Card className="space-y-3">
          <div className="space-y-1">
            <h2 className="font-semibold">Zufällige Zuordnung zu einer Gruppe</h2>
            <p className="text-sm text-muted">
              {randomGroups
                ? "Eingeschaltet. Neue Teilnehmende kommen bei der Registrierung in die Gruppe mit den wenigsten Personen, bei Gleichstand per Los, und können sofort starten. Selbst wählen können sie ihre Gruppe nicht."
                : "Ausgeschaltet. Teilnehmende tragen ihre Gruppe selbst ein, oder die Studienleitung weist sie in der Übersicht zu."}{" "}
              Bereits Registrierte behalten ihre Gruppe. Personen ohne Gruppe weist du in der Übersicht
              zu.
            </p>
          </div>
          <form action={setRandomGroupAssignment.bind(null, !randomGroups)}>
            <Button type="submit" variant="secondary">
              {randomGroups ? "Zufällige Zuordnung ausschalten" : "Zufällige Zuordnung einschalten"}
            </Button>
          </form>
        </Card>
      )}

      {groups.map((group) => {
        const active = group.questionnaires.filter((q) => !q.archivedAt);
        const archived = group.questionnaires.filter((q) => q.archivedAt);
        return (
          <Card key={group.id} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">Gruppe {group.letter}</h2>
              <span className="ml-auto text-sm text-muted">
                {group.memberCount === 1 ? "1 Person" : `${group.memberCount} Personen`}
              </span>
              {group.questionnaires.length === 0 && group.memberCount === 0 && (
                <ConfirmForm action={deleteGroup.bind(null, group.id)} message={`Gruppe ${group.letter} löschen?`}>
                  <Button type="submit" variant="ghost" size="sm">
                    Gruppe löschen
                  </Button>
                </ConfirmForm>
              )}
            </div>
            <GroupLabelForm group={group} />

            {active.length === 0 ? (
              <p className="text-sm text-muted">Noch keine Abfragen. Ohne Abfragen sieht die Gruppe keine Fragen.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {active.map((q, index) => (
                  <li key={q.id} className="flex items-center gap-2 px-3 py-2">
                    <Link href={`/admin/studie/abfragen/${q.id}`} className="min-w-0 flex-1 py-1 hover:text-accent-ink">
                      <span className="block truncate font-medium">{q.name}</span>
                      <span className="block text-sm text-muted">
                        {formatWindow(q.opensOn, q.closesOn)} · {q.itemCount === 1 ? "1 Element" : `${q.itemCount} Elemente`}
                      </span>
                    </Link>
                    <MoveButtons
                      up={index > 0 ? moveQuestionnaire.bind(null, q.id, "up") : null}
                      down={index < active.length - 1 ? moveQuestionnaire.bind(null, q.id, "down") : null}
                      label={q.name}
                    />
                  </li>
                ))}
              </ul>
            )}

            <CreateQuestionnaireForm group={group} />

            {archived.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted">Archiviert ({archived.length})</summary>
                <ul className="mt-2 space-y-1">
                  {archived.map((q) => (
                    <li key={q.id} className="flex items-center justify-between gap-3">
                      <Link href={`/admin/studie/abfragen/${q.id}`} className="text-muted hover:text-foreground">
                        {q.name}
                      </Link>
                      <form action={setQuestionnaireArchived.bind(null, q.id, false)}>
                        <Button type="submit" variant="ghost" size="sm">
                          Wiederherstellen
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        );
      })}

      <Card className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-semibold">Gruppe anlegen</h2>
          <p className="text-sm text-muted">
            Der Buchstabe wird Teil des persönlichen Codes (z. B. KA-03-BE-<strong>A</strong>) und lässt
            sich später nicht ändern.
          </p>
        </div>
        <CreateGroupForm />
      </Card>

      <Card className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-semibold">Import und Export</h2>
          <p className="text-sm text-muted">
            Der Export enthält Zeitraum, Gruppen und alle aktiven Abfragen als JSON-Datei, etwa als
            Sicherung oder zum Übertragen auf einen anderen Server. Beim Import werden die bisherigen
            Abfragen der enthaltenen Gruppen archiviert. Gegebene Antworten bleiben erhalten.
          </p>
        </div>
        {/* Normaler Link statt next/link, damit der Browser die Datei herunterlädt */}
        <a href="/api/admin/studie" download className={buttonClass("secondary", "sm")}>
          Konfiguration exportieren
        </a>
        <ImportForm />
      </Card>
    </div>
  );
}
