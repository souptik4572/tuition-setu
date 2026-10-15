import { describe, expect, it } from "vitest";
import type { Ctx } from "@/lib/auth/types";
import { WorkspaceSettings } from "@/lib/schemas/settings";
import { cycleRangeFor, todayIn } from "@/lib/util/dates";
import { withDb } from "./client";
import { listStudentAssessments } from "./queries/assessments";
import { listCycleEntries } from "./queries/entries";
import { listLiveDrafts } from "./queries/drafts";
import { getOpenCycle } from "./queries/cycles";
import { listStudents } from "./queries/students";
import { createWorkspaceWithOwner } from "./queries/workspaces";
import { loadSampleData } from "./sample-data";
import { cycles } from "./schema";

async function freshWorkspace(): Promise<Ctx> {
  const settings = WorkspaceSettings.parse({ name: "Mita's Tuition", defaultLanguage: "en", tone: "warm", reportDay: 0 });
  const userId = crypto.randomUUID();
  return { ...(await createWorkspaceWithOwner(settings, { userId, displayName: "Mita Sarkar", signature: "Mita Ma'am" })), userId, role: "owner" };
}

describe("loadSampleData", () => {
  it("adds the six design students with two finished weeks and this week's notes", async () => {
    const ctx = await freshWorkspace();
    await loadSampleData(ctx);

    const roster = await listStudents(ctx);
    expect(roster.map((s) => s.fullName)).toEqual(["Arjun Das", "Ishita Roy", "Kabir Mehta", "Payel Dutta", "Riya Sen", "Tanmoy Ghosh"]);
    expect(new Set(roster.map((s) => s.batch).filter(Boolean))).toEqual(new Set(["Tue/Thu 5 PM", "Sat 10 AM"]));
    expect(roster.find((s) => s.fullName === "Riya Sen")).toMatchObject({ aliasesJson: ["Riyu"], parentLanguage: "bn", parentPhone: "919000000001" });

    const all = await withDb(ctx, (db) => db.select().from(cycles));
    const mine = all.filter((c) => c.workspaceId === ctx.workspaceId);
    expect(mine.map((c) => c.status).sort()).toEqual(["completed", "completed", "open"]);

    const open = await getOpenCycle(ctx);
    expect(open?.startsOn).toBe(cycleRangeFor(todayIn("Asia/Kolkata")).from);
    const entries = await listCycleEntries(ctx, open!.id);
    expect(entries.map((e) => e.nameAsWritten).sort()).toEqual(["Arjun", "Riya", "Tanmoy"]);
    expect(entries.every((e) => e.confirmedAt && e.resolution === "exact")).toBe(true);
    expect((await listLiveDrafts(ctx, open!.id)).size).toBe(0);
  });

  it("gives Riya two earlier scores averaging 58% before this week's 14/20", async () => {
    const ctx = await freshWorkspace();
    await loadSampleData(ctx);
    const riya = (await listStudents(ctx)).find((s) => s.messageName === "Riya")!;
    const scores = await listStudentAssessments(ctx, riya.id);
    expect(scores.map((a) => `${a.scored}/${a.max}`)).toEqual(["6/10", "11/20", "14/20"]);
    const earlier = scores.slice(0, 2).map((a) => (a.scored / a.max) * 100);
    expect(Math.round(earlier.reduce((x, y) => x + y) / earlier.length)).toBe(58);
  });

  it("stores the earlier weeks' updates as sent, assembled in the parent's language", async () => {
    const ctx = await freshWorkspace();
    await loadSampleData(ctx);
    const finished = (await withDb(ctx, (db) => db.select().from(cycles))).filter((c) => c.workspaceId === ctx.workspaceId && c.status === "completed");
    const sent = (await Promise.all(finished.map((c) => listLiveDrafts(ctx, c.id)))).flatMap((m) => [...m.values()]);
    expect(sent).toHaveLength(12);
    expect(sent.every((d) => d.status === "sent" && d.sentAt)).toBe(true);
    const riyaDraft = sent.find((d) => d.messageFinal.startsWith("*Riya-এর সাপ্তাহিক আপডেট"))!;
    expect(riyaDraft.messageFinal).toMatch(/\nনমস্কার Mrs Sen,\n\n.+\n\n— Mita Ma'am$/s);
  });

  it("refuses a workspace that already has students, and leaves it unchanged", async () => {
    const ctx = await freshWorkspace();
    await loadSampleData(ctx);
    await expect(loadSampleData(ctx)).rejects.toThrow(/no students/);
    expect(await listStudents(ctx)).toHaveLength(6);
  });
});
