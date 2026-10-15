import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, SESSION_COOKIE } from "@/lib/auth/local/session";
import type { Role } from "@/lib/auth/types";
import { withDb } from "@/lib/db/client";
import { getStudent, listStudents } from "@/lib/db/queries/students";
import { createWorkspaceWithOwner } from "@/lib/db/queries/workspaces";
import { auditEvents, members } from "@/lib/db/schema";
import { WorkspaceSettings } from "@/lib/schemas/settings";
import { archiveStudent, createStudent, deleteStudent, restoreStudent, updateStudent } from "./actions";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));

async function signedIn(role: Role) {
  const settings = WorkspaceSettings.parse({ name: "Students", defaultLanguage: "en", tone: "warm", reportDay: 0 });
  const owner = await createWorkspaceWithOwner(settings, { userId: crypto.randomUUID(), displayName: "Mita", signature: "Mita Ma'am" });
  const ctx = { ...owner, system: true as const };
  let memberId = owner.memberId;
  if (role !== "owner") {
    const [row] = await withDb(ctx, (db) =>
      db.insert(members).values({ workspaceId: owner.workspaceId, userId: crypto.randomUUID(), displayName: "Asha", signature: "Asha", role }).returning(),
    );
    memberId = row.id;
  }
  jar.set(SESSION_COOKIE, await createSession({ workspaceId: owner.workspaceId, memberId }, { label: "Phone", userAgent: null }));
  return { ...ctx, memberId };
}

const riya = { fullName: "Riya Sen", messageName: "Riya", classGrade: "7", parentPhone: "098000-00001", parentLanguage: "bn" as const };

beforeEach(() => jar.clear());

describe("student actions", () => {
  it("let a teacher add, edit, archive and restore", async () => {
    const ctx = await signedIn("teacher");
    const created = await createStudent(riya);
    if (!created.ok) throw new Error(created.error.message);
    expect(await getStudent(ctx, created.data.id)).toMatchObject({ parentPhone: "919800000001" });

    expect(await updateStudent(created.data.id, { ...riya, classGrade: "8" })).toMatchObject({ ok: true });
    expect(await archiveStudent(created.data.id)).toMatchObject({ ok: true });
    expect(await listStudents(ctx)).toEqual([]);
    expect(await restoreStudent(created.data.id)).toMatchObject({ ok: true });
    expect(await listStudents(ctx)).toMatchObject([{ classGrade: "8", status: "active" }]);
  });

  it("refuse an assistant and say who can", async () => {
    await signedIn("assistant");
    expect(await createStudent(riya)).toEqual({ ok: false, error: { code: "forbidden", message: "Only owners and teachers can change a student's details." } });
  });

  it("refuse a signed-out visitor", async () => {
    await signedIn("owner");
    jar.clear();
    expect(await createStudent(riya)).toMatchObject({ ok: false, error: { code: "unauthenticated" } });
  });

  it("check the input on the server too", async () => {
    await signedIn("owner");
    expect(await createStudent({ ...riya, parentPhone: "98000 0001" })).toMatchObject({ ok: false, error: { code: "invalid" } });
  });

  it("let only the owner delete, and audit the id without the name", async () => {
    const teacher = await signedIn("teacher");
    const created = await createStudent(riya);
    if (!created.ok) throw new Error(created.error.message);
    expect(await deleteStudent(created.data.id)).toMatchObject({ ok: false, error: { code: "forbidden" } });

    const ownerId = (await withDb(teacher, (db) => db.select().from(members).where(and(eq(members.workspaceId, teacher.workspaceId), eq(members.role, "owner")))))[0].id;
    jar.set(SESSION_COOKIE, await createSession({ workspaceId: teacher.workspaceId, memberId: ownerId }, { label: "Phone", userAgent: null }));
    await expect(deleteStudent(created.data.id)).rejects.toThrow("redirect /students");
    expect(await getStudent(teacher, created.data.id)).toBeNull();

    const events = await withDb(teacher, (db) => db.select().from(auditEvents).where(eq(auditEvents.workspaceId, teacher.workspaceId)));
    expect(events).toMatchObject([{ action: "student_deleted", targetTable: "students", targetId: created.data.id, actorMemberId: ownerId, metaJson: null }]);
    expect(await deleteStudent(created.data.id)).toMatchObject({ ok: false, error: { code: "not_found" } });
  });
});
