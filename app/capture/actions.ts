"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { asMember } from "@/lib/auth/require-member";
import type { ActionResult } from "@/lib/auth/types";
import { withDb } from "@/lib/db/client";
import { openCycleFor } from "@/lib/db/queries/cycles";
import { createNote, getNote, updateNote } from "@/lib/db/queries/notes";
import { getWorkspace } from "@/lib/db/queries/workspaces";
import { scheduleNote } from "@/lib/pipeline/process-note";
import { NoteInput } from "@/lib/schemas/note";
import { todayIn } from "@/lib/util/dates";

/**
 * S1: the note is stored before any AI runs, so saving works with the engine off (§12: < 300 ms).
 * Reading starts after the response is sent.
 */
export async function saveNote(input: NoteInput): Promise<ActionResult<{ noteId: string }>> {
  return asMember("assistant", "", async (ctx) => {
    const parsed = NoteInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: { code: "invalid", message: parsed.error.issues[0].message } };
    const { text, batch, origin } = parsed.data;
    const workspace = await getWorkspace(ctx);
    const classDate = parsed.data.classDate ?? todayIn(workspace!.timezone);
    const note = await withDb(ctx, async () => {
      const cycle = await openCycleFor(ctx, classDate);
      return createNote(ctx, { cycleId: cycle.id, source: "typed", origin, classDate, batch, rawText: text });
    });
    after(() => scheduleNote(ctx, note.id));
    return { ok: true, data: { noteId: note.id } };
  });
}

/** F2 "Edit the note": a typed note that couldn't be read gets new text and is read again. */
export async function editNote(noteId: string, text: string): Promise<ActionResult<null>> {
  return asMember("assistant", "", async (ctx) => {
    const parsed = NoteInput.shape.text.safeParse(text);
    if (!parsed.success) return { ok: false, error: { code: "invalid", message: parsed.error.issues[0].message } };
    const note = await getNote(ctx, noteId);
    if (!note) return { ok: false, error: { code: "not_found", message: "This note isn't here any more." } };
    if (note.status !== "failed" || note.source !== "typed") return { ok: false, error: { code: "conflict", message: "This note is already being read." } };
    await updateNote(ctx, noteId, { rawText: parsed.data, status: "captured", errorCode: null });
    after(() => scheduleNote(ctx, noteId));
    refresh();
    return { ok: true, data: null };
  });
}
