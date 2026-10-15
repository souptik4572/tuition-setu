/**
 * For comparing names: lowercase, no punctuation, single spaces. Only Latin accents are removed:
 * Bengali and Devanagari vowel signs are combining marks too, and stripping them changes the name.
 */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .replace(/['’‘`]/g, "")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches the term as a whole word in any script. `\b` only knows ASCII letters, so it fails for Bengali and Devanagari. */
export function wholeWord(term: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{M}\\p{N}])`, "giu");
}
