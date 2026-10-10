import { expect, test } from "@playwright/test";
import {
  ensureTeam,
  login,
  loginAsAdmin,
  logout,
  PASSWORD,
  record,
  register,
  useFakeMicrophone,
} from "./helpers";

const TEAM = "E2E-Team";
const TRANSCRIPT = "Das ist ein Beispieltranskript.";
let userName = "";
let entryUrl = "";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await useFakeMicrophone(page);
});

test("Admin legt ein Team an", async ({ page }) => {
  await loginAsAdmin(page);
  await ensureTeam(page, TEAM);
});

test("Nutzer registriert sich mit einem Fantasienamen als Benutzernamen", async ({ page }) => {
  userName = await register(page, TEAM);
  expect(userName).toMatch(/^\p{Lu}\p{L}+ \p{Lu}\p{L}+( \d+)?$/u);
  await expect(page.getByText(`Dein Benutzername ist ${userName}`)).toBeVisible();
  await expect(page.getByRole("button", { name: `Menü für ${userName}` })).toBeVisible();
});

test("Die Registrierung nimmt nur vorgeschlagene Namen an", async ({ page }) => {
  await page.goto("/registrieren");
  const field = page.getByLabel("Dein Benutzername");
  const proposed = await field.inputValue();

  await page.getByRole("button", { name: "Anderen Namen vorschlagen" }).click();
  await expect(field).not.toHaveValue(proposed);

  // Das Feld ist schreibgeschützt; wer es im Browser umgeht, bekommt einen neuen Vorschlag
  await field.evaluate((input: HTMLInputElement) => {
    input.removeAttribute("readonly");
    input.value = "Max Mustermann";
  });
  await page.getByLabel("Passwort", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Passwort wiederholen").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page.getByText("Bitte nimm den vorgeschlagenen Namen.")).toBeVisible();
  await expect(field).not.toHaveValue("Max Mustermann");
});

test("Nutzer nimmt einen Eintrag auf und setzt ihn fort", async ({ page }) => {
  // Groß- und Kleinschreibung spielt bei der Anmeldung keine Rolle
  await login(page, userName.toLowerCase());
  await expect(page).toHaveURL(/\/$/);

  await record(page, "Neuer Eintrag");
  const card = page.getByRole("link").filter({ hasText: TRANSCRIPT });
  await expect(card).toHaveCount(1);

  await card.click();
  await expect(page).toHaveURL(/\/eintraege\/[0-9a-f-]{36}$/);
  entryUrl = page.url();
  await expect(page.locator("audio")).toHaveCount(1);

  await record(page, "Aufnahme fortsetzen");
  await expect(page.getByRole("heading", { name: "2 Aufnahmen" })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(2);
  await expect(page.getByText(TRANSCRIPT)).toHaveCount(2, { timeout: 30_000 });
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

test("Admin sieht die Person im Team und ihre Einträge", async ({ page }) => {
  await loginAsAdmin(page);

  const team = page.locator("details").filter({ has: page.getByRole("heading", { name: TEAM }) });
  await expect(team.getByRole("link", { name: new RegExp(userName) })).toContainText("1 Eintrag");

  await team.getByRole("link", { name: new RegExp(userName) }).click();
  await expect(page.getByRole("heading", { name: userName })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(2);
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
  const folder = `${TEAM}/${userName.replace(/ /g, "-")}`;
  expect(names).toContain(Buffer.from(`${folder}/`, "utf8").toString("latin1"));
  for (const file of ["aufnahme-01.mp3", "aufnahme-01.txt", "aufnahme-02.mp3", "uebersicht.csv"]) {
    expect(names).toContain(file);
  }
  expect(names).not.toContain("zusammenfassung.txt");
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
  await page.goto("/admin/teams");
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
  await page.goto("/admin/teams");
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

test("Admin ordnet die Person einem anderen Team zu", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("link", { name: new RegExp(userName) }).click();
  await expect(page.getByRole("heading", { name: userName })).toBeVisible();
  await page.getByLabel("Team").selectOption({ label: "Ohne Team" });
  await page.waitForLoadState("networkidle");

  await page.goto("/admin");
  const withoutTeam = page
    .locator("details")
    .filter({ has: page.getByRole("heading", { name: "Ohne Team" }) });
  await expect(withoutTeam.getByRole("link", { name: new RegExp(userName) })).toBeVisible();
});
