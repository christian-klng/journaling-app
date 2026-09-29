import postgres from "postgres";

/** Leert die Zähler der Anmeldeversuche, damit wiederholte Testläufe nicht ausgebremst werden. */
export default async function globalSetup() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  await sql`delete from login_attempts`;
  await sql.end();
}
