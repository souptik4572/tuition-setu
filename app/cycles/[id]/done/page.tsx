import { CalendarDays, Check, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ts/app-shell";
import { KeyLink } from "@/components/ts/key";
import { StatusChip } from "@/components/ts/status-chip";
import { requirePageMember } from "@/lib/auth/require-member";
import { getCycle } from "@/lib/db/queries/cycles";
import { listLiveDrafts } from "@/lib/db/queries/drafts";
import { listStudents } from "@/lib/db/queries/students";
import { addDays, formatDay, formatRange } from "@/lib/util/dates";
import { loadShell } from "../../../shell";

export const metadata: Metadata = { title: "Week complete · TuitionSetu" };

/** K4-WeekDone (D-22): sent, skipped, edited before sending, and minutes from first draft to done. */
export default async function WeekDonePage(props: PageProps<"/cycles/[id]/done">) {
  const { id } = await props.params;
  const ctx = await requirePageMember();
  const cycle = await getCycle(ctx, id);
  if (!cycle) notFound();
  if (cycle.status !== "completed") redirect(`/cycles/${id}`);
  const [{ member, shell }, students, drafts] = await Promise.all([loadShell(ctx), listStudents(ctx), listLiveDrafts(ctx, id)]);

  const rows = students.map((s) => ({ name: s.fullName, draft: drafts.get(s.id) }));
  const sent = rows.filter((r) => r.draft?.status === "sent");
  const edited = sent.filter((r) => r.draft!.bodyFinal && r.draft!.bodyFinal !== r.draft!.bodyModel).length;
  const firstDraft = [...drafts.values()].map((d) => d.createdAt).sort()[0];
  const minutes = firstDraft && cycle.completedAt ? Math.max(1, Math.round((Date.parse(cycle.completedAt) - Date.parse(firstDraft)) / 60_000)) : 0;
  const stats = [
    [sent.length, "sent"],
    [rows.length - sent.length, "skipped"],
    [edited, "edited before sending"],
    [minutes, "minutes"],
  ] as const;

  return (
    <AppShell {...shell}>
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 pt-8 lg:px-6">
        <header className="flex items-center gap-4">
          <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-sky text-on-sky shadow-[0_4px_0_0_var(--sky-lip)]">
            <Check className="size-9" strokeWidth={2.8} />
          </span>
          <div className="flex flex-col">
            <h1 className="font-display text-[40px] leading-[1.1] font-extrabold tracking-[-1px] text-ink-strong lg:text-5xl">Week complete</h1>
            <p className="text-[17px] text-muted-foreground">
              {formatRange(cycle.startsOn, cycle.endsOn)} · well done, {member?.displayName.trim().split(/\s+/)[0]}
            </p>
          </div>
        </header>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([n, label]) => (
            <div key={label} className="flex flex-col-reverse justify-end rounded-lg border-2 border-b-4 border-hairline px-4 py-3">
              <dt className="text-[15px] text-muted-foreground">{label}</dt>
              <dd className="text-[30px] leading-tight font-extrabold text-ink-strong">{n}</dd>
            </div>
          ))}
        </dl>
        <p className="flex items-center gap-2.5 rounded-md bg-sky-tint px-4 py-3.5 text-base font-extrabold text-on-sky-tint">
          <CalendarDays aria-hidden className="size-5" strokeWidth={2.4} />
          Next week starts {formatDay(addDays(cycle.endsOn, 1))}
        </p>
        <ul aria-label="This week's updates" className="flex flex-col rounded-lg bg-field p-2">
          {rows.map((r) => (
            <li key={r.name} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
              <span className="text-base font-extrabold text-ink-strong">{r.name}</span>
              <StatusChip status={r.draft?.status === "sent" ? "sent" : "skipped"} />
            </li>
          ))}
        </ul>
        <Link href={`/cycles/${id}`} className="flex items-center justify-center gap-1.5 text-base font-extrabold text-ocean no-underline">
          See this week&apos;s messages
          <ChevronRight aria-hidden className="size-5" strokeWidth={2.4} />
        </Link>
        <KeyLink href="/" size="big">
          Back to Home
        </KeyLink>
      </div>
    </AppShell>
  );
}
