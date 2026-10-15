import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/ts/app-shell";
import { requirePageMember } from "@/lib/auth/require-member";
import { getStudent } from "@/lib/db/queries/students";
import { loadFormOptions, loadShell } from "../../data";
import { StudentFormPage } from "../../form-page";

export const metadata: Metadata = { title: "Edit student · TuitionSetu" };

export default async function EditStudentPage(props: PageProps<"/students/[id]/edit">) {
  const { id } = await props.params;
  const ctx = await requirePageMember("teacher");
  const student = await getStudent(ctx, id);
  if (!student) notFound();
  const { workspace, shell } = await loadShell(ctx);
  const options = await loadFormOptions(ctx, workspace, student.id);
  return (
    <AppShell {...shell} phoneNav={false}>
      <StudentFormPage
        title={`Edit ${student.fullName}`}
        cancelHref={`/students/${student.id}`}
        cancelLabel={`Cancel and go back to ${student.messageName}'s profile`}
        student={student}
        {...options}
      />
    </AppShell>
  );
}
