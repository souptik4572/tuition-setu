import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/ts/app-shell";
import { alternateModel } from "@/lib/ai/health";
import { requirePageMember } from "@/lib/auth/require-member";
import { listNoteEntries, type Entry } from "@/lib/db/queries/entries";
import { getNote } from "@/lib/db/queries/notes";
import { listStudents } from "@/lib/db/queries/students";
import { env } from "@/lib/env";
import { formatDay, formatDayTime } from "@/lib/util/dates";
import { loadShell } from "../../shell";
import { NoteView, type NoteRow } from "./note-view";

export const metadata: Metadata = { title: "Your note · TuitionSetu" };

/** "Riya Sen · ch5 test 14/20 · came late": what was read for one student. */
function summary(entry: Entry): string {
  const p = entry.payloadJson;
  const bits = p.assessments.flatMap((a) => (a.scored !== null && a.max !== null ? [`${a.label} ${a.scored}/${a.max}`] : []));
  if (p.attendance === "absent") bits.push("absent");
  if (p.attendance === "late") bits.push("came late");
  if (p.homework.status === "missed") bits.push("missed homework");
  if (!bits.length && p.topics.length) bits.push(p.topics[0]);
  return bits.slice(0, 3).join(" · ");
}

/** M3-Saved while reading and once read; F2-Note and F2-Variants when it couldn't be read. */
export default async function NotePage(props: PageProps<"/capture/[id]">) {
  const { id } = await props.params;
  const ctx = await requirePageMember();
  const note = await getNote(ctx, id);
  if (!note) notFound();
  const { workspace, shell } = await loadShell(ctx);
  const [entries, students] = await Promise.all([listNoteEntries(ctx, id), Promise.all([listStudents(ctx), listStudents(ctx, "archived")]).then((l) => l.flat())]);
  const names = new Map(students.map((s) => [s.id, s.fullName]));
  const retryable = note.status === "failed" && note.errorCode !== "provider_unreachable" && note.errorCode !== "model_missing";
  const alternate = retryable ? await alternateModel(workspace.aiConfigJson) : null;

  const rows: NoteRow[] = entries.map((e) => ({
    id: e.id,
    label: e.studentId ? (names.get(e.studentId) ?? e.nameAsWritten) : e.nameAsWritten ? `‘${e.nameAsWritten}’` : "A line about no one",
    summary: summary(e),
    state: e.resolution === "ignored" ? "ignored" : !e.confirmedAt ? "waiting" : e.resolution === "fuzzy" ? "auto" : "read",
    asWritten: e.nameAsWritten,
  }));

  return (
    <AppShell {...shell} phoneNav={false}>
      <NoteView
        note={{
          id: note.id,
          status: note.status,
          errorCode: note.errorCode,
          text: note.rawText ?? "",
          typedAt: formatDayTime(note.createdAt, workspace.timezone),
          day: formatDay(note.classDate),
          batch: note.batch,
        }}
        rows={rows}
        alternate={alternate}
        local={env.APP_MODE === "local"}
      />
    </AppShell>
  );
}
