// SPEC §5.3. v2 adds the "this week" rule: with v1, Gemma called the week "this cycle" / "চক্রে"
// after the facts' `cycle` key (IMPL M7). Changing the wording means bumping the version.
import type { Language, Tone } from "@/lib/schemas/common";
import type { StudentFacts } from "@/lib/schemas/facts";

export const DRAFT_PROMPT_VERSION = "v2";

const LANGUAGE: Record<Language, { name: string; script: string }> = {
  en: { name: "English", script: "the Latin alphabet" },
  bn: { name: "Bengali", script: "Bengali script" },
  hi: { name: "Hindi", script: "Devanagari script" },
};

export function draftPrompt(input: { facts: StudentFacts; language: Language; tone: Tone }) {
  const { name, script } = LANGUAGE[input.language];
  const system = `You write the middle part of a short WhatsApp message from a private tutor to a student's parent.

Language: ${name}, written in ${script}. Write only in this language. Write numbers with digits 0-9.
Tone: ${input.tone}. Length: 50 to 110 words. Plain text, short paragraphs, at most one emoji.

Rules:
- Use ONLY the FACTS. Every number you write must appear exactly in FACTS.
- Cover: what was studied; one specific strength; if there is a concern, describe it kindly with one practical thing the parent can do at home; test results if any; the trend if it is not "not_enough_data".
- Call the student "${input.facts.student.name}" exactly as written here.
- FACTS cover this week. Say "this week" in ${name}; never "cycle".
- Do NOT write a greeting or a sign-off — they are added separately.
- Do NOT mention fees or payments. Do NOT mention or compare with any other student.
- Never use harsh or labelling words about the child.`;

  const user = `FACTS:
${JSON.stringify(input.facts, null, 2)}

Tutor's standing notes for this family: ${input.facts.standingNotes ?? "none"}`;

  return { system, user };
}
