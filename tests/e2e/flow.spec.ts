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

test("Die Startseite zeigt die offene Abfrage und die verpasste zum Nachholen", async ({ page }) => {
  userName = await register(page, undefined, { group: FLOW_GROUP });
  await expect(page.getByRole("link", { name: new RegExp(`${FLOW_QUESTIONNAIRE} starten`) })).toBeVisible();
  const makeUp = page.locator("section").filter({ has: page.getByRole("heading", { name: "Nachholen" }) });
  await expect(makeUp).toContainText(`Woche 1 · ${FLOW_QUESTIONNAIRE}`);
  await expect(makeUp.getByRole("link", { name: "Nachholen" })).toHaveCount(1);
});

test("Teilnehmende füllen die Abfrage Schritt für Schritt aus", async ({ page }) => {
  await register(page, undefined, { group: FLOW_GROUP });
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

test("Eine unterbrochene Abfrage lässt sich fortsetzen und nachholen", async ({ page }) => {
  await register(page, undefined, { group: FLOW_GROUP });
  const makeUp = page.locator("section").filter({ has: page.getByRole("heading", { name: "Nachholen" }) });
  await makeUp.getByRole("link", { name: "Nachholen" }).click();
  await expect(page.getByText("Woche 1 ·")).toBeVisible();
  await expect(page.getByText("wird nachgeholt")).toBeVisible();
  await page.getByRole("button", { name: "Los geht's" }).click();
  await page.getByRole("group", { name: SMILEY_QUESTION }).getByText("mittel").click();
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(page.getByText("Frage 2 von 3")).toBeVisible();

  // Abbrechen und später direkt bei der ersten offenen Frage weitermachen
  await page.goto("/");
  await makeUp.getByRole("link", { name: "Fortsetzen" }).click();
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
  await expect(page.getByRole("heading", { name: "Nachholen" })).toHaveCount(0);
  await expect(page.getByText("nachgeholt")).toBeVisible();
});

test("Uploads brauchen einen eigenen Eintrag und eine Audio-Frage", async ({ page }) => {
  await register(page, undefined, { group: FLOW_GROUP });
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
