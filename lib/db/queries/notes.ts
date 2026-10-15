import { and, asc, eq, inArray } from "drizzle-orm";
import { withDb } from "../client";
import { noteInputs } from "../schema";
import type { DbCtx } from "../types";
import { own } from "./scope";

export type Note = typeof noteInputs.$inferSelect;
type NewNote = Omit<typeof noteInputs.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt">;
type NotePatch = Partial<Pick<Note, "status" | "errorCode" | "rawText" | "transcriptDraftJson" | "imagePath">>;

export async function createNote(ctx: DbCtx, note: NewNote): Promise<Note> {
  return withDb(ctx, async (db) => (await db.insert(noteInputs).values({ ...note, workspaceId: ctx.workspaceId }).returning())[0]);
}

export async function getNote(ctx: DbCtx, id: string): Promise<Note | null> {
  return withDb(ctx, async (db) => (await db.select().from(noteInputs).where(own(noteInputs, ctx, id)))[0] ?? null);
}

export async function updateNote(ctx: DbCtx, id: string, patch: NotePatch): Promise<Note | null> {
  return withDb(ctx, async (db) => (await db.update(noteInputs).set(patch).where(own(noteInputs, ctx, id)).returning())[0] ?? null);
}

/** Oldest first, so recovery and "Process pending notes" work through them in order. */
export async function listNotesByStatus(ctx: DbCtx, statuses: Note["status"][]): Promise<Note[]> {
  return withDb(ctx, (db) =>
    db
      .select()
      .from(noteInputs)
      .where(and(eq(noteInputs.workspaceId, ctx.workspaceId), inArray(noteInputs.status, statuses)))
      .orderBy(asc(noteInputs.createdAt)),
  );
}
