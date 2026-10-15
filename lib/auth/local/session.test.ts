import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceWithOwner } from "@/lib/db/queries/workspaces";
import { findSessionByTokenHash } from "@/lib/db/queries/sessions";
import { WorkspaceSettings } from "@/lib/schemas/settings";
import { createSession, validateSession } from "./session";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function owner() {
  const settings = WorkspaceSettings.parse({ name: "Sessions", defaultLanguage: "en", tone: "warm", reportDay: 0 });
  return createWorkspaceWithOwner(settings, { userId: crypto.randomUUID(), displayName: "Mita", signature: "Mita Ma'am" });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("local sessions", () => {
  it("stores only a hash of the token", async () => {
    const token = await createSession(await owner(), { label: "This laptop", userAgent: null });
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(await findSessionByTokenHash(token)).toBeNull();
    expect(await validateSession(token)).toMatchObject({ deviceLabel: "This laptop", revokedAt: null });
  });

  it("slides the 30-day expiry with use, at most once an hour", async () => {
    const token = await createSession(await owner(), { label: "Phone", userAgent: "Android" });
    const first = (await validateSession(token))!;
    expect(Date.parse(first.expiresAt)).toBe(Date.now() + 30 * DAY);

    vi.advanceTimersByTime(30 * 60_000);
    expect((await validateSession(token))!.expiresAt).toBe(first.expiresAt);

    vi.advanceTimersByTime(31 * 60_000);
    const slid = (await validateSession(token))!;
    expect(Date.parse(slid.expiresAt)).toBe(Date.now() + 30 * DAY);
    expect(slid.lastSeenAt).toBe(new Date().toISOString());

    // Used every 29 days, it never expires.
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(29 * DAY);
      expect(await validateSession(token)).not.toBeNull();
    }
  });

  it("ends a session left unused for 30 days", async () => {
    const token = await createSession(await owner(), { label: "Phone", userAgent: null });
    vi.advanceTimersByTime(30 * DAY - 1);
    expect(await validateSession(token)).not.toBeNull();
    vi.advanceTimersByTime(30 * DAY);
    expect(await validateSession(token)).toBeNull();
  });

  it("rejects a token it never issued", async () => {
    expect(await validateSession("not-a-token")).toBeNull();
  });
});
