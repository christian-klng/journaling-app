// Legt ein Admin-Konto an und gibt Benutzername und Einmal-Passwort aus. Damit entsteht der
// erste Admin nach dem Deployment; weitere legt ein Admin dann im Admin-Bereich an.
// Aufruf lokal: npm run admin:create
// Im Container: node --conditions=react-server --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/create-admin.ts
import { randomInt } from "node:crypto";
import postgres from "postgres";
import { generateTempPassword, hashPassword, TEMP_PASSWORD_TTL_MS } from "../src/lib/auth/password.ts";
import { generateUniqueName, normalizeLoginName } from "../src/lib/names.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const displayName = await generateUniqueName(
    async (name) => (await sql`select 1 from users where login_name = ${normalizeLoginName(name)}`).length > 0,
    randomInt,
  );
  const tempPassword = generateTempPassword();
  const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);

  await sql`
    insert into users (display_name, login_name, password_hash, role, must_change_password, temp_password_expires_at, consent_at)
    values (${displayName}, ${normalizeLoginName(displayName)}, ${await hashPassword(tempPassword)}, 'admin', true, ${expiresAt}, now())
  `;

  console.log("Admin-Konto angelegt.\n");
  console.log(`  Benutzername:    ${displayName}`);
  console.log(`  Einmal-Passwort: ${tempPassword}\n`);
  console.log("Das Passwort gilt 72 Stunden. Bei der ersten Anmeldung muss ein eigenes vergeben werden.");
} finally {
  await sql.end();
}
