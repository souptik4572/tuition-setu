import "server-only";
import { modelFor } from "@/lib/ai";
import type { Ctx } from "@/lib/auth/types";
import { getMember } from "@/lib/db/queries/members";
import { getWorkspace } from "@/lib/db/queries/workspaces";

/** The workspace's settings, and the AI name and avatar for the app shell. */
export async function loadShell(ctx: Ctx) {
  const [workspace, member] = await Promise.all([getWorkspace(ctx), getMember(ctx, ctx.memberId)]);
  return { workspace: workspace!, member, shell: { aiName: modelFor("draft", workspace!.aiConfigJson), userName: member?.displayName } };
}
