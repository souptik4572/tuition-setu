import { beforeEach, describe, expect, it, vi } from "vitest";
import { editNote, saveNote } from "@/app/capture/actions";
import { resolveEntry, setEntryScore, undoResolve } from "@/app/needs-you/actions";
import { AiError } from "@/lib/ai/errors";
import type { AIProvider, GenerateObjectOpts } from "@/lib/ai/provider";
import { createSession, SESSION_COOKIE } from "@/lib/auth/local/session";
import { withDb } from "@/lib/db/client";
import { listStudentAssessments } from "@/lib/db/queries/assessments";
import { listNoteEntries } from "@/lib/db/queries/entries";
import { getNote } from "@/lib/db/queries/notes";
import { createStudent, getStudent } from "@/lib/db/queries/students";
import { createWorkspaceWithOwner } from "@/lib/db/queries/workspaces";
import { members } from "@/lib/db/schema";
import type { ExtractedEntry, ExtractionResult } from "@/lib/schemas/extraction";
import { WorkspaceSettings } from "@/lib/schemas/settings";
import { StudentInput } from "@/lib/schemas/student";
import { loadNeedsYou } from "./needs-you";
import { whenIdle } from "./queue";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (fn: () => void) => fn() }));

// The model's reply for the next call: a reading, or an error to throw.
let reply: (opts: GenerateObjectOpts<unknown>) => ExtractionResult | Error;
const provider: AIProvider = {
  name: "ollama",
  async generateObject<T>(opts: GenerateObjectOpts<T>) {
    const r = reply(opts as GenerateObjectOpts<unknown>);
    if (r instanceof Error) throw r;
    return { object: r as T, usage: { durationMs: 1 } };
  },
  streamText: () => {
    throw new Error("not used");
  },
};
vi.mock("@/lib/ai", async (original) => ({ ...(await original<typeof import("@/lib/ai")>()), getProvider: () => provider }));

const entry = (name: string, span: string, over: Partial<ExtractedEntry> = {}): ExtractedEntry => ({
  name_as_written: name,
  source_span: span,
  topics: [],
  assessments: [],
  homework: { status: "unknown", missed_count: null },
  attendance: "unknown",
  strengths: [],
  concerns: [],
  fee_mentioned: false,
  remarks: null,
  ...over,
});
const score = (label: string, scored: number, max: number | null) => ({ label, scored, max, raw: max === null ? `${scored}` : `${scored}/${max}` });

async function workspace(role: "owner" | "assistant" = "owner") {
  const settings = WorkspaceSettings.parse({ name: "Notes", defaultLanguage: "en", tone: "warm", reportDay: 0 });
  const owner = await createWorkspaceWithOwner(settings, { userId: crypto.randomUUID(), displayName: "Mita Sarkar", signature: "Mita Ma'am" });
  const ctx = { ...owner, system: true as const };
  const add = (fullName: string, phone: string) =>
    createStudent(ctx, StudentInput.parse({ fullName, messageName: fullName.split(" ")[0], classGrade: "7", parentPhone: phone, parentLanguage: "en" }));
  const [riya, arjun, tanmoy, payel] = [await add("Riya Sen", "9800000001"), await add("Arjun Das", "9800000002"), await add("Tanmoy Ghosh", "9800000003"), await add("Payel Dutta", "9800000004")];
  let memberId = owner.memberId;
  if (role === "assistant") {
    const [row] = await withDb(ctx, (db) => db.insert(members).values({ workspaceId: owner.workspaceId, userId: crypto.randomUUID(), displayName: "Asha", signature: "Asha", role }).returning());
    memberId = row.id;
  }
  jar.set(SESSION_COOKIE, await createSession({ workspaceId: owner.workspaceId, memberId }, { label: "Phone", userAgent: null }));
  return { ctx, riya, arjun, tanmoy, payel };
}

async function save(text: string, reading: ExtractionResult | Error) {
  reply = () => reading;
  const saved = await saveNote({ text, classDate: "2026-10-15" });
  if (!saved.ok) throw new Error(saved.error.message);
  await whenIdle();
  return saved.data.noteId;
}

beforeEach(() => jar.clear());

