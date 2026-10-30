import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CONSENT_VERSION, LEGAL } from "@/lib/legal";
import { getStudyPeriod } from "@/lib/settings";
import { isRandomGroupAssignmentActive } from "@/lib/study/group-assignment";

export const metadata: Metadata = { title: "Studienbedingungen" };

/** "2026-11-02" → "02.11.2026" */
const formatDate = (date: string) => date.split("-").reverse().join(".");

// Wie die Studie abläuft. Alles zu den Daten steht in der Datenschutzinformation; die beiden Seiten
// wiederholen sich nicht. Bei inhaltlichen Änderungen CONSENT_VERSION erhöhen.
export default async function StudyTermsPage() {
  // Zeitraum und Gruppenzuordnung stellt die Studienleitung in der App ein
  await connection();
  const [period, randomGroup] = await Promise.all([getStudyPeriod(), isRandomGroupAssignmentActive()]);
  const { studyLead, supervisor } = LEGAL;

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Studienbedingungen</h1>
        <p className="text-muted">
          Teilnahmeinformation für die Studie{LEGAL.project && ` „${LEGAL.project}“`} der{" "}
          {LEGAL.controller.name}. Fassung {CONSENT_VERSION}.
        </p>
      </header>

      <section>
        <h2>Worum es geht</h2>
        <p>
          In der Studie hältst du regelmäßig fest, wie deine Projekt- oder Gründungsarbeit läuft.
          {LEGAL.purpose && ` ${LEGAL.purpose}`}
          {period.start && period.end && ` Sie dauert vom ${formatDate(period.start)} bis zum ${formatDate(period.end)}.`}
        </p>
      </section>

      <section>
        <h2>Wie die Teilnahme abläuft</h2>
        <ul>
          <li>
            Du nutzt diese Web-App auf deinem Smartphone oder Computer. Eine Installation ist nicht
            nötig.
          </li>
          <li>
            Bei der Registrierung bekommst du einen zufälligen Fantasienamen als Benutzernamen und
            bildest deinen persönlichen Code. Woraus er besteht und wozu er dient, steht in der{" "}
            <Link href="/datenschutz">Datenschutzinformation</Link>.
          </li>
          <li>
            Die Teilnehmenden sind in Gruppen mit unterschiedlichen Fragen eingeteilt.{" "}
            {randomGroup
              ? "Deine Gruppe lost dir die App bei der Registrierung zu."
              : "Deine Gruppe erfährst du von der Studienleitung und trägst sie in der App ein."}
          </li>
          <li>
            Jede Woche erscheinen kurze Abfragen mit Skalenfragen und Fragen, die du per Sprachaufnahme
            beantwortest. Eine Abfrage dauert nur wenige Minuten.
          </li>
          <li>
            Jede Abfrage hat ein Zeitfenster von einem oder mehreren Tagen. Nur in dieser Zeit lässt sie
            sich ausfüllen; verpasste Abfragen kannst du nicht nachholen.
          </li>
          <li>
            Deine Aufnahmen werden automatisch verschriftlicht. Erledigte Abfragen kannst du in der App
            mit Antworten, Aufnahmen und Transkripten ansehen.
          </li>
        </ul>
      </section>

      <section>
        <h2>Wer teilnehmen kann</h2>
        <p>Teilnehmen kannst du, wenn du mindestens 18 Jahre alt bist.</p>
      </section>

      <section>
        <h2>Freiwilligkeit und Noten</h2>
        <p>
          Die Teilnahme ist freiwillig. Ob du teilnimmst, was du antwortest, ob du Abfragen auslässt
          und ob du aufhörst, hat <strong>keinen Einfluss auf deine Noten</strong> oder dein Studium.
          Die Studienleitung sieht nur Fantasienamen und Codes. Weil sie die Aufnahmen anhört, kann sie
          Stimmen unter Umständen erkennen. Sie nutzt die Daten dennoch nie für Bewertungen. Mit der
          Auswertung beginnt sie erst, wenn die Leistungen in der Lehrveranstaltung bewertet sind.
        </p>
        <p>
          Du kannst jederzeit ohne Angabe von Gründen aufhören. Wie du deine Teilnahme beendest und
          dabei deine Daten löschst, steht ebenfalls in der{" "}
          <Link href="/datenschutz">Datenschutzinformation</Link>.
        </p>
      </section>

      <section>
        <h2>Was du in deinen Aufnahmen sagst</h2>
        <p>
          Was du erzählst, bestimmst du selbst. Bitte <strong>nenne keine Namen anderer Personen</strong>{" "}
          und erzähle nichts über deren Gesundheit oder andere persönliche Dinge. Sollten doch Namen
          vorkommen, werden sie vor der Auswertung geschwärzt.
        </p>
      </section>

      <section>
        <h2>Fragen zur Studie</h2>
        <p>
          {studyLead.name}, {studyLead.role}
          <br />
          <a href={`mailto:${studyLead.email}`}>{studyLead.email}</a>
          {supervisor && (
            <>
              <br />
              {supervisor.role}: {supervisor.name}
            </>
          )}
        </p>
      </section>
    </>
  );
}
