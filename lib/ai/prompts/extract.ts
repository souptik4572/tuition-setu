// SPEC §5.1. v1 is the spec's wording; v2 adds that names and spans are never corrected to the
// roster's spelling, and is the default since the M7 evals (evals/results/summary.md). Changing
// the wording means a new version and re-running the evals.

export type ExtractPromptVersion = "v1" | "v2";

export const EXTRACT_PROMPT_VERSION: ExtractPromptVersion = "v2";

export type RosterName = { fullName: string; aliases: string[] };

const NAME_RULES: Record<ExtractPromptVersion, string> = {
  v1: `- Create one entry per student mentioned. Copy the student's name exactly as written into name_as_written.
- source_span: copy, character for character, the part of the notes this entry came from.`,
  v2: `- Create one entry per student mentioned. Copy the student's name exactly as the tutor spelled it into name_as_written, even when it differs from the Students list: a name written "Ananyaa" stays "Ananyaa", not "Ananya". Never replace it with a name from the list.
- source_span: copy, character for character, the part of the notes this entry came from. Do not correct spelling or change any word.`,
};

export function extractPrompt(input: { rawText: string; classDate: string; batch: string | null; roster: RosterName[] }, version: ExtractPromptVersion = EXTRACT_PROMPT_VERSION) {
  const roster = input.roster.map((s) => (s.aliases.length ? `- ${s.fullName} (nicknames: ${s.aliases.join(", ")})` : `- ${s.fullName}`)).join("\n");

  const system = `You extract structured facts from a private tutor's rough class notes.
Output JSON that matches the schema. No commentary.

Rules:
${NAME_RULES[version]}
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
