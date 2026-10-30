import { inflateRawSync } from "node:zlib";
import { expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { addDays, berlinDate, mondayOf } from "../../src/lib/study/schedule";

export const PASSWORD = process.env.E2E_PASSWORD ?? "";
// Kein Fantasiename, damit er nie mit einem erzeugten Namen kollidiert
export const ADMIN_NAME = "E2E Admin";
export const ADMIN_LOGIN_NAME = "e2e admin";

if (!PASSWORD) throw new Error("E2E_PASSWORD fehlt. Bitte in .env setzen, siehe .env.example.");

const randomLetters = () =>
  Array.from({ length: 2 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");

/** Zufälliger Code-Anfang wie "QX-05-HB", damit Testläufe sich nicht als Doppelte melden. */
export const randomCodeStem = () =>
  `${randomLetters()}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-${randomLetters()}`;

let sql: postgres.Sql | null = null;

/** Die Tests legen mehr Konten an, als die Sperre gegen Massenregistrierungen pro Adresse zulässt. */
async function resetRegistrationLimit() {
  sql ??= postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await sql`delete from login_attempts where key like 'register:%'`;
}

/** Registriert ein Konto und gibt den vergebenen Fantasienamen zurück. */
export async function register(page: Page, options: { codeStem?: string; group?: string } = {}) {
  const [mother, month, birthplace] = (options.codeStem ?? randomCodeStem()).split("-");
  await resetRegistrationLimit();
  await page.goto("/registrieren");
  const name = await page.getByLabel("Dein Benutzername").inputValue();
  await page.getByLabel("Passwort", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Passwort wiederholen").fill(PASSWORD);
  await page.getByLabel("Vornamens deiner Mutter").fill(mother.toLowerCase());
  await page.getByLabel("Dein Geburtsmonat").selectOption(month);
  await page.getByLabel("Geburtsortes").fill(birthplace);
  if (options.group) await page.getByLabel("Deine Gruppe").selectOption({ label: `Gruppe ${options.group}` });
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page).toHaveURL(/\/\?willkommen=1$/);
  return name;
}

export async function login(page: Page, username: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /^Menü für/ }).click();
  await page.getByRole("menuitem", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

export async function loginAsAdmin(page: Page) {
  await login(page, ADMIN_NAME);
  await expect(page).toHaveURL(/\/admin$/);
}

/** Legt eine Gruppe im Studien-Editor an, falls es sie noch nicht gibt. */
export async function ensureGroup(page: Page, letter: string) {
  await page.goto("/admin/studie");
  const heading = page.getByRole("heading", { name: `Gruppe ${letter}`, exact: true });
  if ((await heading.count()) > 0) return;
  await page.getByLabel("Buchstabe der neuen Gruppe").fill(letter.toLowerCase());
  await page.getByLabel("Interne Bezeichnung der neuen Gruppe").fill(`E2E Gruppe ${letter}`);
  await page.getByRole("button", { name: "Gruppe anlegen" }).click();
  await expect(heading).toBeVisible();
}

/**
 * Ersetzt das Mikrofon durch einen Testton. Der Zugriff auf ein echtes (oder von Chrome
 * simuliertes) Mikrofon hängt im automatischen Browser von Rechten des Betriebssystems ab.
 */
export async function useFakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0.2;
      const destination = context.createMediaStreamDestination();
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      return destination.stream;
    };
  });
}

// Testgruppe mit einer Abfrage, die jeden Tag offen ist; Start in der Vorwoche, damit es auch
// immer eine verpasste gibt
export const FLOW_GROUP = "X";
export const FLOW_QUESTIONNAIRE = "Täglich";
export const SMILEY_QUESTION = "Wie geht es dir?";
export const SCALE_QUESTION = "Wie stressig war es?";
export const AUDIO_QUESTION = "Was hast du geschafft?";

/** Richtet Studienzeitraum und Testgruppe über den Import ein. Ruft der Admin auf. */
export async function setupStudy(page: Page) {
  const today = berlinDate();
  const file = {
    format: "journaling-studie",
    version: 1,
    studyStart: addDays(mondayOf(today), -7),
    studyEnd: addDays(today, 60),
    groups: [
      {
        letter: FLOW_GROUP,
        label: "E2E Ablauf",
        questionnaires: [
          {
            name: FLOW_QUESTIONNAIRE,
            intro: "Bitte beantworte die folgenden Fragen.",
            opensOn: 1,
            closesOn: 7,
            items: [
              { type: "smiley", text: SMILEY_QUESTION, required: true },
              { type: "scale", text: SCALE_QUESTION, required: false, minLabel: "gar nicht", maxLabel: "sehr" },
              { type: "audio", text: AUDIO_QUESTION, required: true },
            ],
          },
        ],
      },
    ],
  };
  await page.goto("/admin/studie");
  await page.getByLabel("Datei für den Import").setInputFiles({
    name: "studie.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(page.getByText(`Importiert: Gruppe ${FLOW_GROUP}, 1 Abfrage, 3 Elemente.`)).toBeVisible();
}

/** Nimmt im Ablauf ein paar Sekunden als Antwort auf eine Audio-Frage auf. */
export async function recordAnswer(page: Page) {
  await page.getByRole("button", { name: /Antwort aufnehmen|Weitere Aufnahme anhängen/ }).click();
  await expect(page.getByRole("timer")).toHaveText(/00:0[2-9]/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Aufnahme beenden" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Aufnahme(n)? gespeichert/ })).toBeVisible({ timeout: 30_000 });
}

/** Füllt die Testabfrage vollständig aus, beginnend auf der Startseite. */
export async function completeQuestionnaire(page: Page, link: RegExp | string = `${FLOW_QUESTIONNAIRE} starten`) {
  await page.getByRole("link", { name: link }).first().click();
  await page.getByRole("button", { name: "Los geht's" }).click();
  await page.getByRole("group", { name: SMILEY_QUESTION }).getByText("eher gut").click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByRole("group", { name: new RegExp(SCALE_QUESTION) }).getByText("7", { exact: true }).click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await recordAnswer(page);
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByRole("button", { name: "Abschließen" }).click();
  await expect(page.getByText("Danke! Deine Antworten sind gespeichert.")).toBeVisible();
}

/** Liest eine Datei aus einem ZIP über das zentrale Verzeichnis, ohne zusätzliche Bibliothek. */
export function readZipEntry(zip: Buffer, nameEndsWith: string) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let offset = zip.readUInt32LE(end + 16);
  const count = zip.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name.endsWith(nameEndsWith)) {
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const data = zip.subarray(start, start + compressedSize);
      return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${nameEndsWith} fehlt im ZIP`);
}
