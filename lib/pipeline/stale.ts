import { audit } from "@/lib/db/queries/audit";
import { getLiveDraft, updateDraft } from "@/lib/db/queries/drafts";
import type { DbCtx } from "@/lib/db/types";

/**
 * §4.1 "Stale": a ready, flagged or approved draft no longer matches the student's facts, so it
 * becomes Out of date. An approval is removed, so nothing old goes out; a sent draft is history.
 */
export async function markStale(ctx: DbCtx, cycleId: string, studentId: string): Promise<void> {
  const live = await getLiveDraft(ctx, cycleId, studentId);
  if (!live || !["ready", "flagged", "approved"].includes(live.status)) return;
  await updateDraft(ctx, live.id, { status: "stale", approvedBy: null, approvedAt: null });
  if (live.status === "approved") await audit(ctx, "approval_removed", { table: "drafts", id: live.id });
}
