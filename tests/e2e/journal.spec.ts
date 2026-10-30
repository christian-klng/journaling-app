import { expect, test } from "@playwright/test";
import {
  completeQuestionnaire,
  FLOW_GROUP,
  FLOW_QUESTIONNAIRE,
  login,
  loginAsAdmin,
  logout,
  PASSWORD,
  randomCodeStem,
  readZipEntry,
  register,
  setupStudy,
  SMILEY_QUESTION,
  useFakeMicrophone,
} from "./helpers";

const TRANSCRIPT = "Das ist ein Beispieltranskript.";
let userName = "";
const userStem = randomCodeStem();
const userCode = `${userStem}-${FLOW_GROUP}`;
let entryUrl = "";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await useFakeMicrophone(page);
});

test("Admin legt die Studie an", async ({ page }) => {
  await loginAsAdmin(page);
  await setupStudy(page);
});

test("Nutzer registriert sich mit einem Fantasienamen als Benutzernamen", async ({ page }) => {
  userName = await register(page, { codeStem: userStem, group: FLOW_GROUP });
  expect(userName).toMatch(/^\p{Lu}\p{L}+ \p{Lu}\p{L}+( \d+)?$/u);
  await expect(page.getByText(`Dein Benutzername ist ${userName}`)).toBeVisible();
  await expect(page.getByRole("button", { name: `Menü für ${userName}` })).toBeVisible();
});

test("Die Registrierung nimmt nur vorgeschlagene Namen an", async ({ page }) => {
  await page.goto("/registrieren");
  const choices = page.getByRole("group", { name: "Dein Benutzername" }).getByRole("radio");
  await expect(choices).toHaveCount(3);
  await expect(choices.first()).toBeChecked();
  const proposed = await choices.first().inputValue();

  await page.getByRole("button", { name: "Andere Namen vorschlagen" }).click();
  await expect(choices.first()).not.toHaveValue(proposed);
  await expect(choices.first()).toBeChecked();

  await choices.nth(1).check({ force: true });
  await expect(choices.nth(1)).toBeChecked();

  // Wer im Browser einen eigenen Namen einschmuggelt, bekommt einen neuen Vorschlag
  const field = page.getByRole("radio", { checked: true });
  await field.evaluate((input: HTMLInputElement) => (input.value = "Max Mustermann"));
  await page.getByLabel("Passwort", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Passwort wiederholen").fill(PASSWORD);
  await page.getByLabel("Vornamens deiner Mutter").fill("KA");
  await page.getByLabel("Dein Geburtsmonat").selectOption("03");
  await page.getByLabel("Geburtsortes").fill("BE");
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page.getByText("Bitte nimm einen der vorgeschlagenen Namen.")).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).not.toHaveValue("Max Mustermann");
});

test("Nutzer füllt eine Abfrage aus und sieht seine Antworten", async ({ page }) => {
  // Groß- und Kleinschreibung spielt bei der Anmeldung keine Rolle
  await login(page, userName.toLowerCase());
  await expect(page).toHaveURL(/\/$/);

  await completeQuestionnaire(page);
  await page.getByRole("link", { name: new RegExp(`Woche 2 · ${FLOW_QUESTIONNAIRE}`) }).click();
  await expect(page).toHaveURL(/\/eintraege\/[0-9a-f-]{36}$/);
  entryUrl = page.url();

  await expect(page.getByText(SMILEY_QUESTION)).toBeVisible();
  await expect(page.getByText("eher gut")).toBeVisible();
  await expect(page.getByText("von 10")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(1);
  await expect(page.getByText(TRANSCRIPT)).toBeVisible({ timeout: 30_000 });
});

test("Audio lässt sich abspielen", async ({ page }) => {
  await login(page, userName);
  await expect(page).toHaveURL(/\/$/);
  await page.goto(entryUrl);

  const duration = await page.locator("audio").first().evaluate(
    (audio: HTMLAudioElement) =>
      new Promise<number>((resolve, reject) => {
        audio.addEventListener("loadedmetadata", () => resolve(audio.duration), { once: true });
        audio.addEventListener("error", () => reject(new Error("Audio lädt nicht")), { once: true });
        audio.preload = "metadata";
        audio.load();
      }),
  );
  expect(duration).toBeGreaterThan(1);
});

test("Fremde Einträge und der Admin-Bereich sind gesperrt", async ({ page }) => {
  await register(page);

  const entryId = entryUrl.split("/").pop();
  await page.goto(entryUrl);
  await expect(page.getByText("Diese Seite gibt es nicht")).toBeVisible();
  expect((await page.request.get(`/api/entries/${entryId}`)).status()).toBe(404);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
  expect((await page.request.get("/api/admin/export")).status()).toBe(403);
});

test("Ohne Anmeldung geht nichts", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/admin/export")).status()).toBe(401);
  expect((await page.request.get(`/api/entries/${entryUrl.split("/").pop()}`)).status()).toBe(401);
});

