import { describe, expect, it } from "vitest";
import type { Ctx } from "@/lib/auth/types";
import { WorkspaceSettings } from "@/lib/schemas/settings";
import { StudentInput } from "@/lib/schemas/student";
import { withDb } from "../client";
import { cycles } from "../schema";
import { insertAssessments, listStudentAssessments } from "./assessments";
import { getCycle, getOpenCycle, openCycleFor, setCycleStatus } from "./cycles";
import { getDraft, getLiveDraft, insertDraft, listLiveDrafts, listStudentDrafts } from "./drafts";
import { insertEntries, listCycleEntries } from "./entries";
import { getLocalOwner, getOwnerName } from "./members";
import { createNote, getNote, listNotesByStatus } from "./notes";
import { findSessionByTokenHash, insertSession, revokeAllSessions } from "./sessions";
import {
  archiveStudent,
  countActiveStudents,
  createStudent,
  deleteStudent,
  getStudent,
  historyWeeks,
  listStudents,
  restoreStudent,
  studentsSharingPhone,
  updateStudent,
} from "./students";
import { createWorkspaceWithOwner, getWorkspace, hasWorkspace } from "./workspaces";

async function newWorkspace(name: string): Promise<Ctx> {
  const settings = WorkspaceSettings.parse({ name, defaultLanguage: "en", tone: "warm", reportDay: 0 });
  const userId = crypto.randomUUID();
  const ids = await createWorkspaceWithOwner(settings, { userId, displayName: `${name} owner`, signature: "Ma'am" });
  return { ...ids, userId, role: "owner" };
}

const riya = (phone = "98000 00001") =>
  StudentInput.parse({ fullName: "Riya Sen", messageName: "Riya", classGrade: "7", parentPhone: phone, parentLanguage: "bn", nicknames: ["Riyu", "Riyu", " "] });

const entryPayload = {
  name_as_written: "Riya",
  source_span: "Riya ch5 test 14/20",
  topics: ["ch5"],
  assessments: [{ label: "ch5 test", scored: 14, max: 20, raw: "14/20" }],
  homework: { status: "unknown" as const, missed_count: null },
  attendance: "unknown" as const,
  strengths: [],
  concerns: [],
  fee_mentioned: false,
  remarks: null,
};

describe("workspace isolation", () => {
  it("never shows, changes or deletes another workspace's student", async () => {
    const a = await newWorkspace("A");
    const b = await newWorkspace("B");
    const student = await createStudent(a, riya());

    expect(await listStudents(b)).toEqual([]);
    expect(await getStudent(b, student.id)).toBeNull();
    expect(await updateStudent(b, student.id, { ...riya(), fullName: "Hacked" })).toBeNull();
    expect(await archiveStudent(b, student.id)).toBeNull();
    expect(await deleteStudent(b, student.id)).toBe(false);

    const still = await getStudent(a, student.id);
    expect(still).toMatchObject({ fullName: "Riya Sen", status: "active", parentPhone: "919800000001", aliasesJson: ["Riyu"] });
  });

  it("keeps cycles, notes, entries and drafts apart", async () => {
    const a = await newWorkspace("A");
    const b = await newWorkspace("B");
    const cycle = await openCycleFor(a, "2026-10-15");
    const note = await createNote(a, { cycleId: cycle.id, source: "typed", classDate: "2026-10-15", rawText: "Riya ch5 test 14/20" });
    await insertEntries(a, [{ noteInputId: note.id, cycleId: cycle.id, nameAsWritten: "Riya", resolution: "unmatched", payloadJson: entryPayload }]);
    const student = await createStudent(a, riya());
    const draft = await insertDraft(a, { cycleId: cycle.id, studentId: student.id, language: "bn", status: "ready" });

    expect(await getOpenCycle(b)).toBeNull();
    expect(await getCycle(b, cycle.id)).toBeNull();
    expect(await getNote(b, note.id)).toBeNull();
    expect(await listNotesByStatus(b, ["captured"])).toEqual([]);
    expect(await listCycleEntries(b, cycle.id)).toEqual([]);
    expect(await getDraft(b, draft.id)).toBeNull();
    expect((await listLiveDrafts(b, cycle.id)).size).toBe(0);

    expect(await listNotesByStatus(a, ["captured"])).toHaveLength(1);
    expect(await listCycleEntries(a, cycle.id)).toHaveLength(1);
  });
});

