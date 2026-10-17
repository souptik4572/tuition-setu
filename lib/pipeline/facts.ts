import type { ExtractedEntry } from "@/lib/schemas/extraction";
import type { StudentFacts } from "@/lib/schemas/facts";

/** How far the latest score must move from the earlier average to count as a trend (§S7). */
export const TREND_DELTA = 8;

const pct = (scored: number, max: number) => Math.round((scored / max) * 100);

const union = (lists: string[][]) => {
  const seen = new Set<string>();
  return lists.flat().filter((s) => {
    const key = s.trim().toLowerCase();
    return key && !seen.has(key) && seen.add(key);
  });
};

type Score = { label: string; scored: number; max: number; takenOn: string; cycleId: string };

/**
 * S7: everything the draft model may say about a student this week, worked out by code from
 * confirmed entries and saved scores. Stored with the draft, so every message traces back to it.
 */
export function computeFacts(input: {
  student: { messageName: string; classGrade: string; subjects: string[]; standingNotes: string | null };
  cycle: { id: string; label: string; from: string; to: string };
  /** Confirmed entries about the student in this cycle. */
  entries: ExtractedEntry[];
  /** Every saved score of the student, oldest first. */
  scores: Score[];
}): StudentFacts {
  const thisWeek = input.scores.filter((s) => s.cycleId === input.cycle.id);
  const earlier = input.scores.filter((s) => s.cycleId !== input.cycle.id && s.takenOn < input.cycle.from).slice(-3);
  const latest = thisWeek.at(-1);

  let trend: StudentFacts["trend"] = "not_enough_data";
  let trendBasis: StudentFacts["trendBasis"];
  if (latest && earlier.length >= 2) {
    // Rounded first, so the average the model may quote ("58%") is exactly the one the guard allows.
    const previousAvgPct = Math.round(earlier.reduce((sum, s) => sum + pct(s.scored, s.max), 0) / earlier.length);
    const latestPct = pct(latest.scored, latest.max);
    const delta = latestPct - previousAvgPct;
    trend = delta >= TREND_DELTA ? "improving" : delta <= -TREND_DELTA ? "declining" : "steady";
    trendBasis = { previousAvgPct, latestPct };
  }

  const withHomework = input.entries.filter((e) => e.homework.status !== "unknown");
  const withAttendance = input.entries.filter((e) => e.attendance !== "unknown");

  return {
    student: { name: input.student.messageName, classGrade: input.student.classGrade, subjects: input.student.subjects },
    cycle: { label: input.cycle.label, from: input.cycle.from, to: input.cycle.to },
    assessments: thisWeek.map((s) => ({ label: s.label, scored: s.scored, max: s.max, pct: pct(s.scored, s.max) })),
    trend,
    ...(trendBasis && { trendBasis }),
    homework: withHomework.length
      ? { missed: withHomework.reduce((n, e) => n + (e.homework.missed_count ?? (e.homework.status === "missed" ? 1 : 0)), 0), sessionsWithHomework: withHomework.length }
      : null,
    attendance: withAttendance.length
      ? {
          present: withAttendance.filter((e) => e.attendance === "present").length,
          absent: withAttendance.filter((e) => e.attendance === "absent").length,
          late: withAttendance.filter((e) => e.attendance === "late").length,
        }
      : null,
    topics: union(input.entries.map((e) => e.topics)),
    strengths: union(input.entries.map((e) => e.strengths)),
    concerns: union(input.entries.map((e) => e.concerns)),
    remarks: input.entries.flatMap((e) => (e.remarks ? [e.remarks] : [])),
    ...(input.student.standingNotes && { standingNotes: input.student.standingNotes }),
  };
}
