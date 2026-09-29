import { expect, type Page } from "@playwright/test";

export const PASSWORD = process.env.E2E_PASSWORD ?? "";
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.test";

if (!PASSWORD) throw new Error("E2E_PASSWORD fehlt. Bitte in .env setzen, siehe .env.example.");

export const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

export async function register(page: Page, email: string, team?: string) {
  await page.goto("/registrieren");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(PASSWORD);
  if (team) await page.getByLabel("Team").selectOption({ label: team });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Konto anlegen" }).click();
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: /^Menü für/ }).click();
  await page.getByRole("menuitem", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** Meldet den Admin an und legt das Konto beim ersten Lauf an. */
export async function loginAsAdmin(page: Page) {
  await login(page, ADMIN_EMAIL);
  try {
    await expect(page).toHaveURL(/\/admin$/, { timeout: 5000 });
  } catch {
    await register(page, ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/admin$/);
  }
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

/** Nimmt ein paar Sekunden auf und wartet, bis Transkript und Stichpunkte da sind. */
export async function record(page: Page, buttonName: string) {
  await page.getByRole("button", { name: buttonName }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("timer")).toHaveText(/00:0[2-9]/, { timeout: 15_000 });
  await dialog.getByRole("button", { name: "Aufnahme beenden" }).click();

  await expect(dialog.getByText("Dein Text")).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("listitem")).toHaveCount(3, { timeout: 30_000 });
  await dialog.getByRole("button", { name: "Fertig" }).click();
  await expect(dialog).toBeHidden();
}

export async function displayName(page: Page) {
  const label = await page.getByRole("button", { name: /^Menü für/ }).getAttribute("aria-label");
  return label!.replace("Menü für ", "");
}
