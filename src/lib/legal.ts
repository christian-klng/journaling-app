// Angaben für Datenschutzinformation, Studienbedingungen, Impressum und Einwilligung. Die Texte stehen in
// src/app/(public)/; hier nur, was sich je Studie ändert. Was noch offen ist, bleibt null und
// erscheint dann nicht auf den Seiten.

/**
 * Fassung der Einwilligung. Bei jeder inhaltlichen Änderung des Einwilligungstextes, der
 * Datenschutzinformation oder der Studienbedingungen erhöhen; gespeichert wird sie bei der Registrierung.
 */
export const CONSENT_VERSION = "3";

type Person = { name: string; role: string };

export const LEGAL = {
  project: null as string | null,
  /** Ziel der Studie als ganzer Satz, z. B. "Sie untersucht, wie …" */
  purpose: null as string | null,
  controller: {
    name: "Hochschule für Wirtschaft und Recht Berlin (HWR Berlin)",
    representedBy: "vertreten durch den Präsidenten",
    address: ["Badensche Straße 52", "10825 Berlin"],
    email: "praesident@hwr-berlin.de",
    imprint: "https://www.hwr-berlin.de/impressum/",
  },
  dataProtectionOfficer: {
    name: "Klaus Hoogestraat",
    organisation: "c/o ITM Management & Consulting GmbH",
    email: "datenschutzbeauftragter@hwr-berlin.de",
  },
  studyLead: {
    name: "Johanna Heisgen",
    role: "Wissenschaftliche Mitarbeiterin, Entrepreneurship",
    email: "johanna.heisgen@hwr-berlin.de",
  },
  supervisor: null as Person | null,
  /** Betreibt die App im Auftrag der HWR (Auftragsverarbeitung nach Art. 28 DSGVO) */
  operator: {
    name: "ai up UG (haftungsbeschränkt)",
    address: ["Köpenicker Landstr. 262", "12437 Berlin"],
  },
  /** Spätestens dann werden alle Daten gelöscht, z. B. "31.12.2029" */
  deleteBy: null as string | null,
  supervisoryAuthority: {
    name: "Berliner Beauftragte für Datenschutz und Informationsfreiheit",
    address: ["Alt-Moabit 59–61", "10555 Berlin"],
    web: "https://www.datenschutz-berlin.de",
  },
};
