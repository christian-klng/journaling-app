import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import {
  completeQuestionnaire,
  ensureGroup,
  FLOW_GROUP,
  login,
  loginAsAdmin,
  logout,
  PASSWORD,
  randomCodeStem,
  register,
  setupStudy,
  useFakeMicrophone,
} from "./helpers";

const stem = randomCodeStem();
let userName = "";
let twinName = "";
let twinUrl = "";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await useFakeMicrophone(page);
});

test("Admin legt die Gruppen an", async ({ page }) => {
  await loginAsAdmin(page);
  await ensureGroup(page, "Z");
  await ensureGroup(page, "Y");
  await setupStudy(page);
});

test("Teilnehmende sehen bei der Registrierung nur die Buchstaben der Gruppen", async ({ page }) => {
  await page.goto("/registrieren");
  await expect(page.getByLabel("Deine Gruppe").getByRole("option", { name: "Gruppe Z" })).toBeAttached();
  await expect(page.getByText("E2E Gruppe")).toHaveCount(0);
});

test("Ohne Gruppe blinkt ein roter Punkt, die Gruppe lässt sich einmal eintragen", async ({ page }) => {
  userName = await register(page, { codeStem: stem });
  await expect(page.getByText("Deine Gruppe fehlt noch.")).toBeVisible();
  await expect(page.getByRole("button", { name: `Menü für ${userName}, Gruppe fehlt` })).toBeVisible();

  await page.getByRole("button", { name: /^Menü für/ }).click();
  await page.getByRole("menuitem", { name: "Code und Gruppe" }).click();
  await expect(page.getByText(`${stem}-?`)).toBeVisible();
  await expect(page.getByText("Noch nicht eingetragen")).toBeVisible();

  await page.getByLabel("Deine Gruppe").selectOption({ label: "Gruppe Z" });
  await page.getByRole("button", { name: "Gruppe eintragen" }).click();
  await expect(page.getByText(`${stem}-Z`)).toBeVisible();
  // Danach gibt es kein Formular mehr, ändern kann nur die Studienleitung
  await expect(page.getByRole("button", { name: "Gruppe eintragen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Menü für ${userName}` })).not.toHaveAccessibleName(/Gruppe fehlt/);

  await page.goto("/");
  await expect(page.getByText("Deine Gruppe fehlt noch.")).toHaveCount(0);
});

test("Die Gruppe lässt sich schon bei der Registrierung wählen", async ({ page }) => {
  await register(page, { group: "Y" });
  await expect(page.getByText("Deine Gruppe fehlt noch.")).toHaveCount(0);
  await page.goto("/profil");
  await expect(page.getByText("Gruppe Y", { exact: true })).toBeVisible();
});

test("Bei zufälliger Zuordnung bekommen neue Teilnehmende sofort eine Gruppe", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/studie");
  await page.getByRole("button", { name: "Zufällige Zuordnung einschalten" }).click();
  await expect(page.getByRole("button", { name: "Zufällige Zuordnung ausschalten" })).toBeVisible();
  await logout(page);

  try {
    await page.goto("/registrieren");
    await expect(page.getByLabel("Deine Gruppe")).toHaveCount(0);
    const code = randomCodeStem();
    await register(page, { codeStem: code });
    await expect(page.getByText("Deine Gruppe fehlt noch.")).toHaveCount(0);
    await expect(page.getByText(new RegExp(`dein persönlicher Code ist ${code}-[A-Z]`))).toBeVisible();
    await page.goto("/profil");
    await expect(page.getByText("Noch nicht eingetragen")).toHaveCount(0);
    await logout(page);
  } finally {
    await loginAsAdmin(page);
    await page.goto("/admin/studie");
    await page.getByRole("button", { name: "Zufällige Zuordnung ausschalten" }).click();
    await expect(page.getByRole("button", { name: "Zufällige Zuordnung einschalten" })).toBeVisible();
  }
});

test("Admin sieht den Code und ändert die Gruppe", async ({ page }) => {
  await loginAsAdmin(page);
  const row = page.getByRole("link", { name: new RegExp(userName) });
  await expect(row).toContainText(`${stem}-Z`);

  await row.click();
  await page.getByLabel("Gruppe", { exact: true }).selectOption({ label: "Gruppe Y – E2E Gruppe Y" });
  await expect(page.getByText(`${stem}-Y`)).toBeVisible();
});

test("Admin weist Gruppen gesammelt zu", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByLabel("Codes mit Gruppe, eine Zeile pro Person").fill(`${stem} z\nAB-99-CD A\nkein code`);
  await page.getByRole("button", { name: "Gruppen zuweisen" }).click();

  const report = page.getByRole("status").filter({ hasText: "zugewiesen" });
  await expect(report).toContainText("1 Person zugewiesen.");
  await expect(report).toContainText("Zeile 2: „AB-99-CD A“ ist kein gültiger Code mit Gruppe.");
  await expect(report).toContainText("Zeile 3: „kein code“ ist kein gültiger Code mit Gruppe.");
  await expect(page.getByRole("link", { name: new RegExp(userName) })).toContainText(`${stem}-Z`);
});

test("Doppelte Codes fallen auf und lassen sich korrigieren", async ({ page }) => {
  twinName = await register(page, { codeStem: stem, group: FLOW_GROUP });
  await completeQuestionnaire(page);
  await logout(page);

  // Gleicher Code und gleiche Gruppe lassen sich nicht unterscheiden
  await loginAsAdmin(page);
  await page.getByRole("link", { name: new RegExp(userName) }).click();
  await page.getByLabel("Gruppe", { exact: true }).selectOption({ label: `Gruppe ${FLOW_GROUP} – E2E Ablauf` });
  await expect(page.getByText(`${stem}-${FLOW_GROUP}`)).toBeVisible();
  await page.goto("/admin");
  const alert = page.getByRole("alert").filter({ hasText: "Doppelte Codes" });
  await expect(alert).toContainText(stem);
  await expect(alert).toContainText(userName);
  await expect(alert).toContainText(twinName);

  await page.getByRole("link", { name: new RegExp(twinName) }).click();
  await expect(page.getByRole("heading", { name: twinName })).toBeVisible();
  twinUrl = page.url();
  const corrected = randomCodeStem();
  await page.getByLabel("Persönlicher Code ohne Gruppe").fill(corrected.toLowerCase());
  await page.getByRole("button", { name: "Korrigieren" }).click();
  await expect(page.getByText(`${corrected}-${FLOW_GROUP}`)).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("alert").filter({ hasText: "Doppelte Codes" })).toHaveCount(0);
});

