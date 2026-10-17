import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/ts/app-shell";
import { Bubble } from "@/components/ts/message-bubble";
import { requirePageMember } from "@/lib/auth/require-member";
import { listStudentDrafts } from "@/lib/db/queries/drafts";
import { getStudent } from "@/lib/db/queries/students";
import { formatDayTime } from "@/lib/util/dates";
import { formatPhone } from "@/lib/util/phone";
import { loadShell } from "@/app/shell";

export const metadata: Metadata = { title: "Messages · TuitionSetu" };

/** Every update sent to a student's parent, in full and oldest first, like the WhatsApp chat (IMPL D-40). */
export default async function StudentMessagesPage(props: PageProps<"/students/[id]/messages">) {
  const { id } = await props.params;
  const ctx = await requirePageMember();
  const student = await getStudent(ctx, id);
  if (!student) notFound();

  const { workspace, shell } = await loadShell(ctx);
  const sent = (await listStudentDrafts(ctx, student.id)).filter(({ draft }) => draft.status === "sent").toReversed();
  const parent = student.parentName ?? `${student.messageName}'s parent`;

  return (
    <AppShell {...shell}>
      <div className="mx-auto flex w-full max-w-190 flex-col gap-5 px-4 pt-4 lg:px-6 lg:pt-8">
        <header className="flex items-center gap-2">
          <Link
            href={`/students/${student.id}`}
            aria-label={`Back to ${student.messageName}'s profile`}
            className="-ml-2 flex size-12 shrink-0 items-center justify-center rounded-md text-ink-strong"
          >
            <ArrowLeft aria-hidden className="size-6" strokeWidth={2.4} />
          </Link>
          <div className="flex min-w-0 flex-col">
            <h1 className="text-xl leading-tight font-extrabold wrap-break-word text-ink-strong lg:text-[28px]">Messages to {parent}</h1>
            <p className="text-[15px] text-muted-foreground">
              {student.fullName}&apos;s updates · {formatPhone(student.parentPhone)}
            </p>
          </div>
        </header>

        {sent.length === 0 ? (
          <p className="rounded-md bg-field px-4 py-5 text-base leading-normal text-muted-foreground">
            Nothing sent to {parent} yet. Updates show here once you send them on WhatsApp.
          </p>
        ) : (
          <ol aria-label={`Messages to ${parent}`} className="flex flex-col gap-5 rounded-md bg-field px-4 py-5">
            {sent.map(({ draft, cycle }) => (
              <li key={cycle.id} id={`week-${cycle.id}`} className="flex scroll-mt-4 flex-col gap-3">
                <span className="self-center rounded-sm bg-surface px-3 py-1 text-sm font-extrabold text-muted-foreground">Week of {cycle.label}</span>
                <Bubble
                  message={draft.messageFinal}
                  language={draft.language}
                  meta={draft.sentAt ? `Sent ${formatDayTime(draft.sentAt, workspace.timezone)}` : "Sent"}
                />
              </li>
            ))}
          </ol>
        )}

        <p className="text-sm leading-normal text-muted-foreground">
          This is the text TuitionSetu opened in WhatsApp. If you changed it there before pressing Send, {parent} got your version.
        </p>
      </div>
    </AppShell>
  );
}
