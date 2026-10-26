import type { Metadata } from "next";
import Link from "next/link";
import { CONSENT_VERSION, LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Datenschutz" };

// Inhaltlich gleich mit dem Informationsschreiben, das Teilnehmende vor der Studie bekommen.
// Bei inhaltlichen Änderungen CONSENT_VERSION erhöhen.
export default function PrivacyPage() {
  const { controller, dataProtectionOfficer: dpo, studyLead, supervisor, operator, supervisoryAuthority } = LEGAL;

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Datenschutzinformation</h1>
        <p className="text-muted">
          Für die Teilnahme an der Studie{LEGAL.project && ` „${LEGAL.project}“`} nach Art. 13 DSGVO.
          Fassung {CONSENT_VERSION}.
        </p>
      </header>

      <section>
        <h2>Worum es geht</h2>
        <p>
          Mit dieser App hältst du während der Studie regelmäßig fest, wie deine Projekt- oder
          Gründungsarbeit läuft: mit kurzen Skalen und gesprochenen Antworten. Die Aufnahmen werden
          automatisch verschriftlicht. Die Studienleitung wertet alles wissenschaftlich aus.
          {LEGAL.purpose && ` ${LEGAL.purpose}`}
        </p>
      </section>

      <section>
        <h2>Verantwortlich</h2>
        <p>
          {controller.name}, {controller.representedBy}
          <br />
          {controller.address.join(", ")}
          <br />
          <a href={`mailto:${controller.email}`}>{controller.email}</a>
        </p>
        <p>
          Datenschutzbeauftragter: {dpo.name}, {dpo.organisation}
          <br />
          <a href={`mailto:${dpo.email}`}>{dpo.email}</a>
        </p>
        <p>
          Ansprechperson für die Studie: {studyLead.name}, {studyLead.role}
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

      <section>
        <h2>Welche Daten die App verarbeitet</h2>
        <ul>
          <li>
            <strong>Benutzername:</strong> ein zufälliger Fantasiename, den die App vorschlägt. Dein
            Passwort wird nur als Hash gespeichert und ist für niemanden lesbar.
          </li>
          <li>
            <strong>Persönlicher Code:</strong> die ersten zwei Buchstaben des Vornamens deiner Mutter,
            dein Geburtsmonat, die ersten zwei Buchstaben deines Geburtsortes und deine Gruppe. Mit dem
            Code lassen sich deine Antworten mit anderen Befragungen dieser Studie verbinden, ohne dass
            jemand deinen Namen kennt.
          </li>
          <li>
            <strong>Deine Antworten:</strong> Skalenwerte, Audioaufnahmen deiner Stimme, deren
            Transkripte und die Zeitpunkte, zu denen du sie abgegeben hast.
          </li>
          <li>
            <strong>Technisch nötig:</strong> ein Cookie, das dich angemeldet hält (kein Tracking), und
            deine IP-Adresse für höchstens 15 Minuten, um das Erraten von Passwörtern zu bremsen. Bis
            eine Aufnahme hochgeladen ist, liegt sie im Speicher deines Browsers.
          </li>
        </ul>
        <p>
          Nicht gespeichert werden dein echter Name, deine E-Mail-Adresse, deine Matrikelnummer und dein
          Standort. Die App bindet keine Analyse- oder Werbedienste und keine Inhalte anderer Anbieter
          ein.
        </p>
        <p>
          Was du in deinen Aufnahmen erzählst, bestimmst du selbst. Stimme und Inhalt können Hinweise
          auf deine Person geben. Bitte nenne keine Namen anderer Personen und erzähle nichts über deren
          Gesundheit oder andere persönliche Dinge.
        </p>
      </section>

      <section>
        <h2>Zweck und Rechtsgrundlage</h2>
        <p>
          Die Daten dienen ausschließlich diesem Forschungsprojekt. Rechtsgrundlage ist deine
          Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Sprichst du in deinen Aufnahmen von dir aus über
          Gesundheit, religiöse oder politische Überzeugungen oder andere besonders geschützte Themen,
          gilt dafür deine ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a DSGVO).
        </p>
        <p>
          Die Teilnahme ist freiwillig. Ob du teilnimmst, was du antwortest oder ob du aufhörst, hat
          keinen Einfluss auf deine Noten oder dein Studium. Die Studienleitung sieht nur Fantasienamen
          und Codes. Weil sie die Aufnahmen anhört, kann sie Stimmen unter Umständen erkennen. Sie
          nutzt die Daten dennoch nie für Bewertungen. Mit der Auswertung beginnt sie erst, wenn die
          Leistungen in der Lehrveranstaltung bewertet sind.
        </p>
      </section>

      <section>
        <h2>Transkription mit künstlicher Intelligenz</h2>
        <p>
          Die Aufnahmen werden mit dem Spracherkennungsmodell Whisper verschriftlicht. Dazu gehen sie
          verschlüsselt an die Cortecs GmbH in Wien, die sie ausschließlich an Rechenzentren von
          Anbietern mit Sitz in der EU weiterleitet. Laut Vertrag speichern diese die Aufnahmen nicht
          dauerhaft und nutzen sie nicht zum Trainieren von KI-Modellen. Die KI verschriftlicht nur;
          sie bewertet nichts und trifft keine Entscheidungen über dich. Transkripte können Fehler
          enthalten, deshalb bleibt die Aufnahme maßgeblich.
        </p>
      </section>

      <section>
        <h2>Wer die Daten erhält</h2>
        <ul>
          <li>
            Die Studienleitung und die Betreuung des Projekts. Sie hören Aufnahmen an, lesen Transkripte
            und exportieren die Daten zur Auswertung auf Dienstgeräte der HWR.
          </li>
          <li>
            {operator.name}, {operator.address.join(", ")}: betreibt die App im Auftrag der HWR
            (Auftragsverarbeitung nach Art. 28 DSGVO). Für den Support kann sie auf deine Einträge
            zugreifen, aber nur, wenn eine Störung das erfordert, und nur auf Weisung der HWR.
          </li>
          <li>Hetzner Online GmbH, Gunzenhausen: Server und Speicher in Rechenzentren in Deutschland.</li>
          <li>Cortecs GmbH, Wien: Transkription, wie oben beschrieben.</li>
        </ul>
        <p>
          Es werden keine Daten in Länder außerhalb der EU oder des EWR übermittelt. Ergebnisse werden
          nur anonymisiert veröffentlicht, also ohne Audio und ohne Angaben, die auf dich schließen
          lassen.
        </p>
      </section>

      <section>
        <h2>Wie lange die Daten gespeichert werden</h2>
        <p>
          Bis zum Ende des Forschungsprojekts
          {LEGAL.deleteBy ? `, spätestens bis zum ${LEGAL.deleteBy}` : ""}. Dann werden alle Daten
          gelöscht. Beendest du deine Teilnahme vorher, werden deine Daten sofort gelöscht.
        </p>
      </section>

      <section>
        <h2>Deine Rechte</h2>
        <p>
          Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17),
          Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Deine
          Einwilligung kannst du jederzeit ohne Angabe von Gründen widerrufen (Art. 7 Abs. 3). Was bis
          dahin verarbeitet wurde, bleibt rechtmäßig.
        </p>
        <p>
          Deine Einträge siehst du jederzeit in der App. Zum Widerruf öffnest du angemeldet die Seite{" "}
          <Link href="/teilnahme-beenden">„Teilnahme beenden“</Link>: Dein Konto, deine Einträge und
          Aufnahmen werden sofort gelöscht. Die Studienleitung
          erfährt dabei nur deinen Fantasienamen und Code, damit sie dich auch aus bereits exportierten
          Daten entfernt. Was schon anonymisiert in Ergebnisse eingeflossen ist, lässt sich nicht mehr
          dir zuordnen und bleibt bestehen.
        </p>
        <p>
          Für alles andere schreib der Ansprechperson für die Studie oder dem Datenschutzbeauftragten.
          Dein Fantasiename genügt; deinen echten Namen musst du nicht nennen.
        </p>
        <p>
          Du kannst dich außerdem bei einer Aufsichtsbehörde beschweren, etwa bei der{" "}
          {supervisoryAuthority.name}, {supervisoryAuthority.address.join(", ")},{" "}
          <a href={supervisoryAuthority.web}>{supervisoryAuthority.web.replace("https://", "")}</a>.
        </p>
      </section>

      <section>
        <h2>Freiwilligkeit</h2>
        <p>
          Du bist nicht verpflichtet, deine Daten bereitzustellen. Ohne Einwilligung kannst du die App
          nicht nutzen. Nachteile entstehen dir daraus nicht.
        </p>
      </section>
    </>
  );
}