test("Admin löscht ein Konto samt Aufnahmen", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(twinUrl);
  await page.getByRole("button", { name: "Konto löschen" }).click();
  await expect(page).toHaveURL(/\/admin\?geloescht=1$/);
  await expect(page.getByText("Das Konto wurde mit allen Einträgen und Aufnahmen gelöscht.")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(twinName) })).toHaveCount(0);

  // Auch die Audiodateien sind aus dem Speicher verschwunden
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  const userId = twinUrl.split("/").pop();
  const listing = await s3.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET, Prefix: `users/${userId}/` }));
  expect(listing.KeyCount ?? 0).toBe(0);

  await logout(page);
  await login(page, twinName);
  await expect(page.getByText("Benutzername oder Passwort stimmen nicht.")).toBeVisible();
});

test("Konten ohne Code müssen ihn zuerst nachtragen", async ({ page }) => {
  const name = await register(page);
  // Wie bei Konten, die vor dem persönlichen Code angelegt wurden
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  await sql`update users set code_stem = null where display_name = ${name}`;
  await sql.end();

  await page.goto("/");
  await expect(page).toHaveURL(/\/profil$/);
  await expect(page.getByText("Bevor es weitergeht, bilde bitte einmal deinen persönlichen Code.")).toBeVisible();

  const code = randomCodeStem();
  const [mother, month, birthplace] = code.split("-");
  await page.getByLabel("Vornamens deiner Mutter").fill(mother);
  await page.getByLabel("Dein Geburtsmonat").selectOption(month);
  await page.getByLabel("Geburtsortes").fill(birthplace);
  await page.getByRole("button", { name: "Code speichern" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/profil");
  await expect(page.getByText(`${code}-?`)).toBeVisible();
});

test("Teilnehmende beenden ihre Teilnahme selbst, die Studienleitung erfährt Name und Code", async ({ page }) => {
  const code = randomCodeStem();
  const name = await register(page, { codeStem: code, group: FLOW_GROUP });
  await completeQuestionnaire(page);

  await page.getByRole("button", { name: /Menü für/ }).click();
  await expect(page.getByRole("menuitem", { name: "Teilnahme beenden" })).toHaveCount(0);
  await page.goto("/datenschutz");
  await page.getByRole("link", { name: "„Teilnahme beenden“" }).click();
  await page.getByLabel("Zur Bestätigung dein Passwort").fill("falsch-falsch");
  await page.getByRole("button", { name: "Konto und Einträge löschen" }).click();
  await expect(page.getByText("Das Passwort stimmt nicht.")).toBeVisible();

  await page.getByLabel("Zur Bestätigung dein Passwort").fill(PASSWORD);
  await page.getByRole("button", { name: "Konto und Einträge löschen" }).click();
  await expect(page).toHaveURL(/\/login\?geloescht=1$/);
  await expect(page.getByText("Dein Konto und alle Einträge sind gelöscht.")).toBeVisible();

  await login(page, name);
  await expect(page.getByText("Benutzername oder Passwort stimmen nicht.")).toBeVisible();

  await loginAsAdmin(page);
  const notices = page.getByRole("alert").filter({ hasText: "Gelöschte Konten" });
  const notice = notices.getByRole("listitem").filter({ hasText: name });
  await expect(notice).toContainText(`${code}-${FLOW_GROUP}`);
  await expect(notice).toContainText("selbst beendet");
  await notice.getByRole("button", { name: "Erledigt" }).click();
  await expect(notices.getByRole("listitem").filter({ hasText: name })).toHaveCount(0);
});

test("Datenschutz und Impressum sind ohne Anmeldung erreichbar", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Datenschutz" }).click();
  await expect(page.getByRole("heading", { name: "Datenschutzinformation" })).toBeVisible();
  await page.getByRole("link", { name: "Impressum" }).click();
  await expect(page.getByRole("heading", { name: "Impressum" })).toBeVisible();
});