test("Admin sieht die Person in ihrer Gruppe und ihre Einträge", async ({ page }) => {
  await loginAsAdmin(page);

  const group = page
    .locator("details")
    .filter({ has: page.getByRole("heading", { name: new RegExp(`^Gruppe ${FLOW_GROUP}\\b`) }) });
  await expect(group.getByRole("link", { name: new RegExp(userName) })).toContainText("1 Eintrag");

  await group.getByRole("link", { name: new RegExp(userName) }).click();
  await expect(page.getByRole("heading", { name: userName })).toBeVisible();
  await expect(page.getByRole("heading", { name: new RegExp(`Woche 2 · ${FLOW_QUESTIONNAIRE}`) })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(1);
  await expect(page.getByText(TRANSCRIPT).first()).toBeVisible();
});

test("Admin exportiert die Einträge als ZIP", async ({ page }) => {
  await loginAsAdmin(page);

  const response = await page.request.get("/api/admin/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/zip");

  const zip = await response.body();
  expect(zip.subarray(0, 2).toString()).toBe("PK");
  // Dateinamen stehen unkomprimiert im Archiv
  const names = zip.toString("latin1");
  const utf8 = (text: string) => Buffer.from(text, "utf8").toString("latin1");
  const folder = `Gruppe-${FLOW_GROUP}/${userCode}_${userName.replace(/ /g, "-")}/W02_${FLOW_QUESTIONNAIRE}`;
  for (const file of ["frage-03_aufnahme-01.mp3", "frage-03_aufnahme-01.txt"]) {
    expect(names).toContain(utf8(`${folder}/${file}`));
  }
  for (const file of ["antworten.csv", "teilnahme.csv", "liesmich.txt"]) expect(names).toContain(file);
  expect(names).not.toContain("uebersicht.csv");

  // Eine Zeile pro Antwort der Person: Smiley, Skala und Audio
  const answers = readZipEntry(zip, "antworten.csv").split("\r\n").filter((line) => line.includes(userCode));
  expect(answers).toHaveLength(3);
  expect(answers[0]).toContain(`"${SMILEY_QUESTION}";"4";"eher gut"`);
  expect(answers[1]).toContain(`"7";""`);
  expect(answers[2]).toMatch(new RegExp(`"Audio";"[^"]+";"";"";"${TRANSCRIPT}[^"]*";"1";`));
  expect(answers[2]).toContain(`W02_${FLOW_QUESTIONNAIRE}/frage-03_aufnahme-01.mp3`);

  // Woche 1 verpasst, Woche 2 erledigt
  const participation = readZipEntry(zip, "teilnahme.csv").split("\r\n").filter((line) => line.includes(userCode));
  expect(participation).toHaveLength(2);
  expect(participation[0]).toContain(`"1";`);
  expect(participation[0]).toContain(`"verpasst"`);
  expect(participation[1]).toContain(`"erledigt"`);
});

test("Admin setzt das Passwort zurück, Nutzer muss ein neues vergeben", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("link", { name: new RegExp(userName) }).first().click();

  await page.getByRole("button", { name: "Passwort zurücksetzen" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`Einmal-Passwort für ${userName}`);
  const tempPassword = (await dialog.locator("p.font-mono").textContent())!;
  expect(tempPassword).toMatch(/^[a-z2-9]{8}$/);
  await dialog.getByRole("button", { name: "Ich habe es weitergegeben" }).click();
  await logout(page);

  // Das alte Passwort gilt nicht mehr
  await login(page, userName);
  await expect(page.getByText("Benutzername oder Passwort stimmen nicht.")).toBeVisible();

  await login(page, userName, tempPassword);
  await expect(page).toHaveURL(/\/passwort-aendern$/);
  // Vor dem Wechsel führt jeder Weg zurück zum Formular
  await page.goto("/");
  await expect(page).toHaveURL(/\/passwort-aendern$/);

  const newPassword = `${PASSWORD}-neu`;
  await page.getByLabel("Neues Passwort", { exact: true }).fill(newPassword);
  await page.getByLabel("Neues Passwort wiederholen").fill(newPassword);
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page).toHaveURL(/\/\?passwort=geaendert$/);

  await logout(page);
  await login(page, userName, newPassword);
  await expect(page).toHaveURL(/\/$/);
  // Das Einmal-Passwort ist nach dem Wechsel verbraucht
  await logout(page);
  await login(page, userName, tempPassword);
  await expect(page.getByText("Benutzername oder Passwort stimmen nicht.")).toBeVisible();
});

