import { describe, expect, it } from "vitest";
import type { StudentFacts } from "@/lib/schemas/facts";
import { guard } from "./guard";

const facts: StudentFacts = {
  student: { name: "Riya", classGrade: "7", subjects: ["Maths"] },
  cycle: { label: "12–18 Oct", from: "2026-10-12", to: "2026-10-18" },
  assessments: [{ label: "ch5 test", scored: 14, max: 20, pct: 70 }],
  trend: "improving",
  trendBasis: { previousAvgPct: 58, latestPct: 70 },
  homework: { missed: 2, sessionsWithHomework: 1 },
  attendance: null,
  topics: ["chapter 5", "linear equations"],
  strengths: ["quick with word problems"],
  concerns: ["sign errors in algebra"],
  remarks: [],
};

// SPEC Appendix A.3.
const A3 =
  "This week Riya worked on Chapter 5, linear equations. She scored 14/20 (70%) in Thursday's test, up from her recent average of 58%, so the extra practice is paying off. She is quick with word problems. Small sign errors in algebra still cost her marks; asking her to re-check each step aloud at home would help. She missed homework twice, so a fixed homework time this week would be great.";

const opts: Parameters<typeof guard>[1] = { facts, language: "en", ownNames: ["Riya"], otherNames: ["Arjun Das", "Arjun", "Tanmoy", "তন্ময়", "Riyu"], cycle: facts.cycle };
const rules = (body: string, o = opts) => guard(body, o).issues.map((i) => `${i.rule}:${i.severity}`);

describe("guard", () => {
  it("passes the spec's example", () => {
    expect(guard(A3, opts)).toEqual({ status: "pass", issues: [] });
  });

  it("G1: flags a number that isn't in the facts, at its place in the text", () => {
    const body = A3.replace("14/20", "18/20");
    const result = guard(body, opts);
    expect(result.status).toBe("flagged");
    expect(result.issues).toEqual([{ rule: "G1", severity: "flag", message: "18/20 — Not in your notes · Your note says 14/20", start: body.indexOf("18/20"), end: body.indexOf("18/20") + 5 }]);
    expect(rules(A3.replace("(70%)", "(75%)"))).toEqual(["G1:flag"]);
    expect(rules(A3.replace("Chapter 5", "Chapter 6"))).toEqual(["G1:flag"]);
  });

  it("G1: reads Bengali digits as numbers", () => {
    const bn = { ...opts, language: "bn" as const, ownNames: ["রিয়া"], facts: { ...facts, assessments: [{ label: "quiz", scored: 17, max: 25, pct: 68 }] } };
    const ok = "এই সপ্তাহে রিয়া কুইজে ১৭/২৫ পেয়েছে, যা বেশ ভালো। ভগ্নাংশে ও অনেকটা উন্নতি করেছে এবং অঙ্কগুলো যত্ন করে করছে। বাড়িতে রোজ দশ মিনিট অনুশীলন করলে আরও ভালো হবে। ও খুব মন দিয়ে ক্লাসে প্রশ্ন করে এবং নতুন জিনিস শিখতে আগ্রহী।";
    expect(rules(ok, bn)).toEqual([]);
    expect(rules(ok.replace("১৭/২৫", "১৮/২৫"), bn)).toEqual(["G1:flag"]);
  });

  it("G2: wants the student named; a name in English letters in a Bengali update is only a warning", () => {
    expect(rules(A3.replaceAll("Riya", "she"))).toEqual(["G2:flag"]);
    const bnBody = "এই সপ্তাহে রিয়া ভগ্নাংশে অনেকটা উন্নতি করেছে এবং অঙ্কগুলো যত্ন করে করছে। বাড়িতে রোজ দশ মিনিট অনুশীলন করলে আরও ভালো হবে। ও খুব মন দিয়ে ক্লাসে প্রশ্ন করে এবং নতুন জিনিস শিখতে আগ্রহী।";
    expect(guard(bnBody, { ...opts, language: "bn", ownNames: ["Riya"] })).toMatchObject({ status: "pass", issues: [{ rule: "G2", severity: "warning", message: "Check that Riya's name is right in Bengali" }] });
    expect(rules(bnBody.replace("রিয়া", "ও"), { ...opts, language: "bn", ownNames: ["রিয়া"] })).toEqual(["G2:flag"]);
  });

  it("G3: flags another student's name, with Bengali case endings, but not a shared name", () => {
    const result = guard(`${A3} Arjun did better.`, opts);
    expect(result.issues).toMatchObject([{ rule: "G3", severity: "critical", message: "Mentions Arjun, another student" }]);
    const bn = { ...opts, language: "bn" as const, ownNames: ["রিয়া"] };
    const bnBody = "রিয়া এই সপ্তাহে তন্ময়ের মতোই ভালো করেছে। ভগ্নাংশে ও অনেকটা উন্নতি করেছে এবং অঙ্কগুলো যত্ন করে করছে। বাড়িতে রোজ দশ মিনিট অনুশীলন করলে আরও ভালো হবে। ও খুব মন দিয়ে ক্লাসে প্রশ্ন করে এবং শিখতে আগ্রহী।";
    expect(rules(bnBody, bn)).toEqual(["G3:critical"]);
    expect(rules(A3, { ...opts, otherNames: ["Riya"] })).toEqual([]);
  });

  it("G4: wants the parent's language", () => {
    expect(rules(A3, { ...opts, language: "bn", ownNames: ["Riya"] })).toEqual(["G4:flag"]);
  });

  it("G5: warns about length without flagging", () => {
    expect(guard("Riya did well this week.", opts)).toMatchObject({ status: "pass", issues: [{ rule: "G5", severity: "warning" }] });
  });

  it("G6: flags fee words in every language, but not lookalikes", () => {
    expect(rules(`${A3} Please pay the fees.`)).toEqual(["G6:flag", "G6:flag"]);
    expect(rules(`${A3} Paying attention helps.`)).toEqual([]);
    const bn = { ...opts, language: "bn" as const, ownNames: ["রিয়া"] };
    const bnBody = "রিয়া এই সপ্তাহে ভগ্নাংশে অনেকটা উন্নতি করেছে এবং অঙ্কগুলো যত্ন করে করছে। বাড়িতে রোজ দশ মিনিট অনুশীলন করলে আরও ভালো হবে। ও খুব মন দিয়ে ক্লাসে প্রশ্ন করে এবং নতুন জিনিস শিখতে আগ্রহী, ক্লাস থেকে ফিরে পড়তে বসে।";
    expect(rules(bnBody, bn)).toEqual([]);
    expect(rules(`${bnBody} এই মাসের ফি বাকি।`, bn)).toEqual(["G6:flag"]);
    const hi = { ...opts, language: "hi" as const, ownNames: ["रिया"] };
    const hiBody = "इस हफ़्ते रिया ने भिन्नों में अच्छी प्रगति की और सवाल ध्यान से हल किए। घर पर रोज़ दस मिनट अभ्यास करने से और मदद मिलेगी। वह कक्षा में मन लगाकर सवाल पूछती है और नई चीज़ें सीखने को उत्सुक रहती है।";
    expect(rules(hiBody, hi)).toEqual([]);
    expect(rules(`${hiBody} फीस बाकी है।`, hi)).toEqual(["G6:flag"]);
  });

  it("G7: flags leftovers from the prompt", () => {
    expect(rules(`${A3} {FACTS}`)).toEqual(["G7:flag", "G7:flag", "G7:flag"]);
  });
});