describe("students", () => {
  it("archives with a date, out of every active list, and restores", async () => {
    const a = await newWorkspace("A");
    const s = await createStudent(a, riya());
    const sibling = await createStudent(a, { ...riya(), fullName: "Rohan Sen", messageName: "Rohan" });
    expect((await archiveStudent(a, s.id))?.archivedAt).toMatch(/^\d{4}-/);
    expect((await listStudents(a)).map((x) => x.id)).toEqual([sibling.id]);
    expect(await countActiveStudents(a)).toBe(1);
    expect(await studentsSharingPhone(a, "919800000001", sibling.id)).toEqual([]);
    expect(await listStudents(a, "archived")).toHaveLength(1);

    expect(await restoreStudent(a, s.id)).toMatchObject({ status: "active", archivedAt: null });
    expect(await countActiveStudents(a)).toBe(2);
    expect(await studentsSharingPhone(a, "919800000001", sibling.id)).toEqual([{ id: s.id, fullName: "Riya Sen" }]);
  });

  it("counts weeks of history from notes and updates, once per week", async () => {
    const a = await newWorkspace("A");
    const s = await createStudent(a, riya());
    const other = await createStudent(a, { ...riya(), fullName: "Arjun Das", messageName: "Arjun" });
    const first = await openCycleFor(a, "2026-10-08");
    const note = await createNote(a, { cycleId: first.id, source: "typed", classDate: "2026-10-08", rawText: "Riya ch5 test 14/20" });
    await insertEntries(a, [{ noteInputId: note.id, cycleId: first.id, nameAsWritten: "Riya", studentId: s.id, resolution: "exact", payloadJson: entryPayload }]);
    await insertDraft(a, { cycleId: first.id, studentId: s.id, language: "bn", status: "sent" });
    await setCycleStatus(a, first.id, "completed");
    const second = await openCycleFor(a, "2026-10-15");
    await insertDraft(a, { cycleId: second.id, studentId: s.id, language: "bn", status: "stale", bodyModel: "old" });
    await insertDraft(a, { cycleId: second.id, studentId: s.id, language: "bn", status: "ready", bodyModel: "new" });

    expect(await historyWeeks(a, [s.id, other.id])).toEqual(new Map([[s.id, 2], [other.id, 0]]));
    expect((await listStudentDrafts(a, s.id)).map(({ draft, cycle }) => [cycle.label, draft.bodyModel])).toEqual([
      ["12–18 Oct", "new"],
      ["5–11 Oct", ""],
    ]);
    expect(await historyWeeks(await newWorkspace("B"), [s.id])).toEqual(new Map([[s.id, 0]]));
  });

  it("finds siblings sharing a number, but not the student itself", async () => {
    const a = await newWorkspace("A");
    const first = await createStudent(a, riya());
    const sibling = await createStudent(a, { ...riya("+91 98000-00001"), fullName: "Rohan Sen", messageName: "Rohan" });
    expect(await studentsSharingPhone(a, "919800000001", sibling.id)).toEqual([{ id: first.id, fullName: "Riya Sen" }]);
  });

  it("deletes the student's entries, scores and drafts with them", async () => {
    const a = await newWorkspace("A");
    const s = await createStudent(a, riya());
    const cycle = await openCycleFor(a, "2026-10-15");
    const note = await createNote(a, { cycleId: cycle.id, source: "typed", classDate: "2026-10-15", rawText: "Riya ch5 test 14/20" });
    const [entry] = await insertEntries(a, [{ noteInputId: note.id, cycleId: cycle.id, nameAsWritten: "Riya", studentId: s.id, resolution: "exact", payloadJson: entryPayload }]);
    await insertAssessments(a, [{ studentId: s.id, cycleId: cycle.id, entryId: entry.id, label: "ch5 test", scored: 14, max: 20, takenOn: "2026-10-15" }]);
    await insertDraft(a, { cycleId: cycle.id, studentId: s.id, language: "bn", status: "ready" });

    expect(await deleteStudent(a, s.id)).toBe(true);
    expect(await listCycleEntries(a, cycle.id)).toEqual([]);
    expect(await listStudentAssessments(a, s.id)).toEqual([]);
    expect(await getLiveDraft(a, cycle.id, s.id)).toBeNull();
    expect(await getNote(a, note.id)).not.toBeNull();
  });
});

describe("cycles and drafts", () => {
  it("reuses the open cycle, and opens a new one once it's completed", async () => {
    const a = await newWorkspace("A");
    const first = await openCycleFor(a, "2026-10-15");
    expect(first).toMatchObject({ startsOn: "2026-10-12", endsOn: "2026-10-18", label: "12–18 Oct", status: "open" });
    expect((await openCycleFor(a, "2026-10-22")).id).toBe(first.id);

    await setCycleStatus(a, first.id, "completed");
    const next = await openCycleFor(a, "2026-10-22");
    expect(next).toMatchObject({ startsOn: "2026-10-19", status: "open" });
  });

  it("refuses a second open cycle at the database level", async () => {
    const a = await newWorkspace("A");
    await openCycleFor(a, "2026-10-15");
    await expect(
      withDb(a, (db) => db.insert(cycles).values({ workspaceId: a.workspaceId, label: "x", startsOn: "2026-10-19", endsOn: "2026-10-25" })),
    ).rejects.toThrow(/UNIQUE/);
  });

  it("numbers draft versions and treats the newest as live", async () => {
    const a = await newWorkspace("A");
    const s = await createStudent(a, riya());
    const cycle = await openCycleFor(a, "2026-10-15");
    await insertDraft(a, { cycleId: cycle.id, studentId: s.id, language: "bn", status: "stale", bodyModel: "old" });
    const second = await insertDraft(a, { cycleId: cycle.id, studentId: s.id, language: "bn", status: "ready", bodyModel: "new" });
    expect(second.version).toBe(2);
    expect((await getLiveDraft(a, cycle.id, s.id))?.bodyModel).toBe("new");
    expect((await listLiveDrafts(a, cycle.id)).get(s.id)?.version).toBe(2);
  });
});

describe("setup and sessions", () => {
  it("reports a workspace and finds the local owner", async () => {
    const a = await newWorkspace("Mita's Tuition");
    expect(await hasWorkspace()).toBe(true);
    expect((await getWorkspace(a))?.name).toBe("Mita's Tuition");
    expect((await getLocalOwner())?.role).toBe("owner");
    expect(await getOwnerName(a)).toBe("Mita's Tuition owner");
  });

  it("revokes every session in one workspace only", async () => {
    const a = await newWorkspace("A");
    const b = await newWorkspace("B");
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    await insertSession(a, { tokenHash: "hash-a", deviceLabel: "Phone", userAgent: null, expiresAt });
    await insertSession(b, { tokenHash: "hash-b", deviceLabel: "Phone", userAgent: null, expiresAt });

    expect(await revokeAllSessions(a.workspaceId)).toBe(1);
    expect((await findSessionByTokenHash("hash-a"))?.revokedAt).not.toBeNull();
    expect((await findSessionByTokenHash("hash-b"))?.revokedAt).toBeNull();
  });
});
