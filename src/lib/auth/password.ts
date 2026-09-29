import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { randomInt } from "node:crypto";

// OWASP-Empfehlung für Argon2id
const OPTIONS = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string) {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Ohne leicht verwechselbare Zeichen (0/O, 1/l/I), damit man das Passwort vorlesen kann
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateTempPassword(length = 8) {
  let out = "";
  for (let i = 0; i < length; i++) out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  return out;
}

export const TEMP_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;
