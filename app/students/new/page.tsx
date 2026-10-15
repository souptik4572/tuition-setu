import type { Metadata } from "next";
import { AppShell } from "@/components/ts/app-shell";
import { requirePageMember } from "@/lib/auth/require-member";
import { loadShell } from "@/app/shell";
import { loadFormOptions } from "../data";
import { StudentFormPage } from "../form-page";

export const metadata: Metadata = { title: "Add a student · TuitionSetu" };

export default async function NewStudentPage() {
  const ctx = await requirePageMember("teacher");
  const { workspace, shell } = await loadShell(ctx);
  const options = await loadFormOptions(ctx, workspace);
  return (
    <AppShell {...shell} phoneNav={false}>
      <StudentFormPage title="Add a student" cancelHref="/students" cancelLabel="Cancel and go back to Students" {...options} />
    </AppShell>
  );
}
