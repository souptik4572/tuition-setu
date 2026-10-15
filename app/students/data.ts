import "server-only";
import { modelFor } from "@/lib/ai";
import type { Ctx } from "@/lib/auth/types";
import { getOpenCycle } from "@/lib/db/queries/cycles";
import { listLiveDrafts, type Draft } from "@/lib/db/queries/drafts";
import { listCycleEntries } from "@/lib/db/queries/entries";
import { getMember } from "@/lib/db/queries/members";
import { historyWeeks, listStudents } from "@/lib/db/queries/students";
import { getWorkspace, type Workspace } from "@/lib/db/queries/workspaces";
import type { DbCtx } from "@/lib/db/types";
import type { Language } from "@/lib/schemas/common";
import { weekStatus, type WeekStatus } from "@/lib/pipeline/week-status";
import { formatDay, todayIn } from "@/lib/util/dates";

export type RosterRow = {
  id: string;
  fullName: string;
  nicknames: string[];
  classGrade: string;
  batch: string | null;
  language: Language;
  week: WeekStatus;
};

export type ArchivedRow = { id: string; fullName: string; classGrade: string; archivedOn: string; weeks: number };

/** What the roster shows (D4-Profile, R4-Archived): active students with this week's chip, and the archived list. */
export async function loadRoster(ctx: DbCtx, timezone: string) {
  const [active, archived, cycle] = await Promise.all([listStudents(ctx), listStudents(ctx, "archived"), getOpenCycle(ctx)]);
  const [drafts, entries, weeks] = await Promise.all([
    cycle ? listLiveDrafts(ctx, cycle.id) : new Map<string, Draft>(),
    cycle ? listCycleEntries(ctx, cycle.id) : [],
    historyWeeks(ctx, archived.map((s) => s.id)),
  ]);

  return {
    active: active.map(
      (s): RosterRow => ({
        id: s.id,
        fullName: s.fullName,
        nicknames: s.aliasesJson,
        classGrade: s.classGrade,
        batch: s.batch,
        language: s.parentLanguage,
        week: weekStatus(drafts.get(s.id)?.status, entries.filter((e) => e.studentId === s.id)),
      }),
    ),
    archived: archived.map(
      (s): ArchivedRow => ({
        id: s.id,
        fullName: s.fullName,
        classGrade: s.classGrade,
        archivedOn: s.archivedAt ? formatDay(todayIn(timezone, new Date(s.archivedAt))) : "",
        weeks: weeks.get(s.id) ?? 0,
      }),
    ),
  };
}

/** The workspace's settings, and the AI name and avatar for the app shell. */
export async function loadShell(ctx: Ctx) {
  const [workspace, member] = await Promise.all([getWorkspace(ctx), getMember(ctx, ctx.memberId)]);
  return { workspace: workspace!, shell: { aiName: modelFor("draft", workspace!.aiConfigJson), userName: member?.displayName } };
}

/** What the student form offers: batches in use, the workspace's subjects, and other students' numbers for the sibling note. */
export async function loadFormOptions(ctx: DbCtx, workspace: Workspace, exceptId?: string) {
  const students = await listStudents(ctx);
  return {
    batches: [...new Set(students.map((s) => s.batch).filter((b): b is string => !!b))].sort(),
    subjects: workspace.subjectsJson,
    others: students.filter((s) => s.id !== exceptId).map((s) => ({ fullName: s.fullName, parentPhone: s.parentPhone })),
    defaultLanguage: workspace.defaultLanguage,
    feeReminders: workspace.includeFeeReminders,
  };
}
