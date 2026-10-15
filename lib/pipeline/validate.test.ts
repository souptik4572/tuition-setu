import { describe, expect, it } from "vitest";
import type { ExtractedEntry, ExtractionResult } from "@/lib/schemas/extraction";
import { validate } from "./validate";

const entry = (over: Partial<ExtractedEntry>): ExtractedEntry => ({
  name_as_written: "Riya",
  source_span: "Riya ch5 test 14/20",
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

const run = (rawText: string, entries: ExtractedEntry[], unattributed: string[] = []) => validate(rawText, { entries, unattributed } satisfies ExtractionResult);
const codes = (v: { flags: { code: string }[] }) => v.flags.map((f) => f.code);

describe("validate", () => {
  it("passes an entry that matches the note", () => {
    const [v] = run("Riya ch5 test 14/20; Arjun absent", [entry({ assessments: [{ label: "ch5 test", scored: 14, max: 20, raw: "14/20" }] })]);
    expect(v).toMatchObject({ name: "Riya", flags: [] });
  });

  it("V1: flags a source line that isn't in the note, ignoring case, spacing and digit script", () => {
    expect(codes(run("RIYA  ch5 test ১৪/২০", [entry({})])[0])).toEqual([]);
    expect(codes(run("Arjun absent", [entry({})])[0])).toEqual(["unsupported_entry"]);
  });

  it("V2: removes numbers that aren't in the line, which can then leave a score without a total (V4)", () => {
    const [v] = run("Riya ch5 test 14/20", [entry({ source_span: "Riya ch5 test 14", assessments: [{ label: "test", scored: 14, max: 20, raw: "14/20" }], homework: { status: "missed", missed_count: 2 } })]);
    expect(v.payload.assessments[0]).toMatchObject({ scored: 14, max: null });
    expect(v.payload.homework.missed_count).toBeNull();
    expect(v.flags).toEqual([
      { code: "number_not_in_notes", blocking: false, data: { field: "assessments.0.max", value: 20 } },
      { code: "number_not_in_notes", blocking: false, data: { field: "homework.missed_count", value: 2 } },
      { code: "missing_total", blocking: true, data: { index: 0 } },
    ]);
  });

  it("V3: flags a score above its total, or a zero total", () => {
    const [v] = run("Riya 24/20 and 3/0", [entry({ source_span: "Riya 24/20 and 3/0", assessments: [{ label: "a", scored: 24, max: 20, raw: "24/20" }, { label: "b", scored: 3, max: 0, raw: "3/0" }] })]);
    expect(v.flags).toEqual([
      { code: "impossible_score", blocking: true, data: { index: 0 } },
      { code: "impossible_score", blocking: true, data: { index: 1 } },
    ]);
  });

  it("V4: flags a score without a total", () => {
    expect(run("Riya 14", [entry({ source_span: "Riya 14", assessments: [{ label: "test", scored: 14, max: null, raw: "14" }] })])[0].flags).toEqual([{ code: "missing_total", blocking: true, data: { index: 0 } }]);
  });

  it("V5: merges two entries for one name in a note", () => {
    const v = run("Riya ch5 test 14/20. Later: riya missed HW, careless", [
      entry({ topics: ["ch5"], assessments: [{ label: "ch5 test", scored: 14, max: 20, raw: "14/20" }], concerns: ["Careless"] }),
      entry({ name_as_written: "riya", source_span: "riya missed HW, careless", topics: ["CH5", "algebra"], homework: { status: "missed", missed_count: null }, concerns: ["careless"], attendance: "present" }),
    ]);
    expect(v).toHaveLength(1);
    expect(v[0].payload).toMatchObject({
      name_as_written: "Riya",
      source_span: "Riya ch5 test 14/20 … riya missed HW, careless",
      topics: ["ch5", "algebra"],
      concerns: ["Careless"],
      homework: { status: "missed", missed_count: null },
      attendance: "present",
    });
    expect(v[0].flags).toEqual([]);
  });

  it("V6: turns each line about no one into an entry of its own", () => {
    const v = run("whole batch slow in fractions", [], ["whole batch slow in fractions", " "]);
    expect(v).toEqual([expect.objectContaining({ name: "", flags: [{ code: "unattributed", blocking: true }] })]);
    expect(v[0].payload.source_span).toBe("whole batch slow in fractions");
  });

  it("V7: asks about fees without holding the entry back", () => {
    expect(run("Riya ch5 test 14/20 fees due", [entry({ fee_mentioned: true })])[0].flags).toEqual([{ code: "fee_prompt", blocking: false }]);
  });
});
