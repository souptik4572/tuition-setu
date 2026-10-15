"use client";

import { Archive, ArrowLeft, Check, Clock, Eye, FileText, Info, MessageCircle, Pencil, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs } from "radix-ui";
import { useState, useTransition } from "react";
import { ActionsMenu, type MenuItem } from "@/components/ts/actions-menu";
import { Banner } from "@/components/ts/banner";
import { ConfirmDialog } from "@/components/ts/confirm-dialog";
import { Key } from "@/components/ts/key";
import { Modal, ModalClose, modalIcon } from "@/components/ts/modal";
import { StatusChip } from "@/components/ts/status-chip";
import { Toast, type ToastMessage } from "@/components/ts/toast";
import type { Role } from "@/lib/auth/types";
import type { WeekStatus } from "@/lib/pipeline/week-status";
import { LANGUAGE_LABEL, type Language } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";
import { archiveStudent, deleteStudent, restoreStudent } from "./actions";
import { nicknameLine } from "./roster";

export type ProfileData = {
  id: string;
  fullName: string;
  messageName: string;
  classGrade: string;
  batch: string | null;
  language: Language;
  nicknames: string[];
  subjects: string[];
  parentName: string | null;
  phone: { digits: string; display: string };
  standingNotes: string | null;
  feesPending: boolean;
  archivedOn: string | null;
};

export type ProfileUpdate = { cycleId: string; label: string; open: boolean; status: WeekStatus; language: Language; body: string };
export type ProfileScore = { id: string; date: string; label: string; score: string };

const UNREACHABLE = "TuitionSetu couldn't do that. Check that it's still running on the laptop, then try again.";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const fact = "inline-flex min-h-8 items-center gap-1.5 rounded-sm border-2 border-hairline px-2.5 text-[15px] font-extrabold text-ink-strong";
const soft = "inline-flex min-h-8 items-center rounded-sm bg-field px-2.5 text-[15px] font-extrabold text-ink-strong";
const tabClass =
  "inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-[10px] border-2 border-transparent px-4 text-base font-extrabold text-ink-strong data-[state=active]:border-hairline data-[state=active]:bg-surface data-[state=active]:text-ocean";

/**
 * A student's profile (R3-Profile on phones, the D4-Profile panel on the laptop): details, the
 * parent's number, past updates and scores, and the actions this member's role allows (R3-Teacher,
 * R3-Assistant), with archive (R4-Archive) and delete (R5-Delete).
 */
