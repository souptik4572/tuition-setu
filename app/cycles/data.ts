import "server-only";
import { getCycle } from "@/lib/db/queries/cycles";
import { listLiveDrafts, type Draft } from "@/lib/db/queries/drafts";
import { listCycleEntries } from "@/lib/db/queries/entries";
import { listCycleNotes } from "@/lib/db/queries/notes";
import { listStudents } from "@/lib/db/queries/students";
import type { DbCtx } from "@/lib/db/types";
import { loadDraftContext } from "@/lib/pipeline/draft";
import { weekStatus, type WeekStatus } from "@/lib/pipeline/week-status";
import type { Language } from "@/lib/schemas/common";
import type { StudentFacts } from "@/lib/schemas/facts";
import type { GuardResult } from "@/lib/schemas/guard";
import { formatDay, formatDayTime, formatRange } from "@/lib/util/dates";

export type ReviewRow = {
  id: string;
  fullName: string;
  messageName: string;
  classGrade: string;
  language: Language;
  chip: WeekStatus;
  /** Has confirmed notes and no live draft, or an out-of-date one: "Write updates" writes it. */
  canWrite: boolean;
};

export type ReviewDetail = {
  student: { id: string; fullName: string; messageName: string; language: Language; parentName: string | null; phone: string };
  chip: WeekStatus;
  hasNotes: boolean;
  waiting: number;
  draft: {
    id: string;
    status: Draft["status"];
    message: string;
    body: string;
    bodyOffset: number;
    guard: GuardResult | null;
    edited: boolean;
    override: boolean;
    sentAt: string | null;
  } | null;
  facts: StudentFacts | null;
  sources: { quote: string; day: string }[];
};

/** The weekly review (D3, M6–M8): every active student's state this week, and the selected student's update. */
export async function loadReview(ctx: DbCtx, cycleId: string, selectedId: string | undefined, timezone: string) {
  const cycle = await getCycle(ctx, cycleId);
  if (!cycle) return null;
  const [students, drafts, entries, notes] = await Promise.all([listStudents(ctx), listLiveDrafts(ctx, cycleId), listCycleEntries(ctx, cycleId), listCycleNotes(ctx, cycleId)]);

  const rows: ReviewRow[] = students.map((s) => {
    const draft = drafts.get(s.id);
    const mine = entries.filter((e) => e.studentId === s.id);
    const confirmed = mine.some((e) => e.confirmedAt && e.resolution !== "ignored");
    return {
      id: s.id,
      fullName: s.fullName,
      messageName: s.messageName,
      classGrade: s.classGrade,
      language: s.parentLanguage,
      chip: weekStatus(draft?.status, mine),
      canWrite: confirmed && (!draft || draft.status === "stale"),
    };
  });

  const sent = rows.filter((r) => r.chip === "sent").length;
  const skipped = rows.filter((r) => r.chip === "skipped").length;
  const notDone = rows.filter((r) => r.chip !== "sent" && r.chip !== "skipped");

  // With no student chosen, the laptop opens the one that most needs attention.
  const order: WeekStatus[] = ["flagged", "stale", "needs_you", "checked", "notes", "approved"];
  const fallback = order.map((chip) => rows.find((r) => r.chip === chip)).find(Boolean) ?? rows[0];
  let detail: ReviewDetail | null = null;
  const student = students.find((s) => s.id === (selectedId ?? fallback?.id));
  if (student) {
    const draft = drafts.get(student.id) ?? null;
    const noteDays = new Map(notes.map((n) => [n.id, formatDay(n.classDate)]));
    const mine = entries.filter((e) => e.studentId === student.id && e.resolution !== "ignored");
    const confirmed = mine.filter((e) => e.confirmedAt);
    const body = draft ? (draft.bodyFinal ?? draft.bodyModel) : "";
    // An out-of-date draft is shown against what the notes say now.
    const facts = draft?.factsJson && draft.status !== "stale" ? draft.factsJson : confirmed.length ? ((await loadDraftContext(ctx, cycleId, student.id))?.facts ?? null) : null;
    detail = {
      student: { id: student.id, fullName: student.fullName, messageName: student.messageName, language: student.parentLanguage, parentName: student.parentName, phone: student.parentPhone },
      chip: rows.find((r) => r.id === student.id)!.chip,
      hasNotes: confirmed.length > 0,
      waiting: mine.length - confirmed.length,
      draft: draft && {
        id: draft.id,
        status: draft.status,
        message: draft.messageFinal,
        body,
        bodyOffset: body ? Math.max(0, draft.messageFinal.indexOf(body)) : 0,
        guard: draft.guardJson,
        edited: !!draft.bodyFinal && draft.bodyFinal !== draft.bodyModel,
        override: draft.override,
        sentAt: draft.sentAt ? formatDayTime(draft.sentAt, timezone) : null,
      },
      facts,
      sources: confirmed.map((e) => ({ quote: e.payloadJson.source_span, day: noteDays.get(e.noteInputId) ?? "" })),
    };
  }

  return { cycle: { id: cycle.id, status: cycle.status, range: formatRange(cycle.startsOn, cycle.endsOn) }, rows, sent, skipped, notDone: notDone.map((r) => r.messageName), detail, chosen: !!selectedId };
}
