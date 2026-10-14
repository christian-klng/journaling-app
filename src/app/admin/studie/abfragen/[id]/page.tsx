import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { MoveButtons } from "@/components/admin/move-buttons";
import { AddItemForm, CopyQuestionnaireForm, ItemForm, QuestionnaireForm } from "@/components/admin/study-forms";
import { Button, buttonClass, Card, Notice } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/guards";
import { isUuid } from "@/lib/entries";
import { moveItem, setItemArchived, setQuestionnaireArchived } from "@/lib/study/actions";
import { ITEM_TYPE_LABELS } from "@/lib/study/config";
import { getQuestionnaire, listStudyGroups } from "@/lib/study/queries";

export const metadata: Metadata = { title: "Abfrage bearbeiten" };

export default async function QuestionnairePage({ params }: PageProps<"/admin/studie/abfragen/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const questionnaire = isUuid(id) ? await getQuestionnaire(id) : null;
  if (!questionnaire) notFound();

  const groups = await listStudyGroups();
  const active = questionnaire.items.filter((item) => !item.archivedAt);
  const archived = questionnaire.items.filter((item) => item.archivedAt);
  const { group } = questionnaire;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/admin/studie" className="text-sm text-muted hover:text-foreground">
          ← Studie
        </Link>
        <h1 className="text-xl font-semibold">
          Gruppe {group.letter} · {questionnaire.name}
        </h1>
        {group.label && <p className="text-sm text-muted">{group.label}</p>}
      </div>

      {questionnaire.archivedAt && (
        <Notice>Diese Abfrage ist archiviert. Teilnehmende sehen sie nicht mehr.</Notice>
      )}

      <Card className="space-y-4">
        <QuestionnaireForm questionnaire={questionnaire} />
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Elemente</h2>
          <Link href={`/admin/studie/abfragen/${questionnaire.id}/vorschau`} className={buttonClass("secondary", "sm")}>
            Vorschau
          </Link>
        </div>
        <p className="text-sm text-muted">
          Korrekturen am Text sind jederzeit möglich; bereits gegebene Antworten behalten den Text, den
          die Person gesehen hat. Der Typ lässt sich nicht ändern. Entfernte Elemente werden archiviert.
        </p>

        {active.length === 0 && <p className="text-sm text-muted">Noch keine Elemente.</p>}
        {active.map((item, index) => (
          <Card key={item.id} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted">
                {index + 1}. {ITEM_TYPE_LABELS[item.type]}
              </p>
              <MoveButtons
                up={index > 0 ? moveItem.bind(null, item.id, "up") : null}
                down={index < active.length - 1 ? moveItem.bind(null, item.id, "down") : null}
                label={`Element ${index + 1}`}
              />
            </div>
            {/* Schlüssel mit Position, damit die Felder nach dem Umsortieren den richtigen Stand zeigen */}
            <ItemForm key={`${item.id}-${item.position}`} item={item} />
            <ConfirmForm
              action={setItemArchived.bind(null, item.id, true)}
              message="Element entfernen? Es wird archiviert, gegebene Antworten bleiben erhalten."
            >
              <Button type="submit" variant="ghost" size="sm">
                Entfernen
              </Button>
            </ConfirmForm>
          </Card>
        ))}

        <Card className="space-y-3">
          <h3 className="font-semibold">Element hinzufügen</h3>
          <AddItemForm questionnaireId={questionnaire.id} />
        </Card>

        {archived.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Archivierte Elemente ({archived.length})</summary>
            <ul className="mt-2 space-y-2">
              {archived.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3">
                  <span className="text-muted">
                    {ITEM_TYPE_LABELS[item.type]}: {item.text}
                  </span>
                  <form action={setItemArchived.bind(null, item.id, false)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Wiederherstellen
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <Card className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-semibold">Kopieren</h2>
          <p className="text-sm text-muted">
            Legt eine Kopie mit allen aktiven Elementen in der gewählten Gruppe an, etwa um die Abfrage für
            die andere Gruppe anzupassen.
          </p>
        </div>
        <CopyQuestionnaireForm questionnaireId={questionnaire.id} groups={groups} />
      </Card>

      {questionnaire.archivedAt ? (
        <form action={setQuestionnaireArchived.bind(null, questionnaire.id, false)}>
          <Button type="submit" variant="secondary">
            Abfrage wiederherstellen
          </Button>
        </form>
      ) : (
        <ConfirmForm
          action={setQuestionnaireArchived.bind(null, questionnaire.id, true)}
          message={`„${questionnaire.name}“ archivieren? Teilnehmende sehen die Abfrage dann nicht mehr, gegebene Antworten bleiben erhalten.`}
        >
          <Button type="submit" variant="danger">
            Abfrage archivieren
          </Button>
        </ConfirmForm>
      )}
    </div>
  );
}
