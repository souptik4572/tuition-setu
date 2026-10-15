type DraftStatus = "generating" | "ready" | "flagged" | "stale" | "approved" | "sent" | "skipped";

export type WeekStatus = "writing" | "checked" | "flagged" | "stale" | "approved" | "sent" | "skipped" | "needs_you" | "notes" | "no_notes";

const FROM_DRAFT: Record<DraftStatus, WeekStatus> = {
  generating: "writing",
  ready: "checked",
  flagged: "flagged",
  stale: "stale",
  approved: "approved",
  sent: "sent",
  skipped: "skipped",
};

/**
 * A student's chip for the open week (IMPL §6.5): the live draft's status, else Needs you, else
 * Note saved, else No notes. An entry tied to the student but not confirmed is waiting on the
 * tutor: auto-confirm (§S6.5) confirms every entry that has no blocking flag.
 */
export function weekStatus(draft: DraftStatus | undefined, entries: { confirmedAt: string | null; resolution: string }[]): WeekStatus {
  if (draft) return FROM_DRAFT[draft];
  if (entries.some((e) => !e.confirmedAt && e.resolution !== "ignored")) return "needs_you";
  if (entries.some((e) => e.confirmedAt)) return "notes";
  return "no_notes";
}