describe("reading a typed note", () => {
  it("confirms three clear students and writes their scores", async () => {
    const { ctx, riya, arjun, tanmoy } = await workspace();
    const noteId = await save("Riya ch5 test 14/20 careless in algebra; Arjun absent; Tanmoy improving in fractions, quiz 17/25", {
      entries: [
        entry("Riya", "Riya ch5 test 14/20 careless in algebra", { assessments: [score("ch5 test", 14, 20)], concerns: ["careless in algebra"] }),
        entry("Arjun", "Arjun absent", { attendance: "absent" }),
        entry("Tanmoy", "Tanmoy improving in fractions, quiz 17/25", { assessments: [score("quiz", 17, 25)] }),
      ],
      unattributed: [],
    });

    expect(await getNote(ctx, noteId)).toMatchObject({ status: "processed", errorCode: null, cycleId: expect.any(String) });
    const entries = await listNoteEntries(ctx, noteId);
    expect(entries.map((e) => [e.studentId, e.resolution, !!e.confirmedAt])).toEqual([
      [riya.id, "exact", true],
      [arjun.id, "exact", true],
      [tanmoy.id, "exact", true],
    ]);
    expect(await listStudentAssessments(ctx, riya.id)).toMatchObject([{ label: "ch5 test", scored: 14, max: 20, takenOn: "2026-10-15" }]);
    expect((await loadNeedsYou(ctx)).items).toEqual([]);
  });

  it("asks for a missing total, then confirms the score once it's given", async () => {
    const { ctx, riya } = await workspace();
    await save("Riya 14", { entries: [entry("Riya", "Riya 14", { assessments: [score("test", 14, null)] })], unattributed: [] });
    const [item] = (await loadNeedsYou(ctx)).items;
    expect(item).toMatchObject({ type: "missing_total", title: "Riya 14 — out of how many?", score: { index: 0, scored: 14, max: null } });
    expect(await listStudentAssessments(ctx, riya.id)).toEqual([]);

    expect(await setEntryScore(item.id, 0, { scored: 14, max: 10 })).toMatchObject({ ok: false, error: { code: "invalid" } });
    expect(await setEntryScore(item.id, 0, { scored: 14, max: 20 })).toEqual({ ok: true, data: null });
    expect(await listStudentAssessments(ctx, riya.id)).toMatchObject([{ scored: 14, max: 20 }]);
    expect((await loadNeedsYou(ctx)).items).toEqual([]);
  });

  it("adds a new student from the note, which only owners and teachers may do", async () => {
    const reading = { entries: [entry("Sohini", "Sohini 16/20 good in geometry", { assessments: [score("test", 16, 20)] })], unattributed: [] };
    const assistant = await workspace("assistant");
    await save("Sohini 16/20 good in geometry", reading);
    const [asked] = (await loadNeedsYou(assistant.ctx)).items;
    expect(asked).toMatchObject({ type: "unmatched_name", title: "Who is ‘Sohini’?", candidates: [] });
    const newStudent = { fullName: "Sohini Pal", classGrade: "7", parentPhone: "98000 00011", parentLanguage: "bn" as const };
    expect(await resolveEntry(asked.id, { newStudent })).toMatchObject({ ok: false, error: { code: "forbidden" } });

    const { ctx } = await workspace();
    await save("Sohini 16/20 good in geometry", reading);
    const [item] = (await loadNeedsYou(ctx)).items;
    const added = await resolveEntry(item.id, { newStudent });
    expect(added).toMatchObject({ ok: true, data: { name: "Sohini" } });
    const sohini = await getStudent(ctx, (added as { data: { studentId: string } }).data.studentId);
    expect(sohini).toMatchObject({ fullName: "Sohini Pal", messageName: "Sohini", parentPhone: "919800000011" });
    expect(await listStudentAssessments(ctx, sohini!.id)).toMatchObject([{ scored: 16, max: 20 }]);
  });

  it("assigns an unknown spelling, remembers it, and matches it next time on its own", async () => {
    const { ctx, riya } = await workspace();
    await save("Rimi 9/10", { entries: [entry("Rimi", "Rimi 9/10", { assessments: [score("quiz", 9, 10)] })], unattributed: [] });
    const [item] = (await loadNeedsYou(ctx)).items;
    expect(item).toMatchObject({ type: "unmatched_name", hint: "Maybe Riya Sen", candidates: [{ id: riya.id }] });
    expect(await resolveEntry(item.id, { studentId: riya.id, rememberAlias: true })).toMatchObject({ ok: true });
    expect((await getStudent(ctx, riya.id))?.aliasesJson).toEqual(["Rimi"]);

    const next = await save("Rimi 7/10", { entries: [entry("Rimi", "Rimi 7/10", { assessments: [score("quiz", 7, 10)] })], unattributed: [] });
    expect((await listNoteEntries(ctx, next))[0]).toMatchObject({ studentId: riya.id, resolution: "alias" });
  });

  it("ignores a line, and Undo puts it back", async () => {
    const { ctx } = await workspace();
    await save("whole batch slow in fractions", { entries: [], unattributed: ["whole batch slow in fractions"] });
    const [item] = (await loadNeedsYou(ctx)).items;
    expect(item).toMatchObject({ type: "unattributed", title: "Couldn't tell who this is about" });
    await resolveEntry(item.id, { ignore: true });
    expect((await loadNeedsYou(ctx)).items).toEqual([]);
    await undoResolve(item.id);
    expect((await loadNeedsYou(ctx)).items).toMatchObject([{ id: item.id, type: "unattributed" }]);
  });

  it("auto-matches a close spelling under Matched for you, and Undo asks instead", async () => {
    const { ctx, payel } = await workspace();
    await save("Payal ratio quiz 6/10", { entries: [entry("Payal", "Payal ratio quiz 6/10", { assessments: [score("ratio quiz", 6, 10)] })], unattributed: [] });
    const inbox = await loadNeedsYou(ctx);
    expect(inbox.items).toEqual([]);
    expect(inbox.matched).toMatchObject([{ asWritten: "Payal", studentName: "Payel Dutta" }]);
    expect(await listStudentAssessments(ctx, payel.id)).toHaveLength(1);

    await undoResolve(inbox.matched[0].entryId);
    const after = await loadNeedsYou(ctx);
    expect(after.matched).toEqual([]);
    expect(after.items).toMatchObject([{ type: "unmatched_name", title: "Who is ‘Payal’?", candidates: [{ id: payel.id }] }]);
    expect(await listStudentAssessments(ctx, payel.id)).toEqual([]);
  });

  it("keeps a note that took too long, with its text, and lists it in Needs you", async () => {
    const { ctx } = await workspace();
    const noteId = await save("Kabir ch4 test 12/15", new AiError("timeout"));
    expect(await getNote(ctx, noteId)).toMatchObject({ status: "failed", errorCode: "timeout", rawText: "Kabir ch4 test 12/15" });
    expect((await loadNeedsYou(ctx)).items).toMatchObject([{ type: "failed_note", title: "1 note couldn't be read", href: `/capture/${noteId}` }]);
  });

  it("fails a note the model can't answer in JSON twice, then reads it after an edit", async () => {
    const { ctx, riya } = await workspace();
    let calls = 0;
    reply = () => (calls++, new AiError("invalid_json"));
    const saved = await saveNote({ text: "rs 14 ak 12", classDate: "2026-10-15" });
    await whenIdle();
    const noteId = saved.ok ? saved.data.noteId : "";
    expect(calls).toBe(2);
    expect(await getNote(ctx, noteId)).toMatchObject({ status: "failed", errorCode: "invalid_json" });

    reply = () => ({ entries: [entry("Riya", "Riya 14/20", { assessments: [score("test", 14, 20)] })], unattributed: [] });
    expect(await editNote(noteId, "Riya 14/20")).toEqual({ ok: true, data: null });
    await whenIdle();
    expect(await getNote(ctx, noteId)).toMatchObject({ status: "processed", rawText: "Riya 14/20" });
    expect(await listStudentAssessments(ctx, riya.id)).toMatchObject([{ scored: 14, max: 20 }]);
  });

  it("gives the model the roster, with nicknames, for spelling", async () => {
    const { ctx, riya } = await workspace();
    let system = "";
    reply = (opts) => ((system = opts.system), { entries: [], unattributed: [] });
    await createStudent(ctx, StudentInput.parse({ fullName: "Kabir Mehta", messageName: "Kabir", classGrade: "8", parentPhone: "9800000009", parentLanguage: "hi", nicknames: ["Kabi"] }));
    await saveNote({ text: "Kabi good", classDate: "2026-10-15" });
    await whenIdle();
    expect(system).toContain("- Kabir Mehta (nicknames: Kabi)");
    expect(system).toContain(`- ${riya.fullName}`);
  });
});