test("Admin legt ein weiteres Admin-Konto an und löscht es wieder", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/admins");
  await page.getByRole("button", { name: "Admin anlegen" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Neues Admin-Konto");
  const adminName = (await dialog.locator("dd").first().textContent())!;
  const tempPassword = (await dialog.locator("dd.font-mono").textContent())!;
  await dialog.getByRole("button", { name: "Ich habe es weitergegeben" }).click();
  await logout(page);

  await login(page, adminName, tempPassword);
  await expect(page).toHaveURL(/\/passwort-aendern$/);
  await expect(page.getByText(`Dein Benutzername ist ${adminName}`)).toBeVisible();
  const newPassword = `${PASSWORD}-admin`;
  await page.getByLabel("Neues Passwort", { exact: true }).fill(newPassword);
  await page.getByLabel("Neues Passwort wiederholen").fill(newPassword);
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await logout(page);

  await loginAsAdmin(page);
  await page.goto("/admin/admins");
  const row = page.getByRole("listitem").filter({ hasText: adminName });
  await row.getByRole("button", { name: "Konto löschen" }).click();
  await expect(row).toHaveCount(0);
});

test("Admin pflegt den Hinweistext für die Transkription", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("link", { name: "Einstellungen" }).click();
  const field = page.getByLabel("Hinweistext für die Transkription");
  const text = `Wöchentlicher Rückblick, Themen: MVP, OKRs, Pitch-Deck. Stand ${Date.now()}`;
  await field.fill(text);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("status")).toContainText("Gespeichert");

  await page.reload();
  await expect(page.getByLabel("Hinweistext für die Transkription")).toHaveValue(text);
});

test("Admin nimmt die Person aus ihrer Gruppe", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("link", { name: new RegExp(userName) }).click();
  await expect(page.getByRole("heading", { name: userName })).toBeVisible();
  await page.getByLabel("Gruppe", { exact: true }).selectOption({ label: "Keine Gruppe" });
  await page.waitForLoadState("networkidle");

  await page.goto("/admin");
  const withoutGroup = page
    .locator("details")
    .filter({ has: page.getByRole("heading", { name: "Ohne Gruppe" }) });
  await expect(withoutGroup.getByRole("link", { name: new RegExp(userName) })).toBeVisible();
});
