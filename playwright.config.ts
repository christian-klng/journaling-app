import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env");
} catch {
  // Ohne .env gelten die Variablen aus der Umgebung
}

const PORT = 3200;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // Die Abläufe bauen aufeinander auf und teilen sich eine Datenbank
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "de-DE",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobil",
      use: {
        ...devices["Pixel 7"],
        launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      CORTECS_MOCK: "true",
      ADMIN_EMAILS: process.env.E2E_ADMIN_EMAIL ?? "admin@example.test",
      // Eigener Build-Ordner, damit ein parallel laufender Dev-Server nicht gestört wird
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
