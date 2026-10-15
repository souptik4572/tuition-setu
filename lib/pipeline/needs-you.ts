import { getOpenCycle } from "@/lib/db/queries/cycles";
import { listCycleEntries, type Entry } from "@/lib/db/queries/entries";
import { listCycleNotes, type Note } from "@/lib/db/queries/notes";
import { listStudents, type Student } from "@/lib/db/queries/students";
import { getWorkspace } from "@/lib/db/queries/workspaces";
import type { DbCtx } from "@/lib/db/types";
import { formatDay, todayIn } from "@/lib/util/dates";
import { resolve } from "./resolve";

export type NeedsYouType = "unsupported_entry" | "unmatched_name" | "unattributed" | "impossible_score" | "missing_total" | "fee_prompt" | "failed_note";

export type StudentOption = { id: string; fullName: string; messageName: string; meta: string; aliases: string[]; parentPhone: string };

export type NeedsYouItem = {
  /** The entry's id, or the note's for a note that couldn't be read. */
  id: string;
  type: NeedsYouType;
  title: string;
  hint: string;
  href: string;
  at: string;
  quote: string | null;
  note: { id: string; day: string; batch: string | null };
  /** As written in the note, or the student's message name once known. */
  name: string;
  studentId: string | null;
  candidates: StudentOption[];
  score: { index: number; label: string; scored: number | null; max: number | null } | null;
};

export type MatchedItem = { entryId: string; asWritten: string; studentName: string };

export const studentOption = (s: Student): StudentOption => ({
  id: s.id,
  fullName: s.fullName,
  messageName: s.messageName,
  aliases: s.aliasesJson,
  parentPhone: s.parentPhone,
  meta: [`Class ${s.classGrade}`, s.batch, s.aliasesJson.length ? `also ${s.aliasesJson.map((a) => `‘${a}’`).join(", ")}` : null].filter(Boolean).join(" · "),
});

const flagged = (entry: Entry, code: string) => entry.flagsJson.find((f) => f.code === code);

/** The one question to ask about an entry now; identity before scores, since a score needs a student. */
function typeFor(entry: Entry, feeReminders: boolean): Exclude<NeedsYouType, "failed_note"> | null {
  if (entry.resolution === "ignored") return null;
  if (flagged(entry, "unsupported_entry")) return "unsupported_entry";
  if (!entry.studentId) return entry.nameAsWritten ? "unmatched_name" : "unattributed";
  if (flagged(entry, "impossible_score")) return "impossible_score";
  if (flagged(entry, "missing_total")) return "missing_total";
  // With fee reminders off, a fee line is never added, so there's nothing to ask.
  if (feeReminders && flagged(entry, "fee_prompt")) return "fee_prompt";
  return null;
}

/**
 * The Needs-you inbox for the open week (IMPL M6 catalogue), newest first, plus the auto-matches
 * listed under "Matched for you". Pure: the caller loads the week's entries, notes and students.
 */
export function buildNeedsYou(input: { entries: Entry[]; notes: Note[]; students: Student[]; feeReminders: boolean; timezone: string }) {
  const active = input.students.filter((s) => s.status === "active");
  const byId = new Map(input.students.map((s) => [s.id, s]));
  const notes = new Map(input.notes.map((n) => [n.id, n]));
  const roster = active.map((s) => ({ id: s.id, fullName: s.fullName, messageName: s.messageName, aliases: s.aliasesJson }));
  const items: NeedsYouItem[] = [];

  for (const entry of input.entries) {
    const type = typeFor(entry, input.feeReminders);
    const note = notes.get(entry.noteInputId);
    if (!type || !note) continue;
    const student = entry.studentId ? byId.get(entry.studentId) : undefined;
    const name = student?.messageName ?? entry.nameAsWritten;
    const quote = entry.payloadJson.source_span;
    const index = Number((flagged(entry, type)?.data as { index?: number } | undefined)?.index ?? -1);
    const assessment = entry.payloadJson.assessments[index];
    const score = assessment ? { index, label: assessment.label, scored: assessment.scored, max: assessment.max } : null;
    const candidates =
      type === "unmatched_name"
        ? resolve(entry.nameAsWritten, roster).candidates.map((c) => studentOption(byId.get(c.studentId)!))
        : [];

    const [title, hint] = {
      unsupported_entry: ["I couldn't find this in your note", `“${quote}”`],
      unmatched_name: [`Who is ‘${name}’?`, candidates.length ? `Maybe ${candidates[0].fullName}` : `“${quote}”`],
      unattributed: ["Couldn't tell who this is about", `“${quote}”`],
      impossible_score: [`${name} ${score?.scored}/${score?.max} — is that right?`, "The score is more than the total"],
      missing_total: [`${name} ${score?.scored} — out of how many?`, "The total is missing"],
      fee_prompt: [`Mark fees pending for ${name}?`, "Your note mentions fees"],
    }[type];

    items.push({
      id: entry.id,
      type,
      title,
      hint,
      href: `/needs-you/${entry.id}`,
      at: entry.createdAt,
      quote,
      note: { id: note.id, day: formatDay(note.classDate), batch: note.batch },
      name,
      studentId: entry.studentId,
      candidates,
      score,
    });
  }

  const failed = input.notes.filter((n) => n.status === "failed").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (failed.length) {
    const newest = failed[0];
    items.push({
      id: newest.id,
      type: "failed_note",
      title: failed.length === 1 ? "1 note couldn't be read" : `${failed.length} notes couldn't be read`,
      hint: `Your note is saved · ${formatDay(todayIn(input.timezone, new Date(newest.createdAt)))}`,
      href: `/capture/${newest.id}`,
      at: newest.createdAt,
      quote: null,
      note: { id: newest.id, day: formatDay(newest.classDate), batch: newest.batch },
      name: "",
      studentId: null,
      candidates: [],
      score: null,
    });
  }

  const matched: MatchedItem[] = input.entries
    .filter((e) => e.resolution === "fuzzy" && e.confirmedAt && e.studentId && byId.has(e.studentId))
    .map((e) => ({ entryId: e.id, asWritten: e.nameAsWritten, studentName: byId.get(e.studentId!)!.fullName }));

  return { items: items.sort((a, b) => b.at.localeCompare(a.at)), matched, students: active.map(studentOption) };
}

/** The open week's inbox, for the dashboard, Needs you and the saved-note page. */
export async function loadNeedsYou(ctx: DbCtx) {
  const [workspace, cycle, active, archived] = await Promise.all([getWorkspace(ctx), getOpenCycle(ctx), listStudents(ctx), listStudents(ctx, "archived")]);
  const [entries, notes] = cycle ? await Promise.all([listCycleEntries(ctx, cycle.id), listCycleNotes(ctx, cycle.id)]) : [[], []];
  return { cycle, ...buildNeedsYou({ entries, notes, students: [...active, ...archived], feeReminders: workspace!.includeFeeReminders, timezone: workspace!.timezone }) };
}
