"use client";

import { ArrowLeft, Check, CircleHelp, Clock, FileQuestion, Laptop, Pencil, RotateCcw, Timer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Banner } from "@/components/ts/banner";
import { CopyCommand } from "@/components/ts/copy-command";
import { helpClass, inputClass } from "@/components/ts/field";
import { Key, KeyLink } from "@/components/ts/key";
import { StatusChip } from "@/components/ts/status-chip";
import { undoResolve } from "@/app/needs-you/actions";
import { cn } from "@/lib/utils";
import { editNote } from "../actions";

export type NoteRow = { id: string; label: string; summary: string; state: "read" | "auto" | "waiting" | "ignored"; asWritten: string };

type NoteData = { id: string; status: string; errorCode: string | null; text: string; typedAt: string; day: string; batch: string | null };

const UNREACHABLE = "TuitionSetu couldn't do that. Check that it's still running on the laptop, then try again.";

function ReadingDots() {
  return (
    <span aria-hidden className="ml-auto flex gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-2 animate-reading rounded-full bg-sky" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </span>
  );
}

function ErrorCard({ icon, title, tag, children }: { icon: ReactNode; title: string; tag?: string; children: ReactNode }) {
  return (
    <section aria-labelledby="error-title" className="flex flex-col gap-4 rounded-lg border-2 border-b-4 border-hairline p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-md bg-field text-ink-strong [&_svg]:size-6">
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="error-title" className="flex flex-wrap items-center gap-2 text-xl font-extrabold text-ink-strong">
            {title}
            {tag && <span className="rounded-sm border-2 border-hairline px-1.5 text-xs font-extrabold tracking-[0.6px] text-muted-foreground uppercase">{tag}</span>}
          </h2>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * A saved note (D-24): "Reading your notes…" until it's read, then each student it mentions, or,
 * when it couldn't be read, the note as typed with the actions for the cause (§4.1, F2).
 */
export function NoteView({
  note,
  rows,
  alternate,
  readingModel,
  local,
}: {
  note: NoteData;
  rows: NoteRow[];
  alternate: { name: string; faster: boolean } | null;
  readingModel: string;
  local: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const reading = note.status === "captured" || note.status === "extracting";
  const failed = note.status === "failed";
  const engineOff = failed && (note.errorCode === "provider_unreachable" || note.errorCode === "model_missing");

  // The laptop reads in the background, and retries on its own once the engine is back; ask again until it's done.
  useEffect(() => {
    if (!reading && !engineOff) return;
    const id = setInterval(() => router.refresh(), reading ? 2000 : 5000);
    return () => clearInterval(id);
  }, [reading, engineOff, router]);

  const retry = (alternateModel = false) =>
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/notes/${note.id}/process`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ alternate: alternateModel }) });
        if (!res.ok && res.status !== 409) throw new Error(String(res.status));
        router.refresh();
      } catch {
        setError(UNREACHABLE);
      }
    });

  const saveEdit = () =>
    startTransition(async () => {
      setError(null);
      const result = await editNote(note.id, draft).catch(() => null);
      if (!result?.ok) return setError(result?.error.message ?? UNREACHABLE);
      setEditing(false);
    });

  const undo = (rowId: string) =>
    startTransition(async () => {
      const result = await undoResolve(rowId).catch(() => null);
      if (!result?.ok) setError(result?.error.message ?? UNREACHABLE);
    });

  const alternateKey = alternate && (
    <div className="flex flex-col gap-1.5">
      <Key variant="secondary" size="big" className="w-full" onClick={() => retry(true)} disabled={pending}>
        {alternate.faster ? "Use the faster model" : "Try the other model"}
      </Key>
      {alternate.faster && <span className={helpClass}>Quicker, but may need you to check more names and numbers.</span>}
    </div>
  );
  const tryAgain = (
    <Key size="big" className="w-full" onClick={() => retry()} disabled={pending}>
      <RotateCcw aria-hidden strokeWidth={2.6} />
      {pending ? "Starting…" : "Try again"}
    </Key>
  );

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 pb-[max(24px,env(safe-area-inset-bottom))] lg:px-6 lg:pt-8">
      <header className="flex min-h-16 items-center gap-2 pt-[env(safe-area-inset-top)] lg:pb-2">
        <Link href="/" aria-label="Back to Home" className="-ml-2 flex size-12 shrink-0 items-center justify-center rounded-md text-ink-strong lg:hidden">
          <ArrowLeft aria-hidden className="size-6" strokeWidth={2.4} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="text-xl font-extrabold text-ink-strong lg:font-display lg:text-[40px] lg:leading-[1.1] lg:tracking-[-1px]">Your note</h1>
          <span className="text-sm text-muted-foreground">Typed {note.typedAt}</span>
        </div>
        {failed && <StatusChip status="couldnt_read" />}
      </header>

      {reading && (
        <p role="status" className="flex items-center gap-3 rounded-md bg-sky-tint px-4 py-3.5 text-[17px] font-extrabold text-on-sky-tint">
          <Check aria-hidden className="size-5 shrink-0" strokeWidth={2.8} />
          Saved. Reading your notes…
          <ReadingDots />
        </p>
      )}
      {note.status === "processed" && (
        <p role="status" className="flex items-center gap-3 rounded-md bg-sky-tint px-4 py-3.5 text-[17px] font-extrabold text-on-sky-tint">
          <Check aria-hidden className="size-5 shrink-0" strokeWidth={2.8} />
          {rows.length === 0 ? "Read — no students found in this note" : `Read — about ${rows.length === 1 ? "1 student" : `${rows.length} students`}`}
        </p>
      )}
      {failed && (
        <p className="flex items-center gap-2 text-[17px] font-extrabold text-ocean">
          <Check aria-hidden className="size-5" strokeWidth={2.8} />
          Your note is saved
        </p>
      )}

      {editing ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="edit-note" className="sr-only">
            Your note
          </label>
          <textarea id="edit-note" value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className={cn(inputClass(), "h-auto py-3 leading-normal")} />
          <div className="flex flex-wrap gap-3">
            <Key onClick={saveEdit} disabled={pending || !draft.trim()}>
              {pending ? "Saving…" : "Save and read again"}
            </Key>
            <Key variant="text" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Key>
          </div>
        </div>
      ) : (
        <figure className="flex flex-col gap-1.5">
          <div className="rounded-md bg-field px-4 py-3.5">
            {!failed && (
              <figcaption className="text-sm text-muted-foreground">
                {note.day}
                {note.batch && ` · ${note.batch}`}
              </figcaption>
            )}
            <p className="text-[17px] leading-normal break-words whitespace-pre-wrap">{note.text}</p>
          </div>
          {failed && <span className={helpClass}>Exactly as you typed it. Nothing has been changed or lost.</span>}
        </figure>
      )}

      {error && <Banner variant="flag">{error}</Banner>}

      {failed && !editing && (
        <>
          {note.errorCode === "timeout" && (
            <ErrorCard icon={<Timer strokeWidth={2.2} />} title="This took too long">
              <p className="text-base leading-normal">Reading this note was taking longer than it should, so I stopped. The laptop may have been busy.</p>
              {tryAgain}
              {alternateKey}
            </ErrorCard>
          )}
          {note.errorCode === "model_missing" && (
            <ErrorCard icon={<Laptop strokeWidth={2.2} />} title="The reading model isn't installed" tag={local ? "Laptop version only" : undefined}>
              <p className="text-base leading-normal">TuitionSetu is set to read notes with {readingModel}, but it isn&apos;t on this laptop. On the laptop, open {local ? "Terminal" : "a terminal"} and run:</p>
              <CopyCommand command={`ollama pull ${readingModel}`} />
              <p className="flex items-center gap-2 rounded-md bg-sky-tint px-3.5 py-3 text-base font-extrabold text-on-sky-tint">
                <Clock aria-hidden className="size-5 shrink-0" strokeWidth={2.4} />
                We&apos;ll read it as soon as it&apos;s installed
              </p>
              <span className={helpClass}>Or change MODEL_EXTRACT in .env.local to a model you have, then restart TuitionSetu.</span>
            </ErrorCard>
          )}
          {note.errorCode === "provider_unreachable" && (
            <ErrorCard icon={<Laptop strokeWidth={2.2} />} title="The AI engine is off" tag={local ? "Laptop version only" : undefined}>
              <p className="text-base leading-normal">TuitionSetu&apos;s reader isn&apos;t running on the laptop right now — maybe it restarted or went to sleep.</p>
              <p className="flex items-center gap-2 rounded-md bg-sky-tint px-3.5 py-3 text-base font-extrabold text-on-sky-tint">
                <Clock aria-hidden className="size-5 shrink-0" strokeWidth={2.4} />
                We&apos;ll read it as soon as it&apos;s back
              </p>
              <Key variant="secondary" size="big" className="w-full" onClick={() => retry()} disabled={pending}>
                {pending ? "Starting…" : "Try now"}
              </Key>
              <span className={helpClass}>Still off? On the laptop, open TuitionSetu — it starts the AI engine for you.</span>
            </ErrorCard>
          )}
          {note.errorCode !== "timeout" && !engineOff && (
            <ErrorCard icon={<CircleHelp strokeWidth={2.2} />} title="Couldn't make sense of this note">
              <p className="text-base leading-normal">The short forms were hard to follow. Try again, try the other model, or add a few words to the note.</p>
              {tryAgain}
              <div className="flex flex-wrap gap-3 [&>*]:flex-1">
                {alternateKey}
                <Key variant="secondary" size="big" onClick={() => setEditing(true)} disabled={pending}>
                  <Pencil aria-hidden strokeWidth={2.4} />
                  Edit the note
                </Key>
              </div>
            </ErrorCard>
          )}
        </>
      )}

      {note.status === "processed" && rows.length > 0 && (
        <section aria-labelledby="students-title" className="flex flex-col rounded-lg border-2 border-b-4 border-hairline">
          <h2 id="students-title" className="px-4 pt-3.5 pb-2 text-sm font-extrabold tracking-[0.8px] text-ink-strong uppercase">
            Students in this note
          </h2>
          <ul>
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-hairline px-4 py-3">
                <span className="flex min-w-0 flex-[1_1_180px] flex-col">
                  <span className="text-[17px] font-extrabold text-ink-strong">{row.label}</span>
                  {row.summary && <span className="text-sm text-muted-foreground">{row.summary}</span>}
                </span>
                {row.state === "read" && (
                  <span className="flex items-center gap-1 text-[15px] font-extrabold text-ocean">
                    <Check aria-hidden className="size-4" strokeWidth={2.8} />
                    Read
                  </span>
                )}
                {row.state === "auto" && (
                  <span className="flex items-center gap-2">
                    <span className="rounded-sm border-2 border-hairline px-1.5 text-xs font-extrabold tracking-[0.6px] text-muted-foreground uppercase">Auto-matched</span>
                    <Key variant="text" size="small" onClick={() => undo(row.id)} disabled={pending} aria-label={`Undo match of ${row.asWritten} to ${row.label}`}>
                      Undo
                    </Key>
                  </span>
                )}
                {row.state === "waiting" && (
                  <Link href={`/needs-you/${row.id}`} className="no-underline">
                    <StatusChip status="needs_you" />
                  </Link>
                )}
                {row.state === "ignored" && <span className="text-[15px] text-muted-foreground">Left out</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reading && (
        <p className={cn(helpClass, "flex items-start gap-2")}>
          <Laptop aria-hidden className="mt-0.5 size-[18px] shrink-0" strokeWidth={2.2} />
          You can close the app. Your laptop keeps reading, and anything unclear will wait in Needs you.
        </p>
      )}
      {note.status === "processed" && rows.some((r) => r.state === "waiting") && (
        <p className={cn(helpClass, "flex items-start gap-2")}>
          <FileQuestion aria-hidden className="mt-0.5 size-[18px] shrink-0" strokeWidth={2.2} />
          Anything I wasn&apos;t sure about is waiting in Needs you. Nothing is sent until you decide.
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-2 sm:flex-row-reverse sm:justify-start">
        <KeyLink href="/" size="big">
          Done
        </KeyLink>
        <KeyLink href="/capture" variant="secondary" size="big">
          Type another note
        </KeyLink>
      </div>
    </div>
  );
}
