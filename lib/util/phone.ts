import { parsePhoneNumberFromString } from "libphonenumber-js/min";

export type PhoneResult =
  | { ok: true; digits: string; display: string; international: boolean; tidied: boolean; country?: string }
  | { ok: false; reason: "empty" | "too_short" | "invalid"; digitCount: number };

const indian = (ten: string, tidied: boolean): PhoneResult => ({
  ok: true,
  digits: `91${ten}`,
  display: `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`,
  international: false,
  tidied,
});

/** Normalises a parent's WhatsApp number to digits only (§3 B5). Indian unless typed with + and another country code. */
export function normalizePhone(input: string): PhoneResult {
  const trimmed = input.trim();
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[\s\-.()+]/g, "");
  if (!/^\d*$/.test(digits)) return { ok: false, reason: "invalid", digitCount: digits.replace(/\D/g, "").length };
  if (digits.length === 0) return { ok: false, reason: "empty", digitCount: 0 };

  if (plus) {
    if (digits.startsWith("91")) {
      return digits.length === 12 ? indian(digits.slice(2), true) : { ok: false, reason: digits.length < 12 ? "too_short" : "invalid", digitCount: digits.length - 2 };
    }
    const pn = parsePhoneNumberFromString(`+${digits}`);
    if (!pn?.isPossible()) return { ok: false, reason: "invalid", digitCount: digits.length };
    // `country` is empty for numbers that are possible but not assigned (UK drama numbers, say);
    // the calling code's main country is still the right label.
    const region = pn.country ?? pn.getPossibleCountries()[0];
    const country = region ? new Intl.DisplayNames(["en"], { type: "region" }).of(region) : undefined;
    return { ok: true, digits, display: pn.formatInternational(), international: true, tidied: false, country };
  }

  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  if (local.length === 10) return indian(local, trimmed !== local);
  if (local.length === 12 && local.startsWith("91")) return indian(local.slice(2), true);
  if (local.length < 10) return { ok: false, reason: "too_short", digitCount: local.length };
  return { ok: false, reason: "invalid", digitCount: local.length };
}
