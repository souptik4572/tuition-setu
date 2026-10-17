import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/drafts/generate/route";
import { AiError } from "@/lib/ai/errors";
import type { AIProvider, StreamTextOpts } from "@/lib/ai/provider";
import { createSession, SESSION_COOKIE } from "@/lib/auth/local/session";
import { withDb } from "@/lib/db/client";
import { getCycle, openCycleFor } from "@/lib/db/queries/cycles";
import { getDraft, getLiveDraft } from "@/lib/db/queries/drafts";
import { insertEntries } from "@/lib/db/queries/entries";
import { createNote } from "@/lib/db/queries/notes";
import { createStudent } from "@/lib/db/queries/students";
import { createWorkspaceWithOwner } from "@/lib/db/queries/workspaces";
import { auditEvents } from "@/lib/db/schema";
import { autoConfirm } from "@/lib/pipeline/confirm";
import type { ExtractedEntry } from "@/lib/schemas/extraction";
import { WorkspaceSettings } from "@/lib/schemas/settings";
import { StudentInput } from "@/lib/schemas/student";
import { approveDraft, dismissFlag, editDraft, markSent, restoreFlag, skipStudent, unapproveDraft, unskipStudent } from "./actions";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

// What the model writes next: chunks of text, then optionally an error.
let script: { chunks: string[]; fail?: AiError };
let lastPrompt: StreamTextOpts | undefined;
const provider: AIProvider = {
  name: "ollama",
  generateObject: () => Promise.reject(new Error("not used")),
  streamText(opts) {
    lastPrompt = opts;
    const { chunks, fail } = script;
    const stream = new ReadableStream<string>({
      async pull(out) {
        const next = chunks.shift();
        if (next !== undefined) return out.enqueue(next);
        if (fail) return out.error(fail);
        out.close();
      },
    });
    const usage = fail ? Promise.reject(fail) : Promise.resolve({ durationMs: 5, promptTokens: 10, completionTokens: 20 });
    usage.catch(() => undefined); // as the real providers do: the stream reports the error
    return { stream, usage };
  },
};
vi.mock("@/lib/ai", async (original) => ({ ...(await original<typeof import("@/lib/ai")>()), getProvider: () => provider }));

const BODY =
  "This week Riya worked on Chapter 5, linear equations. She scored 14/20 (70%) in Thursday's test, which shows steady effort. She is quick with word problems. Small sign errors in algebra still cost her marks; asking her to re-check each step aloud at home would help. A fixed homework time this week would be great.";

const payload = (span: string, scored: number, max: number): ExtractedEntry => ({
  name_as_written: "Riya",
  source_span: span,
  topics: ["chapter 5", "linear equations"],
  assessments: [{ label: "ch5 test", scored, max, raw: `${scored}/${max}` }],
  homework: { status: "unknown", missed_count: null },
  attendance: "unknown",
  strengths: ["quick with word problems"],
  concerns: ["sign errors in algebra"],
  fee_mentioned: false,
  remarks: null,
});

async function week() {
  const settings = WorkspaceSettings.parse({ name: "Drafts", defaultLanguage: "en", tone: "warm", reportDay: 0 });
  const owner = await createWorkspaceWithOwner(settings, { userId: crypto.randomUUID(), displayName: "Mita Sarkar", signature: "Mita Ma'am" });
  const ctx = { ...owner, system: true as const };
  const riya = await createStudent(ctx, StudentInput.parse({ fullName: "Riya Sen", messageName: "Riya", classGrade: "7", parentName: "Mrs Sen", parentPhone: "9800000001", parentLanguage: "en" }));
  await createStudent(ctx, StudentInput.parse({ fullName: "Arjun Das", messageName: "Arjun", classGrade: "7", parentPhone: "9800000002", parentLanguage: "en" }));
  const cycle = await openCycleFor(ctx, "2026-10-15");
  const addNote = async (span: string, scored: number, max: number) => {
    const note = await createNote(ctx, { cycleId: cycle.id, source: "typed", classDate: "2026-10-15", rawText: span, status: "processed" });
    const [entry] = await insertEntries(ctx, [{ noteInputId: note.id, cycleId: cycle.id, nameAsWritten: "Riya", studentId: riya.id, resolution: "exact", payloadJson: payload(span, scored, max) }]);
    await autoConfirm(ctx, entry.id);
  };
  await addNote("Riya ch5 test 14/20", 14, 20);
  jar.set(SESSION_COOKIE, await createSession({ workspaceId: owner.workspaceId, memberId: owner.memberId }, { label: "Laptop", userAgent: null }));
  return { ctx, riya, cycle, addNote };
}

