import type { Metadata } from "next";
import { SetupFrame } from "@/components/ts/setup-frame";
import { requirePageMember } from "@/lib/auth/require-member";
import { listStudents } from "@/lib/db/queries/students";
import { getWorkspace } from "@/lib/db/queries/workspaces";
import { SetupStudents } from "./setup-students";

export const metadata: Metadata = { title: "Add your students · TuitionSetu" };

/** B5 (G3-Empty, G3-Growing). */
export default async function SetupStudentsPage() {
  const ctx = await requirePageMember("owner");
  const [workspace, students] = await Promise.all([getWorkspace(ctx), listStudents(ctx)]);
  return (
    <SetupFrame step={4}>
      <SetupStudents
        students={students.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))}
        subjects={workspace!.subjectsJson}
        defaultLanguage={workspace!.defaultLanguage}
        feeReminders={workspace!.includeFeeReminders}
      />
    </SetupFrame>
  );
}
