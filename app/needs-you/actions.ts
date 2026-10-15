"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { asMember } from "@/lib/auth/require-member";
import { ROLE_RANK, type ActionResult } from "@/lib/auth/types";
import { withDb } from "@/lib/db/client";
import { getEntry, updateEntry } from "@/lib/db/queries/entries";
import { addNickname, createStudent, getStudent, setFeesPending } from "@/lib/db/queries/students";
import { autoConfirm, unconfirm } from "@/lib/pipeline/confirm";
import { Language } from "@/lib/schemas/common";
import { StudentInput } from "@/lib/schemas/student";

const Choice = z.union([
  z.object({ studentId: z.string(), rememberAlias: z.boolean() }),
  z.object({ ignore: z.literal(true) }),
  z.object({ newStudent: z.object({ fullName: z.string(), classGrade: z.string(), parentPhone: z.string(), parentLanguage: Language }) }),
]);
export type Choice = z.infer<typeof Choice>;

const GONE = { ok: false, error: { code: "not_found", message: "This has already been answered, maybe on another device." } } as const;
const INVALID = { ok: false, error: { code: "invalid", message: "Something here isn't filled in the way it should be." } } as const;

/**
 * S6's human step (§7.1): this line is about a student on the list, a new student, or no one.
 * Remembering the nickname means the next note with it matches on its own.
 */
export async function resolveEntry(entryId: string, choice: Choice): Promise<ActionResult<{ studentId: string | null; name: string | null }>> {
  return asMember("assistant", "", async (ctx) => {
    const c = Choice.safeParse(choice);
    if (!c.success) return INVALID;
    if ("newStudent" in c.data && ROLE_RANK[ctx.role] < ROLE_RANK.teacher) {
      return { ok: false, error: { code: "forbidden", message: "Only owners and teachers can add students." } };
    }
    const result = await withDb(ctx, async (): Promise<ActionResult<{ studentId: string | null; name: string | null }>> => {
      const entry = await getEntry(ctx, entryId);
      if (!entry || entry.resolution === "ignored" || entry.confirmedAt) return GONE;
      if ("ignore" in c.data) {
        await updateEntry(ctx, entryId, { resolution: "ignored" });
        return { ok: true, data: { studentId: null, name: null } };
      }

      let student;
      if ("newStudent" in c.data) {
        const input = StudentInput.safeParse({ ...c.data.newStudent, messageName: c.data.newStudent.fullName.trim().split(/\s+/)[0] ?? "" });
        if (!input.success) return INVALID;
        student = await createStudent(ctx, input.data);
      } else {
        student = await getStudent(ctx, c.data.studentId);
        if (student?.status !== "active") return GONE;
        if (c.data.rememberAlias && entry.nameAsWritten) await addNickname(ctx, student.id, entry.nameAsWritten);
      }
      await updateEntry(ctx, entryId, { studentId: student.id, resolution: "manual", flagsJson: entry.flagsJson.filter((f) => f.code !== "unattributed") });
      await autoConfirm(ctx, entryId);
      return { ok: true, data: { studentId: student.id, name: student.messageName } };
    });
    if (result.ok) refresh();
    return result;
  });
}

/**
 * Undo for "Ignored" (N3) and for an auto-match (N4): the line goes back to Needs you. A nickname
 * that was remembered stays.
 */
export async function undoResolve(entryId: string): Promise<ActionResult<null>> {
  return asMember("assistant", "", async (ctx) => {
    const result = await withDb(ctx, async (): Promise<ActionResult<null>> => {
      const entry = await getEntry(ctx, entryId);
      if (!entry) return GONE;
      if (entry.resolution === "ignored") {
        await updateEntry(ctx, entryId, { resolution: entry.studentId ? "manual" : "unmatched" });
        await autoConfirm(ctx, entryId);
      } else if (entry.resolution === "fuzzy") {
        await unconfirm(ctx, entryId);
        await updateEntry(ctx, entryId, { resolution: "unmatched", studentId: null });
      } else {
        return GONE;
      }
      return { ok: true, data: null };
    });
    if (result.ok) refresh();
    return result;
  });
}

/**
 * Answers a missing total (M5-KabirTotal) or a score above its total: the corrected score, or
 * null for "Leave this score out", which keeps the rest of the line.
 */
export async function setEntryScore(entryId: string, index: number, score: { scored: number; max: number } | null): Promise<ActionResult<null>> {
  return asMember("assistant", "", async (ctx) => {
    if (score && !(Number.isFinite(score.scored) && Number.isFinite(score.max) && score.max > 0 && score.scored >= 0 && score.scored <= score.max)) {
      return { ok: false, error: { code: "invalid", message: "The score has to be between 0 and the total." } };
    }
    const result = await withDb(ctx, async (): Promise<ActionResult<null>> => {
      const entry = await getEntry(ctx, entryId);
      const assessment = entry?.payloadJson.assessments[index];
      if (!entry || !assessment || entry.confirmedAt) return GONE;
      const assessments = entry.payloadJson.assessments.map((a, i) => (i === index ? { ...a, scored: score?.scored ?? null, max: score?.max ?? null } : a));
      const flagsJson = entry.flagsJson.filter((f) => !((f.code === "missing_total" || f.code === "impossible_score") && (f.data as { index?: number } | undefined)?.index === index));
      await updateEntry(ctx, entryId, { payloadJson: { ...entry.payloadJson, assessments }, flagsJson });
      await autoConfirm(ctx, entryId);
      return { ok: true, data: null };
    });
    if (result.ok) refresh();
    return result;
  });
}

/** V7: "Mark fees pending for Riya?" Yes sets the student's toggle; either answer clears the question. */
export async function answerFeePrompt(entryId: string, pending: boolean): Promise<ActionResult<null>> {
  return asMember("assistant", "", async (ctx) => {
    const result = await withDb(ctx, async (): Promise<ActionResult<null>> => {
      const entry = await getEntry(ctx, entryId);
      if (!entry?.studentId || !entry.flagsJson.some((f) => f.code === "fee_prompt")) return GONE;
      if (pending) await setFeesPending(ctx, entry.studentId, true);
      await updateEntry(ctx, entryId, { flagsJson: entry.flagsJson.filter((f) => f.code !== "fee_prompt") });
      return { ok: true, data: null };
    });
    if (result.ok) refresh();
    return result;
  });
}
