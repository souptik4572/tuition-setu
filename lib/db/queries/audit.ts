import { withDb } from "../client";
import { auditEvents } from "../schema";
import type { DbCtx } from "../types";

/** Who did what to which row (§6.1). Never pass note or message text in `meta`. */
export async function audit(ctx: DbCtx, action: string, target?: { table: string; id: string }, meta?: Record<string, unknown>): Promise<void> {
  await withDb(ctx, (db) =>
    db.insert(auditEvents).values({
      workspaceId: ctx.workspaceId,
      actorMemberId: ctx.memberId || null,
      action,
      targetTable: target?.table ?? null,
      targetId: target?.id ?? null,
      metaJson: meta ?? null,
    }),
  );
}
