// SPEC §5.1, version v1. Changing the wording means bumping the version and re-running the evals.

export const EXTRACT_PROMPT_VERSION = "v1";

export type RosterName = { fullName: string; aliases: string[] };

export function extractPrompt(input: { rawText: string; classDate: string; batch: string | null; roster: RosterName[] }) {
  const roster = input.roster.map((s) => (s.aliases.length ? `- ${s.fullName} (nicknames: ${s.aliases.join(", ")})` : `- ${s.fullName}`)).join("\n");

  const system = `You extract structured facts from a private tutor's rough class notes.
Output JSON that matches the schema. No commentary.

Rules:
- Create one entry per student mentioned. Copy the student's name exactly as written into name_as_written.
- source_span: copy, character for character, the part of the notes this entry came from.
- Record only numbers that literally appear in the notes. Never calculate, round or guess.
- A score without a total (e.g. "Riya 14") has max = null.
- Something like "12/10" next to a date word, or without test/marks/quiz/score context, is a date, not a score.
- Homework and attendance are "unknown" unless the notes say so.
- strengths and concerns: short English phrases paraphrasing the notes. Do not invent anything.
- Put lines you cannot tie to any student into unattributed.

Students (for spelling reference only — do not add students who are not mentioned):
${roster}`;

  const user = `Class date: ${input.classDate}   Batch: ${input.batch ?? "not given"}
Notes:
"""
${input.rawText}
"""`;

  return { system, user };
}
