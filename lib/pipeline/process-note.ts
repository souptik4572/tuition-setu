import "server-only";
import { getProvider, modelFor } from "@/lib/ai";
import { toAiError } from "@/lib/ai/errors";
import { EXTRACT_PROMPT_VERSION, extractPrompt } from "@/lib/ai/prompts/extract";
import { generateStructured } from "@/lib/ai/run";
import { withDb } from "@/lib/db/client";
import { deleteNoteEntries, insertEntries } from "@/lib/db/queries/entries";
import { getNote, updateNote } from "@/lib/db/queries/notes";
import { listStudents } from "@/lib/db/queries/students";
import { getWorkspace } from "@/lib/db/queries/workspaces";
import type { DbCtx } from "@/lib/db/types";
import { ExtractionResult } from "@/lib/schemas/extraction";
import { autoConfirm } from "./confirm";
import { enqueue } from "./queue";
import { resolve } from "./resolve";
import { validate } from "./validate";

/**
 * A typed note through S4–S6 (§4.1): `captured → extracting → processed`, or `failed` with the
 * AI error code. The note's text is never changed here, so a failure loses nothing. `model`
 * replaces the workspace's reading model for "Try the other model".
 */
export async function processNote(ctx: DbCtx, noteId: string, opts: { model?: string } = {}): Promise<void> {
  const note = await getNote(ctx, noteId);
  if (!note || note.rawText === null || note.status === "processed") return;
  await updateNote(ctx, noteId, { status: "extracting", errorCode: null });

  const [workspace, roster] = await Promise.all([getWorkspace(ctx), listStudents(ctx)]);
  let result: ExtractionResult;
  try {
    const prompt = extractPrompt({
      rawText: note.rawText,
      classDate: note.classDate,
      batch: note.batch,
      roster: roster.map((s) => ({ fullName: s.fullName, aliases: s.aliasesJson })),
    });
    result = await generateStructured(ctx, getProvider(), {
      task: "extract",
      model: opts.model ?? modelFor("extract", workspace?.aiConfigJson),
      schema: ExtractionResult,
      system: prompt.system,
      prompt: prompt.user,
      temperature: 0,
      timeoutMs: 120_000,
      promptVersion: EXTRACT_PROMPT_VERSION,
    });
  } catch (error) {
    await updateNote(ctx, noteId, { status: "failed", errorCode: toAiError(error).code });
    return;
  }

  const names = roster.map((s) => ({ id: s.id, fullName: s.fullName, messageName: s.messageName, aliases: s.aliasesJson }));
  await withDb(ctx, async () => {
    await deleteNoteEntries(ctx, noteId);
    const rows = await insertEntries(
      ctx,
      validate(note.rawText!, result).map((v) => {
        const match = v.name ? resolve(v.name, names) : null;
        return {
          noteInputId: noteId,
          cycleId: note.cycleId,
          nameAsWritten: v.name,
          studentId: match?.studentId ?? null,
          resolution: match?.resolution ?? "unmatched",
          payloadJson: v.payload,
          flagsJson: v.flags,
        };
      }),
    );
    for (const row of rows) await autoConfirm(ctx, row.id);
    await updateNote(ctx, noteId, { status: "processed", errorCode: null });
  });
}

/** Reads the note in the background, one note at a time (IMPL §3.3). */
export function scheduleNote(ctx: DbCtx, noteId: string, opts: { model?: string } = {}): void {
  enqueue(`note:${noteId}`, () => processNote(ctx, noteId, opts));
}
