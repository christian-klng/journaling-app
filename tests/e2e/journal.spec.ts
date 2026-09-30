import { expect, test } from "@playwright/test";
import {
  displayName,
  ensureTeam,
  login,
  loginAsAdmin,
  logout,
  PASSWORD,
  record,
  register,
  uniqueEmail,
  useFakeMicrophone,
} from "./helpers";

const TEAM = "E2E-Team";
const userEmail = uniqueEmail("nutzer");
const otherEmail = uniqueEmail("andere");
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

test("Nutzer registriert sich und bekommt einen Fantasienamen", async ({ page }) => {
  await register(page, userEmail, TEAM);
  await expect(page).toHaveURL(/\/\?willkommen=1$/);

  userName = await displayName(page);
  expect(userName).toMatch(/^\p{Lu}\p{L}+ \p{Lu}\p{L}+( \d+)?$/u);
  await expect(page.getByText(`Dein Name hier ist ${userName}`)).toBeVisible();
  // Die eigene Adresse sieht nur die Person selbst: im Willkommenstext und im Menü
  await expect(page.getByText(`Angemeldet bist du als ${userEmail}`)).toBeVisible();
  await page.getByRole("button", { name: /^Menü für/ }).click();
  await expect(page.getByRole("menu")).toContainText(userEmail);
});

test("Nutzer nimmt einen Eintrag auf und setzt ihn fort", async ({ page }) => {
  await login(page, userEmail);
  await expect(page).toHaveURL(/\/$/);

  await record(page, "Neuer Eintrag");
  const card = page.getByRole("link").filter({ has: page.getByRole("listitem") });
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("listitem").first()).toHaveText("Ich habe eine Aufnahme eingesprochen.");

  await card.click();
  await expect(page).toHaveURL(/\/eintraege\/[0-9a-f-]{36}$/);
  entryUrl = page.url();
  await expect(page.locator("audio")).toHaveCount(1);

  await record(page, "Aufnahme fortsetzen");
  await expect(page.getByRole("heading", { name: "2 Aufnahmen" })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(2);
  // Die Zusammenfassung wurde über beide Aufnahmen neu erstellt
  await expect(page.getByText("Ich habe 2 Aufnahmen eingesprochen.")).toBeVisible({ timeout: 30_000 });
});

test("Audio lässt sich abspielen", async ({ page }) => {
  await login(page, userEmail);
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
  await register(page, otherEmail);
  await expect(page).toHaveURL(/\/\?willkommen=1$/);

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

test("Admin sieht die Person im Team, die E-Mail-Adresse nur auf ihrer Seite", async ({ page }) => {
  await loginAsAdmin(page);

  const team = page.locator("details").filter({ has: page.getByRole("heading", { name: TEAM }) });
  await expect(team.getByRole("link", { name: new RegExp(userName) })).toContainText("1 Eintrag");
  await expect(page.getByText("@example.test")).toHaveCount(0);

  await team.getByRole("link", { name: new RegExp(userName) }).click();
  await expect(page.getByRole("heading", { name: userName })).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(2);
  await expect(page.getByText("Das ist ein Beispieltranskript.").first()).toBeVisible();
  await expect(page.getByText(userEmail)).toBeVisible();
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
  for (const file of ["zusammenfassung.txt", "aufnahme-01.mp3", "aufnahme-01.txt", "aufnahme-02.mp3"]) {
    expect(names).toContain(Buffer.from(`${folder}/`, "utf8").toString("latin1"));
    expect(names).toContain(file);
  }
  expect(names).toContain("uebersicht.csv");
  expect(names).not.toContain("@example.test");
});

test("Admin setzt das Passwort zurück, Nutzer muss ein neues vergeben", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByLabel("E-Mail-Adresse").fill(userEmail);
  await page.getByRole("button", { name: "Konto finden" }).click();
  await page.getByRole("link", { name: userName }).first().click();

  await page.getByRole("button", { name: "Passwort zurücksetzen" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`Einmal-Passwort für ${userName}`);
  const tempPassword = (await dialog.locator("p.font-mono").textContent())!;
  expect(tempPassword).toMatch(/^[a-z2-9]{8}$/);
  await dialog.getByRole("button", { name: "Ich habe es weitergegeben" }).click();
  await logout(page);

  // Das alte Passwort gilt nicht mehr
  await login(page, userEmail);
  await expect(page.getByText("E-Mail-Adresse oder Passwort stimmen nicht.")).toBeVisible();

  await login(page, userEmail, tempPassword);
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
  await login(page, userEmail, newPassword);
  await expect(page).toHaveURL(/\/$/);
  // Das Einmal-Passwort ist nach dem Wechsel verbraucht
  await logout(page);
  await login(page, userEmail, tempPassword);
  await expect(page.getByText("E-Mail-Adresse oder Passwort stimmen nicht.")).toBeVisible();
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
