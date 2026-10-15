import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { withDb } from "./client";
import { workspaces } from "./schema";

const sys = { workspaceId: "-", memberId: "-", system: true } as const;
const count = () => withDb(sys, async (db) => (await db.select({ n: sql<number>`count(*)` }).from(workspaces))[0].n);

describe("withDb (local)", () => {
  it("migrates a new database with every table", async () => {
    // SQLite-only test, so the sync .all() is fine here.
    const rows = await withDb(sys, async (db) => db.all<{ name: string }>(sql`select name from sqlite_master where type = 'table' order by name`));
    expect(rows.map((r) => r.name).filter((n) => !n.startsWith("__") && n !== "sqlite_sequence")).toEqual([
      "ai_runs", "assessments", "audit_events", "cycles", "drafts", "extracted_entries",
      "members", "note_inputs", "pairing_tokens", "sessions", "students", "workspaces",
    ]);
  });

  it("rolls back everything when the function throws", async () => {
    const before = await count();
    await expect(
      withDb(sys, async (db) => {
        await db.insert(workspaces).values({ name: "Gone" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await count()).toBe(before);
  });

  it("lets nested calls join the outer transaction instead of deadlocking", async () => {
    const before = await count();
    await withDb(sys, async (db) => {
      await db.insert(workspaces).values({ name: "Outer" });
      await withDb(sys, async (inner) => inner.insert(workspaces).values({ name: "Inner" }));
    });
    expect(await count()).toBe(before + 2);
  });

  it("runs concurrent calls one at a time", async () => {
    const order: string[] = [];
    await Promise.all(
      ["a", "b"].map((k) =>
        withDb(sys, async () => {
          order.push(`${k}-start`);
          await new Promise((r) => setTimeout(r, 10));
          order.push(`${k}-end`);
        }),
      ),
    );
    expect(order).toEqual(["a-start", "a-end", "b-start", "b-end"]);
  });
});
