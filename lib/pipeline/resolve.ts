import { levenshtein } from "@/lib/util/levenshtein";
import { normalizeName } from "@/lib/util/text";

export type RosterEntry = { id: string; fullName: string; messageName: string; aliases: string[] };

export type Resolution = {
  resolution: "exact" | "alias" | "fuzzy" | "unmatched";
  studentId?: string;
  /** Closest students first, at most three, for "Maybe Riya Sen". */
  candidates: { studentId: string; distance: number }[];
};

/**
 * S6: who a name in a note means, among active students (§S6). Only one clear answer is taken;
 * two students with the same name, or two close spellings, go to the tutor.
 */
export function resolve(nameAsWritten: string, roster: RosterEntry[]): Resolution {
  const n = normalizeName(nameAsWritten);
  if (!n) return { resolution: "unmatched", candidates: [] };

  const names = roster.map((s) => ({ s, own: [s.fullName, s.messageName].map(normalizeName), aliases: s.aliases.map(normalizeName) }));
  const decide = (hits: RosterEntry[], resolution: "exact" | "alias"): Resolution | null => {
    if (hits.length === 1) return { resolution, studentId: hits[0].id, candidates: [{ studentId: hits[0].id, distance: 0 }] };
    if (hits.length > 1) return { resolution: "unmatched", candidates: hits.slice(0, 3).map((s) => ({ studentId: s.id, distance: 0 })) };
    return null;
  };

  const exact = decide(names.filter((x) => x.own.includes(n)).map((x) => x.s), "exact");
  if (exact) return exact;
  const alias = decide(names.filter((x) => x.aliases.includes(n)).map((x) => x.s), "alias");
  if (alias) return alias;

  const threshold = Array.from(n).length <= 5 ? 1 : 2;
  // Suggestions may be one edit further away than an automatic match, never more.
  const ranked = names
    .map((x) => ({ studentId: x.s.id, distance: Math.min(...[...x.own, ...x.aliases].map((name) => levenshtein(n, name))) }))
    .filter((c) => c.distance <= threshold + 1)
    .sort((a, b) => a.distance - b.distance);
  const close = ranked.filter((c) => c.distance <= threshold);
  const candidates = ranked.slice(0, 3);
  if (close.length === 1) return { resolution: "fuzzy", studentId: close[0].studentId, candidates };
  return { resolution: "unmatched", candidates };
}