async function generate(cycleId: string, studentId: string) {
  const res = await POST(new Request("http://localhost/api/drafts/generate", { method: "POST", body: JSON.stringify({ cycleId, studentId }) }));
  const lines = (await res.text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { res, lines, done: lines.find((l) => l.type === "done"), error: lines.find((l) => l.type === "error") };
}

beforeEach(() => jar.clear());

describe("writing an update", () => {
  it("streams the body, then stores a checked draft with the assembled message", async () => {
    const { ctx, riya, cycle } = await week();
    script = { chunks: [BODY.slice(0, 40), BODY.slice(40)] };
    const { res, lines, done } = await generate(cycle.id, riya.id);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    expect(lines.filter((l) => l.type === "token").map((l) => l.text).join("")).toBe(BODY);
    expect(done.draft).toMatchObject({ version: 1, status: "ready", guard: { status: "pass" } });
    expect(done.draft.message).toBe(`*Weekly update — Riya (12–18 Oct)*\nHello Mrs Sen,\n\n${BODY}\n\n— Mita Ma'am`);

    const stored = await getDraft(ctx, done.draft.id);
    expect(stored).toMatchObject({ bodyModel: BODY, language: "en", status: "ready", promptVersion: "v2", factsJson: { assessments: [{ scored: 14, max: 20, pct: 70 }] } });
    expect((await getCycle(ctx, cycle.id))?.status).toBe("reviewing");
    expect(lastPrompt).toMatchObject({ task: "draft", temperature: 0.4 });
    expect(lastPrompt!.prompt).toContain('"scored": 14');
  });

  it("flags a number the model made up, at its place in the body", async () => {
    const { riya, cycle } = await week();
    script = { chunks: [BODY.replace("14/20", "18/20")] };
    const { done } = await generate(cycle.id, riya.id);
    expect(done.draft).toMatchObject({ status: "flagged", guard: { issues: [{ rule: "G1", message: "18/20 — Not in your notes · Your note says 14/20" }] } });
  });

  it("stores nothing when the engine times out, and says the note is safe", async () => {
    const { ctx, riya, cycle } = await week();
    script = { chunks: ["This week Riya"], fail: new AiError("timeout") };
    const { done, error } = await generate(cycle.id, riya.id);
    expect(done).toBeUndefined();
    expect(error).toMatchObject({ code: "timeout", message: "The AI engine took too long. Your note is safe and nothing was sent." });
    expect(await getLiveDraft(ctx, cycle.id, riya.id)).toBeNull();
  });

  it("stores nothing when the reader stops", async () => {
    const { ctx, riya, cycle } = await week();
    script = { chunks: ["This week ", "Riya ", "worked"] };
    const res = await POST(new Request("http://localhost/api/drafts/generate", { method: "POST", body: JSON.stringify({ cycleId: cycle.id, studentId: riya.id }) }));
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    await new Promise((r) => setTimeout(r, 20));
    expect(await getLiveDraft(ctx, cycle.id, riya.id)).toBeNull();
  });

  it("won't write for a student with no notes this week", async () => {
    const { ctx, cycle } = await week();
    const kabir = await createStudent(ctx, StudentInput.parse({ fullName: "Kabir Mehta", messageName: "Kabir", classGrade: "8", parentPhone: "9800000003", parentLanguage: "hi" }));
    expect((await generate(cycle.id, kabir.id)).res.status).toBe(409);
  });
});

describe("out of date, approve and send", () => {
  it("marks a ready or approved draft out of date when a new note is confirmed, removing the approval", async () => {
    const { ctx, riya, cycle, addNote } = await week();
    script = { chunks: [BODY] };
    const { done } = await generate(cycle.id, riya.id);
    expect(await approveDraft(done.draft.id)).toEqual({ ok: true, data: null });

    await addNote("Riya ch5 retest 15/20", 15, 20);
    expect(await getDraft(ctx, done.draft.id)).toMatchObject({ status: "stale", approvedBy: null, approvedAt: null });
    const events = await withDb(ctx, (db) => db.select().from(auditEvents).where(eq(auditEvents.workspaceId, ctx.workspaceId)));
    expect(events.map((e) => e.action)).toEqual(["draft_approved", "approval_removed"]);
    expect(await approveDraft(done.draft.id)).toMatchObject({ ok: false, error: { code: "conflict" } });
  });

  it("checks an edited out-of-date draft against the current facts", async () => {
    const { ctx, riya, cycle, addNote } = await week();
    script = { chunks: [BODY] };
    const { done } = await generate(cycle.id, riya.id);
    await addNote("Riya ch5 retest 15/20", 15, 20);
    expect(await editDraft(done.draft.id, BODY.replace("14/20 (70%)", "15/20 (75%)"))).toEqual({ ok: true, data: { status: "ready" } });
    expect(await getDraft(ctx, done.draft.id)).toMatchObject({ bodyFinal: BODY.replace("14/20 (70%)", "15/20 (75%)"), status: "ready" });
  });

  it("won't approve a flagged draft until its warning is dismissed, then marks it sent; a sent draft never goes out of date", async () => {
    const { ctx, riya, cycle, addNote } = await week();
    script = { chunks: [BODY.replace("14/20", "18/20")] };
    const { done } = await generate(cycle.id, riya.id);
    expect(await markSent(done.draft.id)).toMatchObject({ ok: false });
    expect(await approveDraft(done.draft.id)).toMatchObject({ ok: false, error: { code: "conflict" } });
    await dismissFlag(done.draft.id);
    expect(await approveDraft(done.draft.id)).toEqual({ ok: true, data: null });
    expect(await getDraft(ctx, done.draft.id)).toMatchObject({ status: "approved", override: true });
    expect(await markSent(done.draft.id)).toEqual({ ok: true, data: null });

    await addNote("Riya ch5 retest 15/20", 15, 20);
    expect(await getDraft(ctx, done.draft.id)).toMatchObject({ status: "sent", sentAt: expect.any(String) });
  });

  it("dismisses a flag so the draft can be approved as written; Undo and editing bring the check back", async () => {
    const { ctx, riya, cycle } = await week();
    script = { chunks: [BODY.replace("14/20", "18/20")] };
    const { done } = await generate(cycle.id, riya.id);
    const id = done.draft.id;
    expect(await restoreFlag(id)).toMatchObject({ ok: false });

    expect(await dismissFlag(id)).toEqual({ ok: true, data: null });
    expect(await getDraft(ctx, id)).toMatchObject({ status: "ready", override: true });
    expect(await restoreFlag(id)).toEqual({ ok: true, data: null });
    expect(await getDraft(ctx, id)).toMatchObject({ status: "flagged", override: false });

    await dismissFlag(id);
    expect(await approveDraft(id)).toEqual({ ok: true, data: null });
    expect(await getDraft(ctx, id)).toMatchObject({ status: "approved", override: true });
    await unapproveDraft(id);
    expect(await getDraft(ctx, id)).toMatchObject({ status: "ready", override: true });
    const events = await withDb(ctx, (db) => db.select().from(auditEvents).where(eq(auditEvents.workspaceId, ctx.workspaceId)));
    expect(events.map((e) => e.action)).toEqual(["guard_override", "guard_override", "draft_approved"]);

    expect(await editDraft(id, BODY.replace("14/20", "19/20"))).toEqual({ ok: true, data: { status: "flagged" } });
    expect(await getDraft(ctx, id)).toMatchObject({ status: "flagged", override: false });
    expect(await dismissFlag(id)).toEqual({ ok: true, data: null });
  });

  it("skips a student without a draft, and Undo removes the placeholder", async () => {
    const { ctx, cycle } = await week();
    const kabir = await createStudent(ctx, StudentInput.parse({ fullName: "Kabir Mehta", messageName: "Kabir", classGrade: "8", parentPhone: "9800000003", parentLanguage: "hi" }));
    expect(await skipStudent(cycle.id, kabir.id)).toEqual({ ok: true, data: null });
    expect(await getLiveDraft(ctx, cycle.id, kabir.id)).toMatchObject({ status: "skipped", bodyModel: "" });
    expect(await unskipStudent(cycle.id, kabir.id)).toEqual({ ok: true, data: null });
    expect(await getLiveDraft(ctx, cycle.id, kabir.id)).toBeNull();
  });
});
