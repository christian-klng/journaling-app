import { expect, test } from "@playwright/test";
import {
  AUDIO_QUESTION,
  FLOW_GROUP,
  FLOW_QUESTIONNAIRE,
  loginAsAdmin,
  recordAnswer,
  register,
  SCALE_QUESTION,
  setupStudy,
  SMILEY_QUESTION,
  useFakeMicrophone,
} from "./helpers";
import { addDays, berlinDate, mondayOf } from "../../src/lib/study/schedule";

let userName = "";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
  await useFakeMicrophone(page);
});

test("Admin richtet die Studie ein", async ({ page }) => {
  await loginAsAdmin(page);
  await setupStudy(page);
});

test("Ohne Gruppe gibt es keine Fragen", async ({ page }) => {
  await register(page);
  await expect(page.getByText("Deine Gruppe fehlt noch.")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(FLOW_QUESTIONNAIRE) })).toHaveCount(0);
});

test("Die Startseite zeigt die offene Abfrage und die verpasste ausgegraut", async ({ page }) => {
  userName = await register(page, { group: FLOW_GROUP });
  await expect(page.getByRole("link", { name: new RegExp(`${FLOW_QUESTIONNAIRE} starten`) })).toBeVisible();
  const missed = page.locator("section").filter({ has: page.getByRole("heading", { name: "Verpasst" }) });
  await expect(missed).toContainText(`Woche 1 · ${FLOW_QUESTIONNAIRE}`);
  await expect(missed.getByRole("button", { name: "Nachholen" })).toBeDisabled();
  await expect(missed.getByRole("link")).toHaveCount(0);
});

test("Teilnehmende füllen die Abfrage Schritt für Schritt aus", async ({ page }) => {
  await register(page, { group: FLOW_GROUP });
  await page.getByRole("link", { name: new RegExp(`${FLOW_QUESTIONNAIRE} starten`) }).click();
  await expect(page.getByText("Bitte beantworte die folgenden Fragen.")).toBeVisible();
  await page.getByRole("button", { name: "Los geht's" }).click();

  // Pflicht-Skala: ohne Auswahl geht es nicht weiter
  await expect(page.getByText("Frage 1 von 3")).toBeVisible();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(page.getByText("Frage 1 von 3")).toBeVisible();
  await page.getByRole("group", { name: SMILEY_QUESTION }).getByText("sehr gut").click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();

  // Optionale Skala lässt sich leer lassen
  await expect(page.getByRole("group", { name: `${SCALE_QUESTION} (optional)` })).toBeVisible();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();

  // Pflicht-Audio: Weiter erst nach einer Aufnahme
  await expect(page.getByText(AUDIO_QUESTION)).toBeVisible();
  await expect(page.getByRole("button", { name: "Weiter", exact: true })).toHaveCount(0);
  await recordAnswer(page);
  await recordAnswer(page);
  await expect(page.getByText("2 Aufnahmen gespeichert")).toBeVisible();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();

  await expect(page.getByText("(übersprungen)")).toBeVisible();
  await page.getByRole("button", { name: "Abschließen" }).click();
  await expect(page.getByText("Danke! Deine Antworten sind gespeichert.")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`${FLOW_QUESTIONNAIRE} starten`) })).toHaveCount(0);

  const done = page.locator("section").filter({ has: page.getByRole("heading", { name: "Erledigt" }) });
  await done.getByRole("link", { name: new RegExp(`Woche 2 · ${FLOW_QUESTIONNAIRE}`) }).click();
  await expect(page.getByText("sehr gut")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(2);
  await expect(page.getByText(SCALE_QUESTION)).toHaveCount(0);
});

test("Eine unterbrochene Abfrage lässt sich fortsetzen", async ({ page }) => {
  await register(page, { group: FLOW_GROUP });
  await page.getByRole("link", { name: new RegExp(`${FLOW_QUESTIONNAIRE} starten`) }).click();
  await expect(page.getByText("Woche 2 ·")).toBeVisible();
  await page.getByRole("button", { name: "Los geht's" }).click();
  await page.getByRole("group", { name: SMILEY_QUESTION }).getByText("mittel").click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(page.getByText("Frage 2 von 3")).toBeVisible();

  // Abbrechen und später direkt bei der ersten offenen Frage weitermachen
  await page.goto("/");
  await page.getByRole("link", { name: new RegExp(`${FLOW_QUESTIONNAIRE} fortsetzen`) }).click();
  await expect(page.getByText("Frage 2 von 3")).toBeVisible();

  // Zurück zeigt die gespeicherte Antwort
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page.getByRole("radio", { name: "mittel" })).toBeChecked();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await recordAnswer(page);
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByRole("button", { name: "Abschließen" }).click();

  await expect(page.getByText("Danke! Deine Antworten sind gespeichert.")).toBeVisible();
  await expect(page.getByText("nachgeholt")).toHaveCount(0);
});

test("Verpasste Abfragen lassen sich nicht nachholen", async ({ page }) => {
  await register(page, { group: FLOW_GROUP });
  const href = await page.getByRole("link", { name: new RegExp(`${FLOW_QUESTIONNAIRE} starten`) }).getAttribute("href");
  const [, , questionnaireId] = href!.split("/");
  await page.goto(`/abfrage/${questionnaireId}/${addDays(mondayOf(berlinDate()), -7)}`);
  await expect(page.getByText("Das Zeitfenster ist vorbei.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Los geht's" })).toHaveCount(0);
});

test("Uploads brauchen einen eigenen Eintrag und eine Audio-Frage", async ({ page }) => {
  await register(page, { group: FLOW_GROUP });
  const response = await page.request.post("/api/recordings", {
    multipart: {
      file: { name: "a.webm", mimeType: "audio/webm", buffer: Buffer.from("x") },
      recordingId: crypto.randomUUID(),
      durationMs: "1000",
    },
  });
  expect(response.status()).toBe(400);
});

test("Admin sieht die Teilnahme", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("link", { name: "Teilnahme" }).click();
  await expect(page.getByRole("heading", { name: "Teilnahme" })).toBeVisible();
  const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: userName }) });
  // Woche 1 verpasst, Woche 2 noch offen
  await expect(row).toContainText(`0/2`);
  await expect(row.getByText(`${FLOW_QUESTIONNAIRE}: verpasst`)).toBeAttached();
  await expect(row.getByText(`${FLOW_QUESTIONNAIRE}: läuft gerade`)).toBeAttached();
});
