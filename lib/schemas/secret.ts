import { z } from "zod";

// Shared by the PIN setter in the browser and by the server, so it imports nothing from Node.

export const PASSPHRASE_MIN = 8;

// §9.1. Six of one digit are refused too (see validateSecret).
const EASY_PINS = new Set(["123456", "654321", "012345", "234567", "345678", "456789", "987654", "876543", "121212", "123123", "112233", "102030"]);

export const Secret = z.object({ kind: z.enum(["pin", "passphrase"]), value: z.string().max(200) });
export type Secret = z.infer<typeof Secret>;

/** Characters as people count them: code points, ignoring spaces at the ends. */
export const passphraseLength = (value: string) => [...value.trim()].length;

export function validateSecret({ kind, value }: Secret): "format" | "easy" | "short" | null {
  if (kind === "passphrase") return passphraseLength(value) >= PASSPHRASE_MIN ? null : "short";
  if (!/^\d{6}$/.test(value)) return "format";
  return EASY_PINS.has(value) || /^(\d)\1{5}$/.test(value) ? "easy" : null;
}
