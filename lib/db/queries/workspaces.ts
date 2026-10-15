import { eq } from "drizzle-orm";
import type { WorkspaceSettingsData } from "@/lib/schemas/settings";
import { withDb } from "../client";
import { members, workspaces } from "../schema";
import type { DbCtx } from "../types";
import { BEFORE_SIGN_IN } from "./scope";

export type Workspace = typeof workspaces.$inferSelect;

export type NewOwner = {
  userId: string;
  displayName: string;
  signature: string;
  pinHash?: string;
  pinSalt?: string;
  pinKind?: "pin" | "passphrase";
};

/** Local setup gate: `/setup` is open only while this is false (§3 Stage B). */
export async function hasWorkspace(): Promise<boolean> {
  return withDb(BEFORE_SIGN_IN, async (db) => (await db.select({ id: workspaces.id }).from(workspaces).limit(1)).length > 0);
}

/** Local setup (B2–B3): the workspace and its owner in one transaction. Hosted mode uses `private.create_workspace` (M12). */
export async function createWorkspaceWithOwner(settings: WorkspaceSettingsData, owner: NewOwner) {
  return withDb(BEFORE_SIGN_IN, async (db) => {
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: settings.name,
        subjectsJson: settings.subjects,
        defaultLanguage: settings.defaultLanguage,
        tone: settings.tone,
        reportDay: settings.reportDay,
        timezone: settings.timezone,
        includeFeeReminders: settings.includeFeeReminders,
        deletePhotosAfterConfirm: settings.deletePhotosAfterConfirm,
      })
      .returning({ id: workspaces.id });
    const [member] = await db
      .insert(members)
      .values({ ...owner, workspaceId: workspace.id, role: "owner" })
      .returning({ id: members.id });
    return { workspaceId: workspace.id, memberId: member.id };
  });
}

export async function getWorkspace(ctx: DbCtx): Promise<Workspace | null> {
  return withDb(ctx, async (db) => (await db.select().from(workspaces).where(eq(workspaces.id, ctx.workspaceId)))[0] ?? null);
}

export async function updateWorkspace(ctx: DbCtx, patch: Partial<Omit<typeof workspaces.$inferInsert, "id" | "createdAt" | "updatedAt">>) {
  return withDb(ctx, async (db) => (await db.update(workspaces).set(patch).where(eq(workspaces.id, ctx.workspaceId)).returning())[0] ?? null);
}
