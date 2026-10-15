import { and, asc, eq } from "drizzle-orm";
import { withDb } from "../client";
import { assessments } from "../schema";
import type { DbCtx } from "../types";
import { own } from "./scope";

export type AssessmentRow = typeof assessments.$inferSelect;
type NewAssessment = Omit<typeof assessments.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt">;

export async function insertAssessments(ctx: DbCtx, rows: NewAssessment[]): Promise<AssessmentRow[]> {
  if (rows.length === 0) return [];
  return withDb(ctx, (db) =>
    db
      .insert(assessments)
      .values(rows.map((r) => ({ ...r, workspaceId: ctx.workspaceId })))
      .returning(),
  );
}

/** Oldest first: the order trends are computed in (§S7). */
export async function listStudentAssessments(ctx: DbCtx, studentId: string): Promise<AssessmentRow[]> {
  return withDb(ctx, (db) =>
    db
      .select()
      .from(assessments)
      .where(and(eq(assessments.workspaceId, ctx.workspaceId), eq(assessments.studentId, studentId)))
      .orderBy(asc(assessments.takenOn), asc(assessments.createdAt)),
  );
}

export async function updateAssessmentRow(ctx: DbCtx, id: string, patch: Partial<Pick<AssessmentRow, "scored" | "max" | "label">>) {
  return withDb(ctx, async (db) => (await db.update(assessments).set(patch).where(own(assessments, ctx, id)).returning())[0] ?? null);
}

/** Used when an entry is un-confirmed (Undo on an auto-match or an ignore). */
export async function deleteEntryAssessments(ctx: DbCtx, entryId: string): Promise<void> {
  await withDb(ctx, (db) => db.delete(assessments).where(and(eq(assessments.workspaceId, ctx.workspaceId), eq(assessments.entryId, entryId))));
}
