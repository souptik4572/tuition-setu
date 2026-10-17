import type { Language } from "@/lib/schemas/common";
import type { StudentFacts } from "@/lib/schemas/facts";
import type { GuardIssue, GuardResult } from "@/lib/schemas/guard";
import { extractNumbers } from "@/lib/util/digits";
import { normalizeName, wholeWord } from "@/lib/util/text";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A name as a whole word. Bengali attaches case endings to the name ("তন্ময়ের" = Tanmoy's),
 * which `wholeWord` would miss; Hindi writes them as separate words, so it needs nothing extra.
 */
function nameMatcher(name: string, language: Language): RegExp {
  if (language !== "bn") return wholeWord(name);
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escape(name)}(?:ের|এর|-এর|র|কে|দের)?(?![\\p{L}\\p{M}\\p{N}])`, "giu");
}

/** Every number written anywhere in the facts: scores, counts, percentages, "Chapter 5" in a topic. */
function numbersIn(value: unknown, into: Set<number>): Set<number> {
  if (typeof value === "number") into.add(value);
  else if (typeof value === "string") for (const t of extractNumbers(value)) (t.kind === "pair" ? [t.a, t.b] : [t.v]).forEach((n) => into.add(n));
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, into));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => numbersIn(v, into));
  return into;
}

const SCRIPT: Record<Language, { test: RegExp; share: number; name: string }> = {
  bn: { test: /[ঀ-৿]/u, share: 0.6, name: "Bengali" },
  hi: { test: /[ऀ-ॿ]/u, share: 0.6, name: "Hindi" },
  en: { test: /[A-Za-zÀ-ɏ]/u, share: 0.9, name: "English" },
};

const FEE_WORDS = [/(?<![\p{L}\p{M}])(fees?|payments?|pay)(?![\p{L}\p{M}])/giu, /টাকা|फ़ीस|फीस|पैसे/gu, /(?<![\p{L}\p{M}])ফি(?:র|এর)?(?![\p{L}\p{M}])/gu];
const ARTEFACTS = /[{}]|\bFACTS\b|\bJSON\b|as an AI/gi;

/**
 * S9: checks a draft body against the facts it was written from (§S9). Any `critical` or `flag`
 * issue flags the draft; it can then be approved only after an edit that passes, or once the tutor dismisses the warning.
 */
export function guard(
  body: string,
  opts: { facts: StudentFacts; language: Language; ownNames: string[]; otherNames: string[]; cycle: { from: string; to: string } },
): GuardResult {
  const issues: GuardIssue[] = [];
  const { facts } = opts;

  // G1: every number must come from the facts.
  const allowed = numbersIn(facts, new Set<number>());
  numbersIn(facts.student.classGrade, allowed);
  allowed.add(Number(opts.cycle.from.slice(8))).add(Number(opts.cycle.to.slice(8)));
  const pairs = facts.assessments.map((a) => `${a.scored}/${a.max}`);
  const percents = new Set([...facts.assessments.map((a) => a.pct), ...(facts.trendBasis ? [facts.trendBasis.previousAvgPct, facts.trendBasis.latestPct] : [])]);
  for (const t of extractNumbers(body)) {
    const ok = t.kind === "pair" ? pairs.includes(`${t.a}/${t.b}`) : t.kind === "percent" ? percents.has(t.v) : allowed.has(t.v);
    if (ok) continue;
    const note = facts.assessments.length === 1 ? ` · Your note says ${pairs[0]}` : "";
    issues.push({ rule: "G1", severity: "flag", message: `${body.slice(t.start, t.end)} — Not in your notes${note}`, start: t.start, end: t.end });
  }

  // G2: the student is named. A Bengali or Hindi update writes a name stored in English letters
  // in its own script (Riya → রিয়া), which can't be compared without a native-script name (P1),
  // so then it's only a warning.
  if (!opts.ownNames.some((n) => n.trim() && nameMatcher(n.trim(), opts.language).test(body))) {
    const transliterated = opts.language !== "en" && opts.ownNames.every((n) => /[A-Za-z]/.test(n));
    issues.push(
      transliterated
        ? { rule: "G2", severity: "warning", message: `Check that ${opts.ownNames[0]}'s name is right in ${SCRIPT[opts.language].name}`, start: 0, end: 0 }
        : { rule: "G2", severity: "flag", message: `Doesn't mention ${opts.ownNames[0]} by name`, start: 0, end: 0 },
    );
  }

  // G3: no other student, unless they share a name with this one.
  const own = new Set(opts.ownNames.map(normalizeName));
  for (const name of new Set(opts.otherNames.map((n) => n.trim()).filter((n) => n && !own.has(normalizeName(n))))) {
    for (const m of body.matchAll(nameMatcher(name, opts.language))) {
      issues.push({ rule: "G3", severity: "critical", message: `Mentions ${name}, another student`, start: m.index, end: m.index + m[0].length });
    }
  }

  // G4: written in the parent's language.
  const letters = body.match(/\p{L}/gu) ?? [];
  const script = SCRIPT[opts.language];
  if (!letters.length || letters.filter((l) => script.test.test(l)).length / letters.length < script.share) {
    issues.push({ rule: "G4", severity: "flag", message: `Not written in ${script.name}`, start: 0, end: 0 });
  }

  // G5: a readable length; doesn't block.
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  if (words < 30 || words > 160) issues.push({ rule: "G5", severity: "warning", message: `${words} words — updates read best at 30 to 160`, start: 0, end: 0 });

  // G6: fee lines only ever come from code (§S10).
  for (const re of FEE_WORDS) {
    for (const m of body.matchAll(re)) issues.push({ rule: "G6", severity: "flag", message: "Mentions fees — the fee line is added separately", start: m.index, end: m.index + m[0].length });
  }

  // G7: leftovers from the prompt.
  for (const m of body.matchAll(ARTEFACTS)) issues.push({ rule: "G7", severity: "flag", message: `“${m[0]}” looks like a leftover from the AI`, start: m.index, end: m.index + m[0].length });

  return { status: issues.some((i) => i.severity !== "warning") ? "flagged" : "pass", issues };
}
