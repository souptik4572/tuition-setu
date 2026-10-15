import type { Metadata } from "next";
import { AppShell } from "@/components/ts/app-shell";
import { requirePageMember } from "@/lib/auth/require-member";
import { listStudents } from "@/lib/db/queries/students";
import { todayIn } from "@/lib/util/dates";
import { loadShell } from "../shell";
import { CaptureForm } from "./capture-form";

export const metadata: Metadata = { title: "Type a note · TuitionSetu" };

/** S1, M3-TypeNote. */
export default async function CapturePage() {
  const ctx = await requirePageMember();
  const { workspace, shell } = await loadShell(ctx);
  const students = await listStudents(ctx);
  const batches = [...new Set(students.map((s) => s.batch).filter((b): b is string => !!b))].sort();
  return (
    <AppShell {...shell} phoneNav={false}>
      <CaptureForm batches={batches} today={todayIn(workspace.timezone)} />
    </AppShell>
  );
}
