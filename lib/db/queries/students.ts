import { and, asc, count, eq, ne } from "drizzle-orm";
import type { StudentData } from "@/lib/schemas/student";
import { withDb } from "../client";
import { students } from "../schema";
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
