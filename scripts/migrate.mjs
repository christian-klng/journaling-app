// Führt ausstehende Migrationen aus. Läuft auf Railway als Pre-Deploy-Befehl.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt");
  process.exit(1);
}

// Railways privates Netz (postgres.railway.internal) ist in den ersten Sekunden nach dem
// Containerstart noch nicht auflösbar, deshalb wird die Verbindung mehrfach versucht.
const RETRY_CODES = new Set(["EAI_AGAIN", "ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"]);
const MAX_WAIT_MS = 90_000;
const started = Date.now();

for (let attempt = 1; ; attempt++) {
  const client = postgres(url, { max: 1, connect_timeout: 10, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.end();
    console.log("Migrationen angewendet");
    break;
  } catch (error) {
    await client.end({ timeout: 1 }).catch(() => {});
    const code = error?.code ?? error?.cause?.code;
    if (!RETRY_CODES.has(code) || Date.now() - started > MAX_WAIT_MS) throw error;
    console.log(`Datenbank noch nicht erreichbar (${code}), Versuch ${attempt} wird wiederholt …`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
