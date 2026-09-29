import "server-only";
import { and, count, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";

const WINDOW_MS = 15 * 60 * 1000;

export async function tooManyAttempts(key: string, limit: number) {
  const since = new Date(Date.now() - WINDOW_MS);
  const [row] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), gt(loginAttempts.createdAt, since)));
  return row.n >= limit;
}

export async function recordFailedAttempt(keys: string[]) {
  await db.insert(loginAttempts).values(keys.map((key) => ({ key })));
}

export async function clearAttempts(key: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}

export async function deleteOldAttempts() {
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - WINDOW_MS)));
}
