import type { ExtractedEntry, ExtractionResult, Flag } from "@/lib/schemas/extraction";
import { extractNumbers, normalizeDigits } from "@/lib/util/digits";
import { normalizeName } from "@/lib/util/text";

export type ValidatedEntry = { name: string; payload: ExtractedEntry; flags: Flag[] };

const plain = (s: string) => normalizeDigits(s).toLowerCase().replace(/\s+/g, " ").trim();

const UNKNOWN_ENTRY: Omit<ExtractedEntry, "name_as_written" | "source_span"> = {
  topics: [],
  assessments: [],
  homework: { status: "unknown", missed_count: null },
  attendance: "unknown",
  strengths: [],
  concerns: [],
  fee_mentioned: false,
  remarks: null,
};

/** V2: a number the model wrote that isn't in the line it came from is removed, not trusted. */
function keepNotedNumbers(entry: ExtractedEntry): { entry: ExtractedEntry; flags: Flag[] } {
  const noted = new Set(extractNumbers(entry.source_span).flatMap((t) => (t.kind === "pair" ? [t.a, t.b] : [t.v])));
  const flags: Flag[] = [];
  const check = (value: number | null, field: string) => {
    if (value === null || noted.has(value)) return value;
    flags.push({ code: "number_not_in_notes", blocking: false, data: { field, value } });
    return null;
  };
  const assessments = entry.assessments.map((a, i) => ({ ...a, scored: check(a.scored, `assessments.${i}.scored`), max: check(a.max, `assessments.${i}.max`) }));
  const missed = check(entry.homework.missed_count, "homework.missed_count");
  return { entry: { ...entry, assessments, homework: { ...entry.homework, missed_count: missed } }, flags };
}

const union = (a: string[], b: string[]) => {
  const seen = new Set(a.map((s) => s.toLowerCase()));
  return [...a, ...b.filter((s) => !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))];
};

/** V5: two entries for one name in a note become one. */
function merge(a: ExtractedEntry, b: ExtractedEntry): ExtractedEntry {
  const missed = a.homework.missed_count === null && b.homework.missed_count === null ? null : (a.homework.missed_count ?? 0) + (b.homework.missed_count ?? 0);
  return {
    name_as_written: a.name_as_written,
    source_span: `${a.source_span} … ${b.source_span}`,
    topics: union(a.topics, b.topics),
    assessments: [...a.assessments, ...b.assessments],
    homework: { status: a.homework.status === "unknown" ? b.homework.status : a.homework.status, missed_count: missed },
    attendance: a.attendance === "unknown" ? b.attendance : a.attendance,
    strengths: union(a.strengths, b.strengths),
    concerns: union(a.concerns, b.concerns),
    fee_mentioned: a.fee_mentioned || b.fee_mentioned,
    remarks: [a.remarks, b.remarks].filter(Boolean).join(" … ") || null,
  };
}

/**
 * S5: checks the model's reading against the note itself (rules V1–V7, §S5). Anything doubtful
 * becomes a flag; blocking flags keep the entry out of updates until the tutor answers it.
 */
export function validate(rawText: string, result: ExtractionResult): ValidatedEntry[] {
  const note = plain(rawText);
  const byName = new Map<string, ValidatedEntry>();
  const nameless: ValidatedEntry[] = [];

  for (const raw of result.entries) {
    const flags: Flag[] = [];
    if (!note.includes(plain(raw.source_span))) flags.push({ code: "unsupported_entry", blocking: true });
    const { entry, flags: numberFlags } = keepNotedNumbers(raw);
    flags.push(...numberFlags);

    const name = raw.name_as_written.trim();
    const key = normalizeName(name);
    const earlier = key ? byName.get(key) : undefined;
    if (earlier) {
      earlier.payload = merge(earlier.payload, entry);
      for (const f of flags) if (!(f.code === "unsupported_entry" && earlier.flags.some((g) => g.code === f.code))) earlier.flags.push(f);
    } else if (key) {
      byName.set(key, { name, payload: entry, flags });
    } else {
      // An entry the model couldn't put a name to is a line about no one (V6).
      nameless.push({ name: "", payload: entry, flags: [...flags, { code: "unattributed", blocking: true }] });
    }
  }

  const entries = [...byName.values(), ...nameless];
  for (const v of entries) {
    v.payload.assessments.forEach((a, index) => {
      if (a.scored === null) return;
      if (a.max === null) v.flags.push({ code: "missing_total", blocking: true, data: { index } });
      else if (!(a.max > 0 && a.scored <= a.max)) v.flags.push({ code: "impossible_score", blocking: true, data: { index } });
    });
    if (v.payload.fee_mentioned) v.flags.push({ code: "fee_prompt", blocking: false });
  }

  const unattributed = result.unattributed
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): ValidatedEntry => {
      const flags: Flag[] = [{ code: "unattributed", blocking: true }];
      if (!note.includes(plain(line))) flags.push({ code: "unsupported_entry", blocking: true });
      return { name: "", payload: { ...UNKNOWN_ENTRY, name_as_written: "", source_span: line }, flags };
    });

  return [...entries, ...unattributed];
}
