import "server-only";
import { listStudentAssessments } from "@/lib/db/queries/assessments";
import { getCycle } from "@/lib/db/queries/cycles";
import { listCycleEntries } from "@/lib/db/queries/entries";
import { getMember } from "@/lib/db/queries/members";
import { getStudent, listStudents } from "@/lib/db/queries/students";
import { getWorkspace } from "@/lib/db/queries/workspaces";
import type { DbCtx } from "@/lib/db/types";
import type { StudentFacts } from "@/lib/schemas/facts";
import { formatRange } from "@/lib/util/dates";
import { assemble } from "./assemble";
import { computeFacts } from "./facts";
import { guard } from "./guard";

export type DraftContext = NonNullable<Awaited<ReturnType<typeof loadDraftContext>>>;

/** Everything a student's update for the week is written and checked from (S7, S9, S10). */
export async function loadDraftContext(ctx: DbCtx, cycleId: string, studentId: string) {
  const [cycle, student, workspace, member, roster, entries, scores] = await Promise.all([
    getCycle(ctx, cycleId),
    getStudent(ctx, studentId),
    getWorkspace(ctx),
    getMember(ctx, ctx.memberId),
    listStudents(ctx),
    listCycleEntries(ctx, cycleId),
    listStudentAssessments(ctx, studentId),
  ]);
  if (!cycle || !student || !workspace) return null;
  const confirmed = entries.filter((e) => e.studentId === student.id && e.confirmedAt && e.resolution !== "ignored");
  const range = formatRange(cycle.startsOn, cycle.endsOn, student.parentLanguage);
  const facts = computeFacts({
    student: { messageName: student.messageName, classGrade: student.classGrade, subjects: student.subjectsJson, standingNotes: student.standingNotes },
    cycle: { id: cycle.id, label: range, from: cycle.startsOn, to: cycle.endsOn },
    entries: confirmed.map((e) => e.payloadJson),
    scores,
  });
  return {
    cycle,
    student,
    workspace,
    range,
    facts,
    hasNotes: confirmed.length > 0,
    signature: member?.signature ?? "",
    otherNames: roster.filter((s) => s.id !== student.id).flatMap((s) => [s.fullName, s.messageName, ...s.aliasesJson]),
  };
}

/** Guards a body (S9) and assembles the message around it (S10). */
export function checkAndAssemble(dc: DraftContext, body: string, facts: StudentFacts = dc.facts) {
  const text = body.trim();
  const result = guard(text, { facts, language: dc.student.parentLanguage, ownNames: [dc.student.messageName], otherNames: dc.otherNames, cycle: { from: dc.cycle.startsOn, to: dc.cycle.endsOn } });
  const { message, bodyOffset } = assemble({
    language: dc.student.parentLanguage,
    studentName: dc.student.messageName,
    parentName: dc.student.parentName,
    range: dc.range,
    body: text,
    feeLine: dc.student.feesPending && dc.workspace.includeFeeReminders,
    signature: dc.signature,
  });
  return { body: text, guard: result, message, bodyOffset, status: result.status === "pass" ? ("ready" as const) : ("flagged" as const) };
}
