// Local mode only (§9.2). These run while the session itself is being checked, so they take the
// workspace from the session row, never from the request.
import { and, eq, isNull } from "drizzle-orm";
import { withDb } from "../client";
import { sessions } from "../schema";
import type { DbCtx } from "../types";
import { BEFORE_SIGN_IN, own } from "./scope";

export type Session = typeof sessions.$inferSelect;

export async function insertSession(
  owner: { workspaceId: string; memberId: string },
  session: { tokenHash: string; deviceLabel: string; userAgent: string | null; expiresAt: string },
): Promise<Session> {
  const now = new Date().toISOString();
  return withDb(BEFORE_SIGN_IN, async (db) => (await db.insert(sessions).values({ ...owner, ...session, lastSeenAt: now }).returning())[0]);
}

export async function findSessionByTokenHash(tokenHash: string): Promise<Session | null> {
  return withDb(BEFORE_SIGN_IN, async (db) => (await db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)))[0] ?? null);
}

/** Sliding expiry (§9.2): called at most once an hour per session. */
export async function touchSession(id: string, lastSeenAt: string, expiresAt: string): Promise<void> {
  await withDb(BEFORE_SIGN_IN, (db) => db.update(sessions).set({ lastSeenAt, expiresAt }).where(eq(sessions.id, id)));
}

export async function revokeSession(ctx: DbCtx, id: string): Promise<boolean> {
  const now = new Date().toISOString();
  return withDb(ctx, async (db) => (await db.update(sessions).set({ revokedAt: now }).where(and(own(sessions, ctx, id), isNull(sessions.revokedAt))).returning({ id: sessions.id })).length > 0);
}

/** `npm run reset-pin` and "Sign out every device": every live session in the workspace. */
export async function revokeAllSessions(workspaceId: string): Promise<number> {
  const now = new Date().toISOString();
  return withDb(BEFORE_SIGN_IN, async (db) => (await db.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.workspaceId, workspaceId), isNull(sessions.revokedAt))).returning({ id: sessions.id })).length);
}
