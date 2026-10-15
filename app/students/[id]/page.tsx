import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/ts/app-shell";
import { requirePageMember } from "@/lib/auth/require-member";
import { listStudentAssessments } from "@/lib/db/queries/assessments";
import { listStudentDrafts } from "@/lib/db/queries/drafts";
import { getOwnerName } from "@/lib/db/queries/members";
import { getStudent, historyWeeks, studentsSharingPhone } from "@/lib/db/queries/students";
import { weekStatus } from "@/lib/pipeline/week-status";
import { formatDay, todayIn } from "@/lib/util/dates";
import { formatPhone } from "@/lib/util/phone";
import { loadShell } from "@/app/shell";
import { loadRoster } from "../data";
import { Profile } from "../profile";
import { Roster } from "../roster";

export const metadata: Metadata = { title: "Student · TuitionSetu" };

const score = (scored: number, max: number) => `${scored}/${max}${max > 0 ? ` · ${Math.round((scored / max) * 100)}%` : ""}`;

/** R3-Profile on phones; on the laptop the D4-Profile panel beside the roster. */
export default async function StudentPage(props: PageProps<"/students/[id]">) {
  const { id } = await props.params;
  const ctx = await requirePageMember();
  const student = await getStudent(ctx, id);
  if (!student) notFound();

  const { workspace, shell } = await loadShell(ctx);
  const [roster, siblings, drafts, assessments, weeks, ownerName] = await Promise.all([
    loadRoster(ctx, workspace.timezone),
    studentsSharingPhone(ctx, student.parentPhone, student.id),
    listStudentDrafts(ctx, student.id),
    listStudentAssessments(ctx, student.id),
    historyWeeks(ctx, [student.id]),
    ctx.role === "teacher" ? getOwnerName(ctx) : null,
  ]);

  return (
    <AppShell {...shell}>
      <Roster
        {...roster}
        canEdit={ctx.role !== "assistant"}
        selectedId={student.id}
        startOn={student.status}
        panel={
          <Profile
            student={{
              id: student.id,
              fullName: student.fullName,
              messageName: student.messageName,
              classGrade: student.classGrade,
              batch: student.batch,
              language: student.parentLanguage,
              nicknames: student.aliasesJson,
              subjects: student.subjectsJson,
              parentName: student.parentName,
              phone: { digits: student.parentPhone, display: formatPhone(student.parentPhone) },
              standingNotes: student.standingNotes,
              feesPending: student.feesPending,
              archivedOn: student.status === "archived" && student.archivedAt ? formatDay(todayIn(workspace.timezone, new Date(student.archivedAt))) : null,
            }}
            siblings={siblings.map((s) => s.fullName)}
            updates={drafts.map(({ draft, cycle }) => ({
              cycleId: cycle.id,
              label: cycle.label,
              open: cycle.status !== "completed",
              status: weekStatus(draft.status, []),
              language: draft.language,
              body: draft.bodyFinal ?? draft.bodyModel,
            }))}
            scores={assessments.toReversed().map((a) => ({ id: a.id, date: formatDay(a.takenOn), label: a.label, score: score(a.scored, a.max) }))}
            weeks={weeks.get(student.id) ?? 0}
            role={ctx.role}
            ownerName={ownerName}
            feeReminders={workspace.includeFeeReminders}
          />
        }
      />
    </AppShell>
  );
}
