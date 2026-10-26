import { hash } from "@node-rs/argon2";
import postgres from "postgres";
import { ADMIN_LOGIN_NAME, ADMIN_NAME, PASSWORD } from "./helpers";

/**
 * Leert die Zähler der Anmeldeversuche, damit wiederholte Testläufe nicht ausgebremst werden,
 * und legt den Test-Admin an. In Produktion entsteht der erste Admin über scripts/create-admin.ts.
 */
export default async function globalSetup() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await sql`delete from login_attempts`;
  // Ein abgebrochener Lauf könnte die zufällige Zuordnung eingeschaltet zurücklassen
  await sql`delete from settings where key = 'random_group_assignment'`;
  await sql`
    insert into users (display_name, login_name, password_hash, role, consent_at)
    values (${ADMIN_NAME}, ${ADMIN_LOGIN_NAME}, ${await hash(PASSWORD)}, 'admin', now())
    on conflict (login_name) do update
      set password_hash = excluded.password_hash, role = 'admin', must_change_password = false
  `;
  await sql.end();
}
