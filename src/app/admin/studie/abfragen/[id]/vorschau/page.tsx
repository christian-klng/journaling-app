import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MicIcon } from "@/components/study/mic-icon";
import { NumberScale, SmileyScale } from "@/components/study/scales";
import { buttonClass, Card, Notice } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/guards";
import { isUuid } from "@/lib/entries";
import { getQuestionnaire } from "@/lib/study/queries";

export const metadata: Metadata = { title: "Vorschau" };

/** Zeigt eine Abfrage so, wie Teilnehmende sie sehen. Antworten werden nicht gespeichert. */
export default async function PreviewPage({ params }: PageProps<"/admin/studie/abfragen/[id]/vorschau">) {
  await requireAdmin();
  const { id } = await params;
  const questionnaire = isUuid(id) ? await getQuestionnaire(id) : null;
  if (!questionnaire) notFound();
  const items = questionnaire.items.filter((item) => !item.archivedAt);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <Link href={`/admin/studie/abfragen/${questionnaire.id}`} className="text-sm text-muted hover:text-foreground">
          ← Zurück zum Bearbeiten
        </Link>
        <Notice>
          Vorschau für Gruppe {questionnaire.group.letter}. Antworten werden nicht gespeichert.
        </Notice>
      </div>

      <h1 className="text-xl font-semibold">{questionnaire.name}</h1>
      {questionnaire.intro && <p className="whitespace-pre-wrap leading-relaxed">{questionnaire.intro}</p>}

      {items.map((item) =>
        item.type === "smiley" ? (
          <SmileyScale key={item.id} name={item.id} question={item.text} required={item.required} />
        ) : item.type === "scale" ? (
          <NumberScale
            key={item.id}
            name={item.id}
            question={item.text}
            required={item.required}
            minLabel={item.minLabel}
            maxLabel={item.maxLabel}
          />
        ) : (
          <Card key={item.id} className="space-y-3">
            <p className="font-medium">
              {item.text}
              {!item.required && <span className="font-normal text-muted"> (optional)</span>}
            </p>
            <span aria-disabled className={`${buttonClass("primary")} pointer-events-none w-full opacity-60`}>
              <MicIcon className="size-5" />
              Antwort aufnehmen
            </span>
          </Card>
        ),
      )}

      {items.length === 0 && <p className="text-muted">Diese Abfrage hat noch keine Elemente.</p>}
    </div>
  );
}
