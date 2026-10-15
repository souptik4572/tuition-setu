import { and, desc, eq, max } from "drizzle-orm";
import { withDb } from "../client";
import { cycles, drafts } from "../schema";
import type { DbCtx } from "../types";
import { own } from "./scope";

export type Draft = typeof drafts.$inferSelect;
type NewDraft = Omit<typeof drafts.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt" | "version">;
type DraftPatch = Partial<Omit<Draft, "id" | "workspaceId" | "cycleId" | "studentId" | "version" | "createdAt" | "updatedAt">>;

/** Adds the next version for the student; the newest version is the live draft (§6.1). */
export async function insertDraft(ctx: DbCtx, draft: NewDraft): Promise<Draft> {
  return withDb(ctx, async (db) => {
    const [{ latest }] = await db
      .select({ latest: max(drafts.version) })
      .from(drafts)
      .where(and(eq(drafts.workspaceId, ctx.workspaceId), eq(drafts.cycleId, draft.cycleId), eq(drafts.studentId, draft.studentId)));
    const [row] = await db
      .insert(drafts)
      .values({ ...draft, version: (latest ?? 0) + 1, workspaceId: ctx.workspaceId })
      .returning();
    return row;
  });
}

export async function getDraft(ctx: DbCtx, id: string): Promise<Draft | null> {
  return withDb(ctx, async (db) => (await db.select().from(drafts).where(own(drafts, ctx, id)))[0] ?? null);
}

export async function getLiveDraft(ctx: DbCtx, cycleId: string, studentId: string): Promise<Draft | null> {
  return withDb(ctx, async (db) => {
    const rows = await db
      .select()
      .from(drafts)
      .where(and(eq(drafts.workspaceId, ctx.workspaceId), eq(drafts.cycleId, cycleId), eq(drafts.studentId, studentId)))
      .orderBy(desc(drafts.version))
      .limit(1);
    return rows[0] ?? null;
  });
}

/** The live draft of every student in the cycle, keyed by student id. */
export async function listLiveDrafts(ctx: DbCtx, cycleId: string): Promise<Map<string, Draft>> {
  const rows = await withDb(ctx, (db) =>
    db
      .select()
      .from(drafts)
      .where(and(eq(drafts.workspaceId, ctx.workspaceId), eq(drafts.cycleId, cycleId)))
      .orderBy(desc(drafts.version)),
  );
  const live = new Map<string, Draft>();
  for (const row of rows) if (!live.has(row.studentId)) live.set(row.studentId, row);
  return live;
}

/** The student's live draft in each week, newest week first: the profile's Messages tab (R3). */
export async function listStudentDrafts(ctx: DbCtx, studentId: string) {
  const rows = await withDb(ctx, (db) =>
    db
      .select({ draft: drafts, cycle: cycles })
      .from(drafts)
      .innerJoin(cycles, eq(cycles.id, drafts.cycleId))
      .where(and(eq(drafts.workspaceId, ctx.workspaceId), eq(drafts.studentId, studentId)))
      .orderBy(desc(cycles.startsOn), desc(drafts.version)),
  );
  const seen = new Set<string>();
  return rows.filter(({ cycle }) => !seen.has(cycle.id) && seen.add(cycle.id));
}

export async function updateDraft(ctx: DbCtx, id: string, patch: DraftPatch): Promise<Draft | null> {
  return withDb(ctx, async (db) => (await db.update(drafts).set(patch).where(own(drafts, ctx, id)).returning())[0] ?? null);
}