export function Profile({
  student,
  siblings,
  updates,
  scores,
  weeks,
  role,
  ownerName,
  feeReminders,
}: {
  student: ProfileData;
  siblings: string[];
  updates: ProfileUpdate[];
  scores: ProfileScore[];
  weeks: number;
  role: Role;
  ownerName: string | null;
  feeReminders: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"archive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  const name = student.messageName;
  const archived = student.archivedOn !== null;
  const canEdit = role !== "assistant";
  const parent = student.parentName ?? "Parent";

  const run = (action: () => Promise<{ ok: boolean; error?: { message: string } }>, after: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await action().catch(() => null);
      if (!result?.ok) return setError(result?.error?.message ?? UNREACHABLE);
      after();
    });

  const archive = () =>
    run(
      () => archiveStudent(student.id),
      () => {
        setDialog(null);
        setToast({ text: `${student.fullName} archived`, undo: () => void restoreStudent(student.id) });
      },
    );
  const restore = () =>
    run(
      () => restoreStudent(student.id),
      () => setToast({ text: `${student.fullName} restored`, undo: () => void archiveStudent(student.id) }),
    );
  // A successful delete redirects to Students from the server.
  const remove = () => run(() => deleteStudent(student.id), () => undefined);

  const items: MenuItem[] = [{ title: "Edit", icon: Pencil, onSelect: () => router.push(`/students/${student.id}/edit`) }];
  if (archived) items.push({ title: "Restore", helper: "Back on your list and in weekly reviews", icon: RotateCcw, onSelect: restore });
  else items.push({ title: "Archive", helper: "Hide, keep history", icon: Archive, onSelect: () => setDialog("archive") });
  if (role === "owner") items.push({ title: "Delete permanently", helper: `Removes all of ${name}'s history`, icon: Trash2, danger: true, onSelect: () => setDialog("delete") });
  const ownerFirst = ownerName?.trim().split(/\s+/)[0];
  const deleteNote = role === "teacher" ? `Only the owner${ownerFirst ? `, ${ownerFirst},` : ""} can delete a student permanently.` : undefined;

  return (
    <section aria-labelledby="profile-name" className="flex min-w-0 flex-col gap-5 lg:rounded-lg lg:border-2 lg:border-b-4 lg:border-hairline lg:p-6">
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-4">
        <Link href="/students" aria-label="Back to Students" className="-ml-2 flex size-12 items-center justify-center rounded-md text-ink-strong lg:hidden">
          <ArrowLeft aria-hidden className="size-6" strokeWidth={2.4} />
        </Link>
        {canEdit && (
          <div className="col-start-2 row-start-1">
            <ActionsMenu label={`Actions for ${student.fullName}`} items={items} note={deleteNote} />
          </div>
        )}
        <div className="col-span-2 flex min-w-0 items-center gap-4 lg:col-span-1 lg:col-start-1 lg:row-start-1">
          <span aria-hidden className="flex size-[60px] shrink-0 items-center justify-center rounded-lg bg-sky-tint text-[22px] font-extrabold text-ocean">
            {initials(student.fullName)}
          </span>
          <h1 id="profile-name" className="min-w-0 font-display text-[32px] leading-[1.15] font-extrabold tracking-[-0.6px] break-words text-ink-strong">
            {student.fullName}
          </h1>
        </div>
      </div>

      {!canEdit && (
        <p className="flex items-start gap-2.5 rounded-md bg-field px-4 py-3.5 text-base leading-normal text-ink">
          <Eye aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-strong" strokeWidth={2.4} />
          <span>
            <strong className="font-extrabold">View only.</strong> Owners and teachers can change {name}&apos;s details. You can still capture notes about {name}.
          </span>
        </p>
      )}

      {archived && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border-2 border-hairline bg-field px-4 py-3.5">
          <Archive aria-hidden className="size-5 shrink-0 text-ink-strong" strokeWidth={2.4} />
          <span className="min-w-0 flex-[1_1_200px] text-base leading-normal">
            <strong className="font-extrabold">Archived {student.archivedOn}.</strong> {name} doesn&apos;t appear in your student list or weekly reviews.
          </span>
          {canEdit && (
            <Key variant="secondary" size="small" onClick={restore} disabled={pending}>
              <RotateCcw aria-hidden strokeWidth={2.6} />
              Restore
            </Key>
          )}
        </div>
      )}

      {error && !dialog && <Banner variant="flag">{error}</Banner>}

      <ul aria-label={`About ${name}`} className="flex flex-wrap gap-2">
        <li className={fact}>Class {student.classGrade}</li>
        {student.batch && (
          <li className={fact}>
            <Clock aria-hidden className="size-4" strokeWidth={2.4} />
            {student.batch}
          </li>
        )}
        <li className={fact}>
          Messages in&nbsp;<span lang={student.language}>{LANGUAGE_LABEL[student.language]}</span>
        </li>
        {student.nicknames.length > 0 && <li className={soft}>{nicknameLine(student.nicknames)}</li>}
        {student.subjects.map((subject) => (
          <li key={subject} className={soft}>
            {subject}
          </li>
        ))}
        {feeReminders && student.feesPending && <li className={cn(soft, "bg-caution text-on-caution")}>Fees pending</li>}
      </ul>

      <div className="flex flex-col rounded-lg border-2 border-hairline">
        <div className="flex items-start gap-3 px-4 py-3.5">
          <MessageCircle aria-hidden className="mt-1 size-5 shrink-0 text-ink-strong" strokeWidth={2.4} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-extrabold tracking-[0.6px] text-muted-foreground uppercase">{parent}&apos;s WhatsApp</span>
            <span className="text-[19px] font-extrabold text-ink-strong">{student.phone.display}</span>
            {siblings.length > 0 && <span className="text-[15px] text-muted-foreground">Also used for {siblings.join(", ")}</span>}
          </div>
          <a
            href={`https://wa.me/${student.phone.digits}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Check ${student.parentName ?? "the parent"}'s number on WhatsApp (opens in a new tab)`}
            className="-mr-2 inline-flex min-h-11 items-center px-2 text-base font-extrabold text-ocean"
          >
            Check
          </a>
        </div>
        {student.standingNotes && (
          <div className="flex items-start gap-3 border-t-2 border-hairline px-4 py-3.5">
            <FileText aria-hidden className="mt-1 size-5 shrink-0 text-ink-strong" strokeWidth={2.4} />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-extrabold tracking-[0.6px] text-muted-foreground uppercase">Notes for messages</span>
              <span className="text-base leading-normal break-words">{student.standingNotes}</span>
            </div>
          </div>
        )}
      </div>

      <Tabs.Root defaultValue="messages" className="flex flex-col gap-4">
        <Tabs.List aria-label={`${name}'s history`} className="flex gap-1 rounded-md bg-field p-1">
          <Tabs.Trigger value="messages" className={tabClass}>
            Messages
          </Tabs.Trigger>
          <Tabs.Trigger value="scores" className={tabClass}>
            Scores
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="messages" className="flex flex-col gap-3">
          {updates.length === 0 ? (
            <p className="rounded-md bg-field px-4 py-5 text-base leading-normal text-muted-foreground">No updates yet. {name}&apos;s weekly updates show here once you write them.</p>
          ) : (
            updates.map((u) => (
              <article key={u.cycleId} className="flex flex-col gap-2 rounded-lg border-2 border-hairline px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[17px] font-extrabold text-ink-strong">{u.open ? `This week · ${u.label}` : u.label}</h2>
                  <StatusChip status={u.status} />
                </div>
                <p lang={u.language} className="line-clamp-2 text-base leading-normal">
                  {u.body}
                </p>
                {u.open && (
                  <Link href={`/cycles/${u.cycleId}?student=${student.id}`} className="self-start text-base font-extrabold text-ocean">
                    Open update
                  </Link>
                )}
              </article>
            ))
          )}
        </Tabs.Content>
        <Tabs.Content value="scores">
          {scores.length === 0 ? (
            <p className="rounded-md bg-field px-4 py-5 text-base leading-normal text-muted-foreground">No scores yet. Scores from your notes about {name} show here.</p>
          ) : (
            <table className="w-full border-collapse text-left text-base">
              <thead className="text-sm font-extrabold text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3">
                    Date
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Test
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.id} className="border-t-2 border-hairline">
                    <td className="py-3 pr-3 whitespace-nowrap">{s.date}</td>
                    <td className="py-3 pr-3">{s.label}</td>
                    <td className="py-3 text-right font-extrabold whitespace-nowrap text-ink-strong">{s.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Tabs.Content>
      </Tabs.Root>

      <Modal
        open={dialog === "archive"}
        onOpenChange={(open) => !open && setDialog(null)}
        sheet
        title={`Archive ${student.fullName}?`}
        icon={
          <span aria-hidden className={modalIcon("plain")}>
            <Archive strokeWidth={2.4} />
          </span>
        }
      >
        <p className="text-[17px] leading-normal text-muted-foreground">
          {name} will be hidden from your student list and weekly reviews. {name}&apos;s history is kept, and you can restore {name} any time.
        </p>
        <ul className="flex flex-col gap-2 rounded-md bg-field px-4 py-3.5 text-base leading-normal">
          {weeks > 0 && (
            <li className="flex gap-2.5">
              <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-ocean" strokeWidth={2.6} />
              Kept: {plural(weeks, "week", "weeks")} of notes, scores, messages and photos
            </li>
          )}
          <li className="flex gap-2.5">
            <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-ocean" strokeWidth={2.6} />
            Find {name} under Students → Archived
          </li>
        </ul>
        {error && <Banner variant="flag">{error}</Banner>}
        <div className="flex flex-col gap-3">
          <Key size="big" onClick={archive} disabled={pending}>
            {pending ? "Archiving…" : `Archive ${name}`}
          </Key>
          <ModalClose asChild>
            <Key variant="secondary" size="big">
              Cancel
            </Key>
          </ModalClose>
        </div>
      </Modal>

      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Delete ${student.fullName} permanently?`}
        name={student.fullName}
        confirmLabel="Delete permanently"
        onConfirm={remove}
        pending={pending}
        error={error && <Banner variant="flag">{error}</Banner>}
        alternative={
          archived ? (
            <ModalClose asChild>
              <Key variant="secondary" size="big">
                Cancel
              </Key>
            </ModalClose>
          ) : (
            <Key size="big" onClick={archive} disabled={pending}>
              <Archive aria-hidden strokeWidth={2.4} />
              Archive instead
            </Key>
          )
        }
      >
        <p className="text-[17px] leading-normal text-muted-foreground">
          {weeks > 0
            ? `This deletes all of ${name}'s notes, scores, messages and photos — ${plural(weeks, "week", "weeks")} of history. It can't be undone.`
            : `This deletes everything saved about ${name}. It can't be undone.`}
        </p>
        <p className="flex items-start gap-2.5 rounded-md bg-field px-4 py-3.5 text-[15px] leading-normal">
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-strong" strokeWidth={2.4} />
          <span>
            <strong className="font-extrabold">When to use this:</strong> when a parent asks you to remove their child&apos;s details.{" "}
            {archived
              ? `Otherwise keep ${name} archived — the history stays and you can bring ${name} back.`
              : `If ${name} has just stopped coming, archive instead — the history stays and you can bring ${name} back.`}
          </span>
        </p>
        <p className="text-sm leading-normal text-muted-foreground">
          Updates already sent stay in {student.parentName ?? "the parent"}&apos;s WhatsApp. TuitionSetu can&apos;t remove those.
        </p>
      </ConfirmDialog>

      <Toast toast={toast} onDone={() => setToast(null)} />
    </section>
  );
}
