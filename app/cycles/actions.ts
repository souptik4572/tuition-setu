"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { asMember } from "@/lib/auth/require-member";
import type { ActionResult } from "@/lib/auth/types";
import { withDb } from "@/lib/db/client";
import { audit } from "@/lib/db/queries/audit";
import { getCycle, setCycleStatus } from "@/lib/db/queries/cycles";
import { deleteDraft, getDraft, getLiveDraft, insertDraft, listLiveDrafts, updateDraft, type Draft } from "@/lib/db/queries/drafts";
import { getStudent, listStudents } from "@/lib/db/queries/students";
import { checkAndAssemble, loadDraftContext } from "@/lib/pipeline/draft";

const CHANGE = "Only owners and teachers can change updates.";
const GONE = { ok: false, error: { code: "not_found", message: "This update isn't here any more. It may have changed on another device." } } as const;
const conflict = (message: string) => ({ ok: false as const, error: { code: "conflict" as const, message } });
// A dismissed flag (`override`) counts as checked until the text changes.
const guardStatus = (draft: Draft): Draft["status"] => (draft.override || draft.guardJson?.status === "pass" ? "ready" : "flagged");

/**
 * The tutor's own wording for the body (§S11). The guard runs again; an out-of-date draft is
 * checked against the current facts, so an old number can't slip through.
 */
export async function editDraft(id: string, body: string): Promise<ActionResult<{ status: Draft["status"] }>> {
  return asMember("teacher", CHANGE, async (ctx) => {
    if (!body.trim()) return { ok: false, error: { code: "invalid", message: "Write the update first." } };
    const result = await withDb(ctx, async (): Promise<ActionResult<{ status: Draft["status"] }>> => {
      const draft = await getDraft(ctx, id);
      if (!draft) return GONE;
      if (draft.status === "sent") return conflict("This update has already been sent.");
      const dc = await loadDraftContext(ctx, draft.cycleId, draft.studentId);
      if (!dc) return GONE;
      const facts = draft.status === "stale" || !draft.factsJson ? dc.facts : draft.factsJson;
      const checked = checkAndAssemble(dc, body, facts);
      await updateDraft(ctx, id, {
        bodyFinal: checked.body,
        messageFinal: checked.message,
        guardJson: checked.guard,
        factsJson: facts,
        status: checked.status,
        override: false,
        approvedBy: null,
        approvedAt: null,
      });
      return { ok: true, data: { status: checked.status } };
    });
    if (result.ok) refresh();
    return result;
  });
}

/** S11: a checked draft, or one whose flag the tutor dismissed. Never a flagged or out-of-date one. */
export async function approveDraft(id: string): Promise<ActionResult<null>> {
  return asMember("teacher", CHANGE, async (ctx) => {
    const result = await withDb(ctx, async (): Promise<ActionResult<null>> => {
      const draft = await getDraft(ctx, id);
      if (!draft) return GONE;
      if (draft.status === "stale") return conflict("Approve is off until the update matches your notes. Write it again first.");
      if (draft.status === "flagged") return conflict("Fix the flagged part, or dismiss the warning if it's right.");
      if (draft.status !== "ready") return conflict("This update can't be approved now.");
      await updateDraft(ctx, id, { status: "approved", approvedBy: ctx.memberId, approvedAt: new Date().toISOString() });
      await audit(ctx, "draft_approved", { table: "drafts", id });
      return { ok: true, data: null };
    });
    if (result.ok) refresh();
    return result;
  });
}

/** Undo on an approved draft: back to what the guard said. */
export async function unapproveDraft(id: string): Promise<ActionResult<null>> {
  return asMember("teacher", CHANGE, async (ctx) => {
    const result = await withDb(ctx, async (): Promise<ActionResult<null>> => {
      const draft = await getDraft(ctx, id);
      if (draft?.status !== "approved") return GONE;
      await updateDraft(ctx, id, { status: guardStatus(draft), approvedBy: null, approvedAt: null });
      return { ok: true, data: null };
    });
    if (result.ok) refresh();
    return result;
  });
}

