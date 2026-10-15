import { withDb } from "@/lib/db/client";
import { deleteEntryAssessments, insertAssessments } from "@/lib/db/queries/assessments";
import { getEntry, updateEntry, type Entry } from "@/lib/db/queries/entries";
import { getNote } from "@/lib/db/queries/notes";
import type { DbCtx } from "@/lib/db/types";

const RESOLVED = new Set<Entry["resolution"]>(["exact", "alias", "fuzzy", "manual"]);

/**
 * §S6.5: an entry that belongs to a student and has nothing blocking is confirmed, and its
 * complete scores are written to `assessments`. Runs after reading a note and after every answer
 * in Needs you; anything else waits there.
 */
export async function autoConfirm(ctx: DbCtx, entryId: string): Promise<Entry | null> {
  return withDb(ctx, async () => {
    const entry = await getEntry(ctx, entryId);
    if (!entry || entry.confirmedAt || !entry.studentId || !RESOLVED.has(entry.resolution) || entry.flagsJson.some((f) => f.blocking)) return entry;
    const note = await getNote(ctx, entry.noteInputId);
    const scores = entry.payloadJson.assessments.flatMap((a) =>
      a.scored !== null && a.max !== null && a.max > 0 && a.scored <= a.max ? [{ label: a.label.trim() || "test", scored: a.scored, max: a.max }] : [],
    );
    await insertAssessments(
      ctx,
      scores.map((s) => ({ ...s, studentId: entry.studentId!, cycleId: entry.cycleId, entryId, takenOn: note!.classDate })),
    );
    return updateEntry(ctx, entryId, { confirmedAt: new Date().toISOString() });
  });
}

/** Takes an entry back out of the student's week: Undo on an auto-match, or an Ignore. */
export async function unconfirm(ctx: DbCtx, entryId: string): Promise<void> {
  await withDb(ctx, async () => {
    await deleteEntryAssessments(ctx, entryId);
    await updateEntry(ctx, entryId, { confirmedAt: null });
  });
}
