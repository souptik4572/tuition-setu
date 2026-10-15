import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import type { StudentData } from "@/lib/schemas/student";
import { normalizeName } from "@/lib/util/text";
import { withDb } from "../client";
import { drafts, extractedEntries, students } from "../schema";
import type { DbCtx } from "../types";
import { own } from "./scope";

export type Student = typeof students.$inferSelect;

// Nicknames are stored as typed and shown as typed; name matching (S6) normalises both sides.
const columns = (data: StudentData) => ({
  fullName: data.fullName,
  messageName: data.messageName,
  classGrade: data.classGrade,
  batch: data.batch,
  subjectsJson: data.subjects,
  parentName: data.parentName,
  parentPhone: data.parentPhone,
  parentLanguage: data.parentLanguage,
  aliasesJson: data.nicknames,
  standingNotes: data.standingNotes,
  feesPending: data.feesPending,
});

export async function listStudents(ctx: DbCtx, status: Student["status"] = "active"): Promise<Student[]> {
  return withDb(ctx, (db) =>
    db
      .select()
      .from(students)
      .where(and(eq(students.workspaceId, ctx.workspaceId), eq(students.status, status)))
      .orderBy(asc(students.fullName)),
  );
}

export async function getStudent(ctx: DbCtx, id: string): Promise<Student | null> {
  return withDb(ctx, async (db) => (await db.select().from(students).where(own(students, ctx, id)))[0] ?? null);
}

export async function countActiveStudents(ctx: DbCtx): Promise<number> {
  return withDb(ctx, async (db) => (await db.select({ n: count() }).from(students).where(and(eq(students.workspaceId, ctx.workspaceId), eq(students.status, "active"))))[0].n);
}

export async function createStudent(ctx: DbCtx, data: StudentData): Promise<Student> {
  return withDb(ctx, async (db) => (await db.insert(students).values({ ...columns(data), workspaceId: ctx.workspaceId }).returning())[0]);
}

export async function updateStudent(ctx: DbCtx, id: string, data: StudentData): Promise<Student | null> {
  return withDb(ctx, async (db) => (await db.update(students).set(columns(data)).where(own(students, ctx, id)).returning())[0] ?? null);
}

export async function archiveStudent(ctx: DbCtx, id: string): Promise<Student | null> {
  return withDb(ctx, async (db) => (await db.update(students).set({ status: "archived", archivedAt: new Date().toISOString() }).where(own(students, ctx, id)).returning())[0] ?? null);
}

export async function restoreStudent(ctx: DbCtx, id: string): Promise<Student | null> {
  return withDb(ctx, async (db) => (await db.update(students).set({ status: "active", archivedAt: null }).where(own(students, ctx, id)).returning())[0] ?? null);
}

/** Hard delete: the student's entries, scores and drafts go with it (cascade, §10). */
export async function deleteStudent(ctx: DbCtx, id: string): Promise<boolean> {
  return withDb(ctx, async (db) => (await db.delete(students).where(own(students, ctx, id)).returning({ id: students.id })).length > 0);
}

/** Active students already using this number, for "Also used for Riya Sen" (R2). */
export async function studentsSharingPhone(ctx: DbCtx, digits: string, exceptId?: string) {
  return withDb(ctx, (db) =>
    db
      .select({ id: students.id, fullName: students.fullName })
      .from(students)
      .where(
        and(
          eq(students.workspaceId, ctx.workspaceId),
          eq(students.status, "active"),
          eq(students.parentPhone, digits),
          exceptId ? ne(students.id, exceptId) : undefined,
        ),
      ),
  );
}

/** Weeks with notes or updates for each student: "{w} weeks of history" on archive and delete (R4, R5). */
export async function historyWeeks(ctx: DbCtx, studentIds: string[]): Promise<Map<string, number>> {
  if (studentIds.length === 0) return new Map();
  const rows = await withDb(ctx, async (db) => [
    ...(await db
      .selectDistinct({ studentId: extractedEntries.studentId, cycleId: extractedEntries.cycleId })
      .from(extractedEntries)
      .where(and(eq(extractedEntries.workspaceId, ctx.workspaceId), inArray(extractedEntries.studentId, studentIds)))),
    ...(await db
      .selectDistinct({ studentId: drafts.studentId, cycleId: drafts.cycleId })
      .from(drafts)
      .where(and(eq(drafts.workspaceId, ctx.workspaceId), inArray(drafts.studentId, studentIds)))),
  ]);
  const weeks = new Map(studentIds.map((id) => [id, new Set<string>()]));
  for (const row of rows) if (row.studentId) weeks.get(row.studentId)?.add(row.cycleId);
  return new Map([...weeks].map(([id, cycles]) => [id, cycles.size]));
}

/** "Remember this nickname" (§3 Stage F): stored as typed, skipped when the student already answers to it. */
export async function addNickname(ctx: DbCtx, id: string, nickname: string): Promise<void> {
  await withDb(ctx, async (db) => {
    const student = await getStudent(ctx, id);
    const name = nickname.trim();
    if (!student || !name) return;
    const known = [student.fullName, student.messageName, ...student.aliasesJson].map(normalizeName);
    if (known.includes(normalizeName(name))) return;
    await db.update(students).set({ aliasesJson: [...student.aliasesJson, name] }).where(own(students, ctx, id));
  });
}

/** V7's "Mark fees pending for Riya?" answered yes. */
export async function setFeesPending(ctx: DbCtx, id: string, pending: boolean): Promise<void> {
  await withDb(ctx, (db) => db.update(students).set({ feesPending: pending }).where(own(students, ctx, id)));
}
