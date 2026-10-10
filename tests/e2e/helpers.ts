import { expect, type Page } from "@playwright/test";

export const PASSWORD = process.env.E2E_PASSWORD ?? "";
// Kein Fantasiename, damit er nie mit einem erzeugten Namen kollidiert
export const ADMIN_NAME = "E2E Admin";
export const ADMIN_LOGIN_NAME = "e2e admin";

if (!PASSWORD) throw new Error("E2E_PASSWORD fehlt. Bitte in .env setzen, siehe .env.example.");

/** Registriert ein Konto und gibt den vergebenen Fantasienamen zurück. */
export async function register(page: Page, team?: string) {
  await page.goto("/registrieren");
  const name = await page.getByLabel("Dein Benutzername").inputValue();
  await page.getByLabel("Passwort", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Passwort wiederholen").fill(PASSWORD);
  if (team) await page.getByLabel("Team").selectOption({ label: team });
  await page.getByRole("checkbox").check();
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

export async function ensureTeam(page: Page, name: string) {
  await page.goto("/admin/teams");
  if ((await page.getByLabel(`Name von Team ${name}`).count()) > 0) return;
  await page.getByLabel("Name des neuen Teams").fill(name);
  await page.getByRole("button", { name: "Team anlegen" }).click();
  await expect(page.getByLabel(`Name von Team ${name}`)).toBeVisible();
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

/** Nimmt ein paar Sekunden auf und wartet, bis das Transkript da ist. */
export async function record(page: Page, buttonName: string) {
  await page.getByRole("button", { name: buttonName }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("timer")).toHaveText(/00:0[2-9]/, { timeout: 15_000 });
  await dialog.getByRole("button", { name: "Aufnahme beenden" }).click();

  await expect(dialog.getByText("Dein Text")).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole("button", { name: "Fertig" }).click();
  await expect(dialog).toBeHidden();
}