/** The tutor has read what the guard flagged and accepts it as written: the draft is ready to approve, recorded as an override. */
export async function dismissFlag(id: string): Promise<ActionResult<null>> {
  return asMember("teacher", CHANGE, async (ctx) => {
    const result = await withDb(ctx, async (): Promise<ActionResult<null>> => {
      const draft = await getDraft(ctx, id);
      if (draft?.status !== "flagged") return GONE;
      await updateDraft(ctx, id, { status: "ready", override: true });
      await audit(ctx, "guard_override", { table: "drafts", id });
      return { ok: true, data: null };
    });
    if (result.ok) refresh();
    return result;
  });
}

/** Undo on a dismissed flag. */
export async function restoreFlag(id: string): Promise<ActionResult<null>> {
  return asMember("teacher", CHANGE, async (ctx) => {
    const result = await withDb(ctx, async (): Promise<ActionResult<null>> => {
      const draft = await getDraft(ctx, id);
      if (draft?.status !== "ready" || !draft.override) return GONE;
      await updateDraft(ctx, id, { status: "flagged", override: false });
      return { ok: true, data: null };
    });
    if (result.ok) refresh();
    return result;
  });
}

/** S12: the tutor says it went out on WhatsApp ("Did you send it?" → Yes). */
export async function markSent(id: string): Promise<ActionResult<null>> {
  return asMember("teacher", CHANGE, async (ctx) => {
    const result = await withDb(ctx, async (): Promise<ActionResult<null>> => {
      const draft = await getDraft(ctx, id);
      if (!draft) return GONE;
      if (draft.status === "sent") return { ok: true, data: null };
      if (draft.status !== "approved") return conflict("Approve the update before marking it sent.");
      await updateDraft(ctx, id, { status: "sent", sentBy: ctx.memberId, sentAt: new Date().toISOString() });
      await audit(ctx, "draft_sent", { table: "drafts", id });
      return { ok: true, data: null };
    });
    if (result.ok) refresh();
    return result;
  });
}

/** No message for this student this week. A student with no draft gets an empty skipped one. */
export async function skipStudent(cycleId: string, studentId: string): Promise<ActionResult<null>> {
  return asMember("teacher", CHANGE, async (ctx) => {
    const result = await withDb(ctx, async (): Promise<ActionResult<null>> => {
      const [live, student] = await Promise.all([getLiveDraft(ctx, cycleId, studentId), getStudent(ctx, studentId)]);
      if (!student) return GONE;
      if (live?.status === "sent") return conflict("This update has already been sent.");
      if (live) await updateDraft(ctx, live.id, { status: "skipped", approvedBy: null, approvedAt: null });
      else await insertDraft(ctx, { cycleId, studentId, language: student.parentLanguage, status: "skipped", createdBy: ctx.memberId });
      return { ok: true, data: null };
    });
    if (result.ok) refresh();
    return result;
  });
}

export async function unskipStudent(cycleId: string, studentId: string): Promise<ActionResult<null>> {
  return asMember("teacher", CHANGE, async (ctx) => {
    const result = await withDb(ctx, async (): Promise<ActionResult<null>> => {
      const live = await getLiveDraft(ctx, cycleId, studentId);
      if (live?.status !== "skipped") return GONE;
      if (!live.bodyModel && !live.bodyFinal) await deleteDraft(ctx, live.id);
      else await updateDraft(ctx, live.id, { status: guardStatus(live) });
      return { ok: true, data: null };
    });
    if (result.ok) refresh();
    return result;
  });
}

/** E9: the week ends once every active student is sent or skipped (Complete week early is cut for the MVP). */
export async function completeCycle(id: string): Promise<ActionResult<null>> {
  const result = await asMember("teacher", CHANGE, async (ctx) =>
    withDb(ctx, async (): Promise<ActionResult<null>> => {
      const cycle = await getCycle(ctx, id);
      if (!cycle) return GONE;
      if (cycle.status === "completed") return { ok: true, data: null };
      const [students, drafts] = await Promise.all([listStudents(ctx), listLiveDrafts(ctx, id)]);
      const left = students.filter((s) => !["sent", "skipped"].includes(drafts.get(s.id)?.status ?? ""));
      if (left.length) return conflict(`${left.map((s) => s.messageName).join(", ")} still ${left.length === 1 ? "needs" : "need"} sending or skipping.`);
      await setCycleStatus(ctx, id, "completed");
      return { ok: true, data: null };
    }),
  );
  if (result.ok) redirect(`/cycles/${id}/done`);
  return result;
}
