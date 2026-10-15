import { and, asc, eq } from "drizzle-orm";
import { withDb } from "../client";
import { extractedEntries } from "../schema";
import type { DbCtx } from "../types";
import { own } from "./scope";

export type Entry = typeof extractedEntries.$inferSelect;
type NewEntry = Omit<typeof extractedEntries.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt">;
type EntryPatch = Partial<Pick<Entry, "studentId" | "resolution" | "payloadJson" | "flagsJson" | "confirmedAt">>;

export async function insertEntries(ctx: DbCtx, rows: NewEntry[]): Promise<Entry[]> {
  if (rows.length === 0) return [];
  return withDb(ctx, (db) =>
    db
      .insert(extractedEntries)
      .values(rows.map((r) => ({ ...r, workspaceId: ctx.workspaceId })))
      .returning(),
  );
}

export async function getEntry(ctx: DbCtx, id: string): Promise<Entry | null> {
  return withDb(ctx, async (db) => (await db.select().from(extractedEntries).where(own(extractedEntries, ctx, id)))[0] ?? null);
}

export async function listCycleEntries(ctx: DbCtx, cycleId: string): Promise<Entry[]> {
  return withDb(ctx, (db) =>
    db
      .select()
      .from(extractedEntries)
      .where(and(eq(extractedEntries.workspaceId, ctx.workspaceId), eq(extractedEntries.cycleId, cycleId)))
      .orderBy(asc(extractedEntries.createdAt)),
  );
}

export async function updateEntry(ctx: DbCtx, id: string, patch: EntryPatch): Promise<Entry | null> {
  return withDb(ctx, async (db) => (await db.update(extractedEntries).set(patch).where(own(extractedEntries, ctx, id)).returning())[0] ?? null);
}
