import { and, asc, eq } from "drizzle-orm";
import { withDb } from "../client";
import { members } from "../schema";
import type { DbCtx } from "../types";
import { BEFORE_SIGN_IN, own } from "./scope";

export type Member = typeof members.$inferSelect;

export async function getMember(ctx: DbCtx, memberId: string): Promise<Member | null> {
  return withDb(ctx, async (db) => (await db.select().from(members).where(own(members, ctx, memberId)))[0] ?? null);
}

/**
 * Local mode has one workspace with one owner (D7). The login screen needs the owner's name and
 * whether to show the PIN pad or the passphrase field before anyone is signed in.
 */
export async function getLocalOwner(): Promise<Member | null> {
  return withDb(BEFORE_SIGN_IN, async (db) => (await db.select().from(members).where(and(eq(members.role, "owner"), eq(members.status, "active"))).limit(1))[0] ?? null);
}

/** For "Only the owner, Mita, can delete a student permanently" (R3-Teacher). */
export async function getOwnerName(ctx: DbCtx): Promise<string | null> {
  return withDb(ctx, async (db) => {
    const [owner] = await db
      .select({ displayName: members.displayName })
      .from(members)
      .where(and(eq(members.workspaceId, ctx.workspaceId), eq(members.role, "owner"), eq(members.status, "active")))
      .orderBy(asc(members.createdAt))
      .limit(1);
    return owner?.displayName ?? null;
  });
}

export async function updateMemberProfile(ctx: DbCtx, profile: { displayName: string; signature: string }) {
  return withDb(ctx, async (db) => (await db.update(members).set(profile).where(own(members, ctx, ctx.memberId)).returning())[0] ?? null);
}

/** `npm run reset-pin` and, later, Change PIN (M18). */
export async function setMemberSecret(ctx: DbCtx, secret: { pinHash: string; pinSalt: string; pinKind: "pin" | "passphrase" }) {
  await withDb(ctx, (db) => db.update(members).set(secret).where(own(members, ctx, ctx.memberId)));
}
