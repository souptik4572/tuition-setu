import { describe, expect, it } from "vitest";
import { StudentInput } from "./student";

const valid = { fullName: "Riya Sen", messageName: "Riya", classGrade: "7", parentPhone: "98000 00001", parentLanguage: "bn" };

const messages = (input: Record<string, unknown>) => {
  const result = StudentInput.safeParse(input);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
};

describe("StudentInput", () => {
  it("gives R1-Errors' message for each missing field", () => {
    expect(messages({ fullName: " ", messageName: "", classGrade: "", parentPhone: "98000 0001" })).toEqual({
      fullName: "Enter the student's full name",
      messageName: "Fills in from the first name once you add it",
      classGrade: "Enter a class, like 7",
      parentPhone: "Enter a 10-digit mobile number",
      parentLanguage: "Choose the language the parent reads",
    });
  });

  it("refuses a language it doesn't write in", () => {
    expect(messages({ ...valid, parentLanguage: "ta" })).toEqual({ parentLanguage: "Choose the language the parent reads" });
  });

  it("stores the number as digits and blank optional fields as null", () => {
    expect(StudentInput.parse({ ...valid, parentPhone: "+91 98000-00001", batch: " ", parentName: "", standingNotes: undefined })).toEqual({
      fullName: "Riya Sen",
      messageName: "Riya",
      classGrade: "7",
      batch: null,
      subjects: [],
      parentName: null,
      parentPhone: "919800000001",
      parentLanguage: "bn",
      nicknames: [],
      standingNotes: null,
      feesPending: false,
    });
  });

  it("keeps an international number with its country code", () => {
    expect(StudentInput.parse({ ...valid, parentPhone: "+44 7700 900123" }).parentPhone).toBe("447700900123");
  });

  it("trims nicknames and drops blanks and repeats, keeping them as typed", () => {
    expect(StudentInput.parse({ ...valid, nicknames: [" Riyu ", "Riyu", "", "রিয়া"] }).nicknames).toEqual(["Riyu", "রিয়া"]);
  });
});
