import { expect, test, type Page } from "@playwright/test";
import { ensureGroup, loginAsAdmin, register } from "./helpers";

// Eigene Buchstaben, damit die Tests keine echten Gruppen A und B anfassen
const GROUP = "Z";
const OTHER_GROUP = "Y";
const stamp = Date.now();
const NAME = `Check-In ${stamp}`;
let questionnaireUrl = "";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

const groupCard = (page: Page, letter: string) =>
  page.locator("div.rounded-2xl").filter({ has: page.getByRole("heading", { name: `Gruppe ${letter}`, exact: true }) });

test("Admin legt Zeitraum, Gruppen und eine Abfrage an", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("link", { name: "Studie" }).click();
  await expect(page.getByRole("heading", { name: "Studie", exact: true })).toBeVisible();

  await page.getByLabel("Start", { exact: true }).fill("2026-10-19");
  await page.getByLabel("Ende", { exact: true }).fill("2027-01-31");
  await page.getByRole("button", { name: "Zeitraum speichern" }).click();
  await expect(page.getByText("19.10.2026 bis 31.01.2027")).toBeVisible();

  await ensureGroup(page, GROUP);
  await ensureGroup(page, OTHER_GROUP);

  const card = groupCard(page, GROUP);
  await card.getByText(`+ Abfrage für Gruppe ${GROUP} anlegen`).click();
  await card.getByLabel("Name, wie ihn die Teilnehmenden sehen").fill(NAME);
  await card.getByLabel("Verfügbar ab").selectOption({ label: "Montag" });
  await card.getByLabel("bis einschließlich").selectOption({ label: "Mittwoch" });
  await card.getByRole("button", { name: "Anlegen und bearbeiten" }).click();

  await expect(page.getByRole("heading", { name: `Gruppe ${GROUP} · ${NAME}` })).toBeVisible();
  questionnaireUrl = page.url();
});

test("Admin fügt Elemente hinzu, sortiert und archiviert sie", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(questionnaireUrl);
  const addForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Element hinzufügen" }) });

  async function add(type: string, text: string, options: { required?: boolean; min?: string; max?: string } = {}) {
    await addForm.getByLabel("Typ").selectOption({ label: type });
    await addForm.getByLabel(/^Frage/).fill(text);
    if (options.min) await addForm.getByLabel("Beschriftung bei 0").fill(options.min);
    if (options.max) await addForm.getByLabel("Beschriftung bei 10").fill(options.max);
    if (options.required === false) await addForm.getByLabel("Pflicht").uncheck();
    await addForm.getByRole("button", { name: "Element hinzufügen" }).click();
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }

  await add("Smiley-Skala 1–5", "Wie startest du in die Woche?");
  await add("Skala 0–10", "Wie stressig war die Woche?", { min: "gar nicht stressig", max: "extrem stressig" });
  await add("Audio-Frage", "Was möchtest du diese Woche erreichen?", { required: false });

  await page.getByRole("button", { name: "Element 3 nach oben" }).click();
  await expect(page.getByText("2. Audio-Frage")).toBeVisible();
  await expect(page.getByText("3. Skala 0–10")).toBeVisible();

  // Text korrigieren
  const first = page.locator("div.rounded-2xl").filter({ hasText: "1. Smiley-Skala 1–5" });
  await first.getByLabel(/^Frage/).fill("Wie startest du in diese Woche?");
  await first.getByRole("button", { name: "Speichern" }).click();
  await expect(first.getByRole("status")).toHaveText("Gespeichert");

  // Entfernen archiviert, Wiederherstellen holt das Element zurück
  const scale = page.locator("div.rounded-2xl").filter({ hasText: "3. Skala 0–10" });
  await scale.getByRole("button", { name: "Entfernen" }).click();
  await expect(page.getByText("Archivierte Elemente (1)")).toBeVisible();
  await page.getByText("Archivierte Elemente (1)").click();
  await page.getByRole("button", { name: "Wiederherstellen" }).click();
  await expect(page.getByText("3. Skala 0–10")).toBeVisible();
});

test("Die Vorschau zeigt die Abfrage wie für Teilnehmende", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${questionnaireUrl}/vorschau`);
  await expect(page.getByRole("heading", { name: NAME })).toBeVisible();

  const smileys = page.getByRole("group", { name: "Wie startest du in diese Woche?" });
  await expect(smileys.getByRole("radio")).toHaveCount(5);
  await smileys.getByText("eher gut").click();
  await expect(smileys.getByRole("radio", { name: "eher gut" })).toBeChecked();

  const scale = page.getByRole("group", { name: "Wie stressig war die Woche?" });
  await expect(scale.getByRole("radio")).toHaveCount(11);
  await expect(scale.getByRole("radio", { name: "10 – extrem stressig" })).toBeAttached();
  await expect(page.getByText("Was möchtest du diese Woche erreichen? (optional)")).toBeVisible();
});

test("Admin kopiert die Abfrage in eine andere Gruppe", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(questionnaireUrl);
  await page.getByLabel("Zielgruppe der Kopie").selectOption({ label: `Gruppe ${OTHER_GROUP} – E2E Gruppe ${OTHER_GROUP}` });
  await page.getByRole("button", { name: "Kopieren" }).click();
  await expect(page.getByRole("heading", { name: `Gruppe ${OTHER_GROUP} · ${NAME}` })).toBeVisible();
  await expect(page.getByText(/^\d\. /)).toHaveCount(3);
});

test("Export und Import übertragen die Konfiguration", async ({ page }) => {
  await loginAsAdmin(page);
  const response = await page.request.get("/api/admin/studie");
  expect(response.status()).toBe(200);
  const file = await response.json();
  expect(file).toMatchObject({ format: "journaling-studie", version: 1, studyStart: "2026-10-19" });

  const group = file.groups.find((g: { letter: string }) => g.letter === GROUP);
  const exported = group.questionnaires.find((q: { name: string }) => q.name === NAME);
  expect(exported.items.map((i: { type: string }) => i.type)).toEqual(["smiley", "audio", "scale"]);
  expect(exported.items[1]).toMatchObject({ required: false });

  // Nur Gruppe Z importieren, mit einer geänderten Abfrage
  const imported = { ...file, groups: [{ ...group, questionnaires: [{ ...exported, name: `Import ${stamp}` }] }] };
  await page.goto("/admin/studie");
  await page.getByLabel("Datei für den Import").setInputFiles({
    name: "studie.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(page.getByText("Importiert: Gruppe Z, 1 Abfrage, 3 Elemente.")).toBeVisible();

  const card = groupCard(page, GROUP);
  await expect(card.getByRole("link", { name: new RegExp(`Import ${stamp}`) })).toBeVisible();
  // Die bisherige Abfrage ist archiviert, nicht gelöscht
  await card.getByText(/^Archiviert/).click();
  await expect(card.getByRole("link", { name: NAME })).toBeVisible();
});

test("Ein kaputter Import wird verständlich abgelehnt", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/studie");
  await page.getByLabel("Datei für den Import").setInputFiles({
    name: "kaputt.json",
    mimeType: "application/json",
    buffer: Buffer.from("{ nicht json"),
  });
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(page.getByText("Die Datei ist kein gültiges JSON.")).toBeVisible();
});

test("Teilnehmende kommen nicht an den Studien-Editor", async ({ page }) => {
  await register(page);
  await page.goto("/admin/studie");
  await expect(page).toHaveURL(/\/$/);
  expect((await page.request.get("/api/admin/studie")).status()).toBe(403);
});
