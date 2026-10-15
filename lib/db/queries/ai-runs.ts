import { and, count, eq, gte } from "drizzle-orm";
import { withDb } from "../client";
import { aiRuns } from "../schema";
import type { DbCtx } from "../types";

export type AiRun = typeof aiRuns.$inferSelect;
// Metadata only: there is deliberately no column for prompt or output text (§10).
type NewAiRun = Omit<typeof aiRuns.$inferInsert, "id" | "workspaceId" | "memberId" | "createdAt" | "updatedAt">;

export async function insertAiRun(ctx: DbCtx, run: NewAiRun): Promise<void> {
  await withDb(ctx, (db) => db.insert(aiRuns).values({ ...run, workspaceId: ctx.workspaceId, memberId: ctx.memberId || null }));
}

/** For the hosted quotas (§19.14), counted from `ai_runs` on the server. */
export async function countAiRuns(ctx: DbCtx, filter: { since: string; task?: AiRun["task"]; memberId?: string }): Promise<number> {
  return withDb(ctx, async (db) => {
    const [row] = await db
      .select({ n: count() })
      .from(aiRuns)
      .where(
        and(
          eq(aiRuns.workspaceId, ctx.workspaceId),
          gte(aiRuns.createdAt, filter.since),
          filter.task ? eq(aiRuns.task, filter.task) : undefined,
          filter.memberId ? eq(aiRuns.memberId, filter.memberId) : undefined,
        ),
      );
    return row.n;
  });
}
