import { describe, expect, it } from "vitest";
import type { ExtractedEntry } from "@/lib/schemas/extraction";
import { computeFacts } from "./facts";

const entry = (over: Partial<ExtractedEntry> = {}): ExtractedEntry => ({
  name_as_written: "Riya",
  source_span: "Riya",
  topics: [],
  assessments: [],
  homework: { status: "unknown", missed_count: null },
  attendance: "unknown",
  strengths: [],
  concerns: [],
  fee_mentioned: false,
  remarks: null,
  ...over,
});
const student = { messageName: "Riya", classGrade: "7", subjects: ["Maths"], standingNotes: null };
const cycle = { id: "now", label: "12–18 Oct", from: "2026-10-12", to: "2026-10-18" };
const earlier = (scored: number, max: number, takenOn: string) => ({ label: "quiz", scored, max, takenOn, cycleId: "before" });
const now = (scored: number, max: number) => ({ label: "ch5 test", scored, max, takenOn: "2026-10-15", cycleId: "now" });

describe("computeFacts", () => {
  it("compares the latest score with the rounded average of up to three earlier ones", () => {
    const facts = computeFacts({ student, cycle, entries: [], scores: [earlier(1, 10, "2026-09-01"), earlier(6, 10, "2026-09-25"), earlier(11, 20, "2026-10-01"), earlier(7, 10, "2026-10-08"), now(14, 20)] });
    expect(facts).toMatchObject({ assessments: [{ label: "ch5 test", scored: 14, max: 20, pct: 70 }], trend: "improving", trendBasis: { previousAvgPct: 62, latestPct: 70 } });
  });

  it("calls ±8 points a trend, anything less steady, and needs two earlier scores", () => {
    expect(computeFacts({ student, cycle, entries: [], scores: [earlier(6, 10, "2026-10-01"), earlier(6, 10, "2026-10-08"), now(17, 25)] })).toMatchObject({ trend: "improving" });
    expect(computeFacts({ student, cycle, entries: [], scores: [earlier(6, 10, "2026-10-01"), earlier(6, 10, "2026-10-08"), now(13, 25)] })).toMatchObject({ trend: "declining" });
    expect(computeFacts({ student, cycle, entries: [], scores: [earlier(6, 10, "2026-10-01"), earlier(6, 10, "2026-10-08"), now(16, 25)] })).toMatchObject({ trend: "steady" });
    const one = computeFacts({ student, cycle, entries: [], scores: [earlier(6, 10, "2026-10-08"), now(14, 20)] });
    expect(one.trend).toBe("not_enough_data");
    expect(one).not.toHaveProperty("trendBasis");
  });

  it("counts missed homework from counts, else from entries, and leaves unknowns out", () => {
    const facts = computeFacts({
      student,
      cycle,
      entries: [entry({ homework: { status: "missed", missed_count: 2 } }), entry({ homework: { status: "missed", missed_count: null } }), entry({ homework: { status: "done", missed_count: null } }), entry()],
      scores: [],
    });
    expect(facts.homework).toEqual({ missed: 3, sessionsWithHomework: 3 });
    expect(computeFacts({ student, cycle, entries: [entry()], scores: [] }).homework).toBeNull();
  });

  it("counts attendance and merges topics, strengths and concerns without repeats", () => {
    const facts = computeFacts({
      student: { ...student, standingNotes: "Short messages, please" },
      cycle,
      entries: [entry({ attendance: "late", topics: ["Fractions"], concerns: ["rushes"] }), entry({ attendance: "present", topics: ["fractions", "ratio"], concerns: ["Rushes"], remarks: "good week" })],
      scores: [],
    });
    expect(facts).toMatchObject({ attendance: { present: 1, absent: 0, late: 1 }, topics: ["Fractions", "ratio"], concerns: ["rushes"], remarks: ["good week"], standingNotes: "Short messages, please" });
  });
});
