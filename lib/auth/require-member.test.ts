import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withDb } from "@/lib/db/client";
import { revokeAllSessions } from "@/lib/db/queries/sessions";
import { createWorkspaceWithOwner } from "@/lib/db/queries/workspaces";
import { members } from "@/lib/db/schema";
import { WorkspaceSettings } from "@/lib/schemas/settings";
import { createSession, SESSION_COOKIE } from "./local/session";
import { requireMember } from "./require-member";
import { AuthError } from "./types";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));

async function signedIn(role: "owner" | "assistant" = "owner") {
  const settings = WorkspaceSettings.parse({ name: "Auth", defaultLanguage: "en", tone: "warm", reportDay: 0 });
  const owner = await createWorkspaceWithOwner(settings, { userId: crypto.randomUUID(), displayName: "Mita", signature: "Mita Ma'am" });
  let memberId = owner.memberId;
  if (role !== "owner") {
    const [row] = await withDb({ ...owner, system: true }, (db) =>
      db.insert(members).values({ workspaceId: owner.workspaceId, userId: crypto.randomUUID(), displayName: "Asha", signature: "Asha", role }).returning(),
    );
    memberId = row.id;
  }
  jar.set(SESSION_COOKIE, await createSession({ workspaceId: owner.workspaceId, memberId }, { label: "Phone", userAgent: null }));
  return { workspaceId: owner.workspaceId, memberId };
}

const rejection = (minRole?: "owner") =>
  requireMember(minRole).then(
    () => "allowed",
    (e: unknown) => (e instanceof AuthError ? e.code : e),
  );

beforeEach(() => {
  jar.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("requireMember (local)", () => {
  it("returns the member's workspace and role from the session, not the request", async () => {
    const { workspaceId, memberId } = await signedIn();
    expect(await requireMember("owner")).toMatchObject({ workspaceId, memberId, role: "owner" });
  });

  it("rejects a missing cookie", async () => {
    expect(await rejection()).toBe("unauthenticated");
  });

  it("rejects a revoked session", async () => {
    const { workspaceId } = await signedIn();
    await revokeAllSessions(workspaceId);
    expect(await rejection()).toBe("unauthenticated");
  });

  it("rejects an expired session", async () => {
    await signedIn();
    vi.advanceTimersByTime(31 * 24 * 3_600_000);
    expect(await rejection()).toBe("unauthenticated");
  });

  it("rejects a removed member", async () => {
    const { workspaceId, memberId } = await signedIn();
    await withDb({ workspaceId, memberId, system: true }, (db) => db.update(members).set({ status: "removed" }).where(eq(members.id, memberId)));
    expect(await rejection()).toBe("unauthenticated");
  });

  it("refuses a role below the minimum", async () => {
    await signedIn("assistant");
    expect(await requireMember("assistant")).toMatchObject({ role: "assistant" });
    expect(await rejection("owner")).toBe("forbidden");
  });
});
