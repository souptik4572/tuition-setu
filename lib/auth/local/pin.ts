import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Secret } from "@/lib/schemas/secret";

const scryptAsync = promisify(scrypt) as (secret: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_BYTES = 64;

// A passphrase typed on another device may differ only in spaces at the ends or in how the
// keyboard composed Bengali or Devanagari letters; neither should lock the tutor out.
const normalize = ({ kind, value }: Secret) => (kind === "passphrase" ? value.trim().normalize("NFC") : value);

/** PINs and passphrases hash the same way (§9.1). */
export async function hashPin(secret: Secret): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(normalize(secret), salt, KEY_BYTES);
  return { hash: hash.toString("base64"), salt: salt.toString("base64") };
}

export async function verifyPin(secret: Secret, hash: string, salt: string): Promise<boolean> {
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(normalize(secret), Buffer.from(salt, "base64"), KEY_BYTES);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
