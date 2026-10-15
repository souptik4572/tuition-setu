import type { Metadata } from "next";
import { AppShell } from "@/components/ts/app-shell";
import { requirePageMember } from "@/lib/auth/require-member";
import { loadRoster, loadShell } from "./data";
import { Roster } from "./roster";

export const metadata: Metadata = { title: "Students · TuitionSetu" };

/** D4-Profile without a student open, R4-Archived, States 1. */
export default async function StudentsPage() {
  const ctx = await requirePageMember();
  const { workspace, shell } = await loadShell(ctx);
  const roster = await loadRoster(ctx, workspace.timezone);
  return (
    <AppShell {...shell}>
      <Roster {...roster} canEdit={ctx.role !== "assistant"} />
    </AppShell>
  );
}
