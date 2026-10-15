import { and, eq, ne } from "drizzle-orm";
import { cycleRangeFor, formatRange } from "@/lib/util/dates";
import { withDb } from "../client";
import { cycles } from "../schema";
import type { DbCtx } from "../types";
import { own } from "./scope";

export type Cycle = typeof cycles.$inferSelect;

/** The cycle notes go into: `open` or `reviewing`. At most one exists (a partial unique index). */
export async function getOpenCycle(ctx: DbCtx): Promise<Cycle | null> {
  return withDb(ctx, async (db) => (await db.select().from(cycles).where(and(eq(cycles.workspaceId, ctx.workspaceId), ne(cycles.status, "completed"))))[0] ?? null);
}

/**
 * The open cycle, or a new Monday–Sunday cycle around `classDate` when none is open (§S1).
 * A note dated outside the open cycle still joins it (IMPL Appendix D, Q1).
 */
export async function openCycleFor(ctx: DbCtx, classDate: string): Promise<Cycle> {
  return withDb(ctx, async (db) => {
    const open = await getOpenCycle(ctx);
    if (open) return open;
    const { from, to } = cycleRangeFor(classDate);
    const [created] = await db
      .insert(cycles)
      .values({ workspaceId: ctx.workspaceId, label: formatRange(from, to), startsOn: from, endsOn: to })
      .returning();
    return created;
  });
}

export async function getCycle(ctx: DbCtx, id: string): Promise<Cycle | null> {
  return withDb(ctx, async (db) => (await db.select().from(cycles).where(own(cycles, ctx, id)))[0] ?? null);
}

export async function setCycleStatus(ctx: DbCtx, id: string, status: Cycle["status"]): Promise<Cycle | null> {
  const completedAt = status === "completed" ? new Date().toISOString() : null;
  return withDb(ctx, async (db) => (await db.update(cycles).set({ status, completedAt }).where(own(cycles, ctx, id)).returning())[0] ?? null);
}
