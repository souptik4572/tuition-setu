import "server-only";
import { getHealth } from "@/lib/ai/health";
import { log } from "@/lib/log";
import { getLocalOwner } from "@/lib/db/queries/members";
import { listNotesByStatus, type Note } from "@/lib/db/queries/notes";
import { getWorkspace } from "@/lib/db/queries/workspaces";
import { scheduleNote } from "./process-note";

const RETRY_EVERY_MS = 30_000;
const ENGINE_OFF = new Set(["provider_unreachable", "model_missing"]);

/**
 * Local mode reads notes nobody is waiting on (IMPL §3.3, F2-Variants): ones left mid-read by a
 * restart, ones saved while the engine was off, and ones that failed because it was off. Nothing
 * is queued until the engine answers and the reading model is installed.
 */
async function readWaitingNotes(afterRestart: boolean) {
  const owner = await getLocalOwner();
  if (!owner) return;
  const ctx = { workspaceId: owner.workspaceId, memberId: owner.id, system: true as const };
  const statuses: Note["status"][] = afterRestart ? ["captured", "extracting", "failed"] : ["captured", "failed"];
  const notes = (await listNotesByStatus(ctx, statuses)).filter((n) => n.status !== "failed" || ENGINE_OFF.has(n.errorCode ?? ""));
  if (!notes.length) return;

  const workspace = await getWorkspace(ctx);
  const health = await getHealth({ aiConfig: workspace?.aiConfigJson, fresh: true });
  if (!health.reachable || !health.models.find((m) => m.task === "extract")?.installed) return;
  log("notes_retried", { count: notes.length, afterRestart });
  for (const note of notes) scheduleNote(ctx, note.id);
}

const run = (afterRestart: boolean) => () =>
  readWaitingNotes(afterRestart).catch((error) => log("notes_retry_failed", { error: error instanceof Error ? error.name : "unknown" }));

export function startNoteRecovery() {
  const g = globalThis as typeof globalThis & { __tsNoteRecovery?: boolean };
  if (g.__tsNoteRecovery) return;
  g.__tsNoteRecovery = true;
  setTimeout(run(true), 3_000);
  setInterval(run(false), RETRY_EVERY_MS);
}
